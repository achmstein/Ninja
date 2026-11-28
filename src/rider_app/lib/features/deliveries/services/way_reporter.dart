import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'delivery_service.dart';
import 'hand_over_locator.dart';

/// What the phone's ongoing notification says while the rider's way is being told
@immutable
class WayNotice {
  final String title;
  final String text;

  const WayNotice({required this.title, required this.text});
}

/// Tells the server where the rider is while a delivery is on the way, so the
/// customer's card can say how close it is. Runs only then: it starts when a
/// delivery goes out and stops when none is out (the list says so, or the
/// server answers that nothing is). On Android the position stream holds a
/// foreground service with an ongoing notification, so reports keep going
/// with Maps in front or the phone in a pocket. Without permission, or with
/// location off, nothing is sent and nothing is held up: the delivery goes
/// on, and the customer's card simply does not move.
class WayReporter {
  /// A new fix is taken about this often, once the rider moved [moved] metres
  static const every = Duration(seconds: 20);
  static const moved = 30;

  /// Reports are never sent closer together than this, however fast fixes come
  static const _gap = Duration(seconds: 15);

  final DeliveryService Function() _service;
  // Cancelled in stop(), which the provider calls when it goes
  // ignore: cancel_subscriptions
  StreamSubscription<Position>? _positions;
  DateTime? _lastSent;
  bool _starting = false;
  bool _sending = false;

  WayReporter(this._service);

  bool get running => _positions != null;

  /// A delivery is out: start telling, unless already. [notice] is the ongoing notification's words.
  Future<void> start(WayNotice notice) async {
    if (running || _starting) return;
    _starting = true;
    try {
      if (!await locationAllowed()) return;
      final LocationSettings settings = defaultTargetPlatform == TargetPlatform.android
          ? AndroidSettings(
              accuracy: LocationAccuracy.high,
              distanceFilter: moved,
              intervalDuration: every,
              foregroundNotificationConfig: ForegroundNotificationConfig(
                notificationTitle: notice.title,
                notificationText: notice.text,
                notificationChannelName: notice.title,
                enableWakeLock: true,
                setOngoing: true,
              ),
            )
          : const LocationSettings(accuracy: LocationAccuracy.high, distanceFilter: moved);
      _positions = Geolocator.getPositionStream(locationSettings: settings).listen(
        _report,
        onError: (Object e) => debugPrint('Way reporter: $e'),
      );
      // Where the rider is as they leave, without waiting to have moved
      unawaited(_reportLastKnown());
    } catch (e) {
      debugPrint('Way reporter did not start: $e');
    } finally {
      _starting = false;
    }
  }

  Future<void> _reportLastKnown() async {
    try {
      final position = await Geolocator.getLastKnownPosition();
      if (position != null && running) await _report(position);
    } catch (e) {
      debugPrint('Way reporter: $e');
    }
  }

  /// Nothing is out any more: the GPS and the notification go
  Future<void> stop() async {
    final positions = _positions;
    _positions = null;
    _lastSent = null;
    await positions?.cancel();
  }

  Future<void> _report(Position position) async {
    final now = DateTime.now();
    if (_sending || (_lastSent != null && now.difference(_lastSent!) < _gap)) return;
    _sending = true;
    _lastSent = now;
    try {
      final out = await _service().reportLocation(position.latitude, position.longitude, position.accuracy);
      // The till marked it delivered for the rider, or took it back: nothing left to tell
      if (out == 0) await stop();
    } catch (e) {
      // No signal in a lift or a garage: the next fix says it
      debugPrint('Way report not sent: $e');
    } finally {
      _sending = false;
    }
  }
}

final wayReporterProvider = Provider<WayReporter>((ref) {
  final reporter = WayReporter(() => ref.read(deliveryServiceProvider));
  ref.onDispose(reporter.stop);
  return reporter;
});

import 'dart:async';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../network/api_client.dart';
import '../providers/branch_provider.dart';
import '../providers/locale_provider.dart';

/// A push that arrives while the app is closed: Android shows it from its
/// notification part on the loud channel MainActivity made, and the list
/// is fetched again when the rider opens the app. Nothing to do here.
@pragma('vm:entry-point')
Future<void> firebaseBackgroundHandler(RemoteMessage message) async {}

/// Whether this build is registered with Firebase (google-services.json for
/// com.ninja.rider); without it there are no pushes, only the live hub.
bool get pushAvailable => Firebase.apps.isNotEmpty;

/// What a push said, for the app to act on: a delivery given to the rider,
/// or taken back
class PushEvent {
  final String type;
  final int orderId;

  /// It was tapped in the notification shade, rather than arriving with the app open
  final bool opened;

  const PushEvent(this.type, this.orderId, {this.opened = false});

  static PushEvent? of(RemoteMessage message, {bool opened = false}) {
    final type = message.data['type'];
    if (type is! String) return null;
    return PushEvent(type, int.tryParse('${message.data['orderId']}') ?? 0, opened: opened);
  }
}

/// The rider's phone on Notification.API: one registration per rider (the
/// latest phone signed in), with the language the pushes are written in.
class PushService {
  final Ref _ref;
  final _events = StreamController<PushEvent>.broadcast();
  final List<StreamSubscription> _subscriptions = [];
  bool _listening = false;

  PushService(this._ref);

  Stream<PushEvent> get events => _events.stream;

  /// Ask to ring (Android 13+), register the phone, and keep the registration current
  Future<void> register() async {
    if (!pushAvailable) return;
    try {
      final messaging = FirebaseMessaging.instance;
      final settings = await messaging.requestPermission(alert: true, badge: true, sound: true);
      _ref.read(pushPermissionProvider.notifier).set(settings.authorizationStatus);
      final token = await messaging.getToken();
      if (token != null) await _send(token);
      _listen(messaging);
    } catch (e) {
      debugPrint('Push registration failed: $e');
    }
  }

  void _listen(FirebaseMessaging messaging) {
    if (_listening) return;
    _listening = true;
    _subscriptions.add(messaging.onTokenRefresh.listen(_send));
    _subscriptions.add(FirebaseMessaging.onMessage.listen((m) {
      final event = PushEvent.of(m);
      if (event != null) _events.add(event);
    }));
    _subscriptions.add(FirebaseMessaging.onMessageOpenedApp.listen((m) {
      final event = PushEvent.of(m, opened: true);
      if (event != null) _events.add(event);
    }));
    // Opened from a notification while the app was not running at all
    messaging.getInitialMessage().then((m) {
      final event = m == null ? null : PushEvent.of(m, opened: true);
      if (event != null) _events.add(event);
    });
  }

  Future<void> _send(String token) async {
    try {
      await _ref.read(notificationsApiProvider).post<void>('subscriptions/rider-deliveries', data: {
        'fcmToken': token,
        'preferredLanguage': _ref.read(localeProvider).languageCode,
        'branchId': _ref.read(selectedBranchIdProvider),
      });
    } catch (e) {
      debugPrint('Push token not sent: $e');
    }
  }

  /// Signing out: this phone no longer rings for this rider
  Future<void> unregister() async {
    if (!pushAvailable) return;
    try {
      await _ref.read(notificationsApiProvider).delete<void>('subscriptions/rider-deliveries');
    } catch (e) {
      debugPrint('Push unregister failed: $e');
    }
    try {
      await FirebaseMessaging.instance.deleteToken();
    } catch (_) {}
  }

  void dispose() {
    for (final s in _subscriptions) {
      s.cancel();
    }
    _events.close();
  }
}

final pushServiceProvider = Provider<PushService>((ref) {
  final service = PushService(ref);
  ref.onDispose(service.dispose);
  return service;
});

/// Whether the rider let the app ring; null until asked
class PushPermissionNotifier extends Notifier<AuthorizationStatus?> {
  @override
  AuthorizationStatus? build() => null;

  void set(AuthorizationStatus status) => state = status;
}

final pushPermissionProvider = NotifierProvider<PushPermissionNotifier, AuthorizationStatus?>(PushPermissionNotifier.new);

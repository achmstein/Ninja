import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:signalr_netcore/signalr_client.dart';
import '../auth/auth_service.dart';
import '../config.dart';

/// The business's realtime hub (`/hub/notifications`), kept open while the
/// app wants it: reconnected after a drop, and reopened later when automatic
/// reconnect gives up (the Wi-Fi out for minutes while the app sits in front).
/// Each app names the events it listens to, and may join groups once
/// connected ([onConnected]); every event arrives as a map on [on].
class HubClient {
  final Ref _ref;
  final List<String> _events;

  /// Run after every (re)connection: the groups the app asks to be in
  final Future<void> Function(HubConnection hub)? onConnected;

  HubConnection? _hubConnection;
  bool _isConnecting = false;

  /// Set from connect() until disconnect(): the app wants a hub. A hub that
  /// closes on its own is reopened only while this holds.
  bool _wanted = false;
  Timer? _retry;
  static const _retryAfter = Duration(seconds: 30);

  final Map<String, StreamController<Map<String, dynamic>>> _streams;
  final _reconnected = StreamController<void>.broadcast();

  HubClient(this._ref, List<String> events, {this.onConnected})
      : _events = List.unmodifiable(events),
        _streams = {for (final e in events) e: StreamController<Map<String, dynamic>>.broadcast()};

  /// One event's payloads (an empty map for an event that carries none)
  Stream<Map<String, dynamic>> on(String event) =>
      (_streams[event] ?? (throw ArgumentError('Not an event this hub listens to: $event'))).stream;

  /// A new connection after a drop: anything missed while offline must be refetched
  Stream<void> get onReconnected => _reconnected.stream;

  /// Connect to the hub
  Future<void> connect() async {
    if (_hubConnection != null || _isConnecting) return;
    _isConnecting = true;
    _wanted = true;

    try {
      final hubUrl = '${CoreEndpoints.bffBaseUrl}/hub/notifications';

      _hubConnection = HubConnectionBuilder()
          .withUrl(
            hubUrl,
            options: HttpConnectionOptions(
              accessTokenFactory: () async {
                final authService = _ref.read(authServiceProvider.notifier);
                return await authService.getAccessToken() ?? '';
              },
            ),
          )
          .withAutomaticReconnect(retryDelays: [2000, 5000, 10000, 20000, 30000, 60000])
          .build();

      for (final event in _events) {
        _register(event, _streams[event]!);
      }

      final hub = _hubConnection!;
      hub.onclose(({error}) {
        debugPrint('SignalR connection closed: $error');
        // Automatic reconnect gave up: schedule a fresh connection, since no
        // resume may come to reopen it. A close we asked for has already been
        // replaced (or cleared) and is left alone.
        if (!identical(_hubConnection, hub)) return;
        _hubConnection = null;
        _scheduleRetry();
      });

      hub.onreconnecting(({error}) {
        debugPrint('SignalR reconnecting: $error');
      });

      hub.onreconnected(({connectionId}) {
        debugPrint('SignalR reconnected: $connectionId');
        // A new connection id is in no group yet: join again, then refetch what was missed
        unawaited(_joined(hub).then((_) => _reconnected.add(null)));
      });

      await hub.start();
      debugPrint('SignalR connected to $hubUrl');
      await _joined(hub);
      _retry?.cancel();
      _retry = null;
    } catch (e) {
      debugPrint('SignalR connection failed: $e');
      _hubConnection = null;
      _scheduleRetry();
    } finally {
      _isConnecting = false;
    }
  }

  Future<void> _joined(HubConnection hub) async {
    final join = onConnected;
    if (join == null) return;
    try {
      await join(hub);
    } catch (e) {
      debugPrint('SignalR group join failed: $e');
    }
  }

  void _register(String method, StreamController<Map<String, dynamic>> sink) {
    _hubConnection!.on(method, (arguments) {
      if (arguments == null || arguments.isEmpty) {
        // Some events carry no payload; the listener only needs the nudge
        sink.add(const {});
        return;
      }
      final data = arguments[0];
      if (data is Map<String, dynamic>) {
        sink.add(data);
      } else if (data is Map) {
        sink.add(Map<String, dynamic>.from(data));
      } else {
        sink.add(const {});
      }
    });
  }

  /// Try again a little later, once, unless the app no longer wants a hub
  void _scheduleRetry() {
    if (!_wanted || _retry != null) return;
    _retry = Timer(_retryAfter, () {
      _retry = null;
      unawaited(reconnectIfNeeded());
    });
  }

  /// Reconnect if the connection was lost: after the app resumed from the
  /// background, after the network came back, or from the retry timer
  Future<void> reconnectIfNeeded() async {
    if (!_wanted || _isConnecting) return;
    if (_hubConnection == null) {
      await connect();
      return;
    }
    if (_hubConnection!.state == HubConnectionState.Connected) return;

    // Connection is dead: tear down and reconnect fresh. Clearing the field
    // first tells the close handler this stop is ours.
    final stale = _hubConnection!;
    _hubConnection = null;
    try {
      await stale.stop();
    } catch (_) {}
    await connect();
  }

  /// Disconnect from the hub
  Future<void> disconnect() async {
    _wanted = false;
    _retry?.cancel();
    _retry = null;
    final hub = _hubConnection;
    _hubConnection = null;
    try {
      await hub?.stop();
    } catch (e) {
      debugPrint('SignalR disconnect error: $e');
    }
  }

  /// Dispose all resources
  void dispose() {
    unawaited(disconnect());
    for (final stream in _streams.values) {
      unawaited(stream.close());
    }
    unawaited(_reconnected.close());
  }
}

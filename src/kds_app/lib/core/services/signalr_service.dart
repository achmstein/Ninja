import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:signalr_netcore/signalr_client.dart';
import '../auth/auth_service.dart';
import '../config/app_config.dart';

/// SignalR connection service for realtime board updates — the same hub
/// and group kds_web's use-kitchen-notifications joins.
class SignalRService {
  final Ref _ref;
  HubConnection? _hubConnection;
  bool _isConnecting = false;

  /// Set from connect() until disconnect(): the app wants a hub. A hub that
  /// closes on its own is reopened only while this holds.
  bool _wanted = false;
  Timer? _retry;
  static const _retryAfter = Duration(seconds: 30);

  final _orderStatusChanged = StreamController<Map<String, dynamic>>.broadcast();
  final _branchSettingsChanged = StreamController<Map<String, dynamic>>.broadcast();
  final _reconnected = StreamController<void>.broadcast();

  /// An order was confirmed, prepared, cancelled… — the board refetches
  Stream<Map<String, dynamic>> get onOrderStatusChanged => _orderStatusChanged.stream;
  Stream<Map<String, dynamic>> get onBranchSettingsChanged => _branchSettingsChanged.stream;

  /// A new connection id after a drop: anything missed while offline must be refetched
  Stream<void> get onReconnected => _reconnected.stream;

  SignalRService(this._ref);

  /// Connect to the SignalR hub
  Future<void> connect() async {
    if (_hubConnection != null || _isConnecting) return;
    _isConnecting = true;
    _wanted = true;

    try {
      final hubUrl = '${AppConfig.bffBaseUrl}/hub/notifications';

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

      _register('OrderStatusChanged', _orderStatusChanged);
      _register('BranchSettingsChanged', _branchSettingsChanged);

      final hub = _hubConnection!;
      hub.onclose(({error}) {
        debugPrint('SignalR connection closed: $error');
        // Automatic reconnect gave up: the café Wi-Fi was out for minutes.
        // A kiosk never leaves the foreground, so no resume will reopen the
        // hub — schedule it here. A close we asked for has already been
        // replaced (or cleared) and is left alone.
        if (!identical(_hubConnection, hub)) return;
        _hubConnection = null;
        _scheduleRetry();
      });

      _hubConnection!.onreconnecting(({error}) {
        debugPrint('SignalR reconnecting: $error');
      });

      _hubConnection!.onreconnected(({connectionId}) {
        debugPrint('SignalR reconnected: $connectionId');
        // Re-join the group after reconnect, then let the app refetch everything
        _joinGroups().then((_) => _reconnected.add(null));
      });

      await _hubConnection!.start();
      debugPrint('SignalR connected to $hubUrl');
      _retry?.cancel();
      _retry = null;

      await _joinGroups();
    } catch (e) {
      debugPrint('SignalR connection failed: $e');
      _hubConnection = null;
      _scheduleRetry();
    } finally {
      _isConnecting = false;
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

  /// The admin group is where order lifecycle events are broadcast; it is
  /// gated by the same Pos policy that guards the kitchen endpoints
  Future<void> _joinGroups() async {
    try {
      await _hubConnection?.invoke('JoinAdminGroup');
    } catch (e) {
      debugPrint('Failed to join SignalR group: $e');
    }
  }

  /// Try again a little later, once, unless the app no longer wants a hub
  void _scheduleRetry() {
    if (!_wanted || _retry != null) return;
    _retry = Timer(_retryAfter, () {
      _retry = null;
      reconnectIfNeeded();
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

    // Connection is dead — tear down and reconnect fresh. Clearing the field
    // first tells the close handler this stop is ours.
    final stale = _hubConnection!;
    _hubConnection = null;
    try { await stale.stop(); } catch (_) {}
    await connect();
  }

  /// Disconnect from the SignalR hub
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
    disconnect();
    _orderStatusChanged.close();
    _branchSettingsChanged.close();
    _reconnected.close();
  }
}

/// SignalR service provider
final signalRServiceProvider = Provider<SignalRService>((ref) {
  final service = SignalRService(ref);
  ref.onDispose(() => service.dispose());
  return service;
});

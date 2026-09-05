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

      _hubConnection!.onclose(({error}) {
        debugPrint('SignalR connection closed: $error');
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

      await _joinGroups();
    } catch (e) {
      debugPrint('SignalR connection failed: $e');
      _hubConnection = null;
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

  /// Reconnect if the connection was lost (e.g. after app resumed from background)
  Future<void> reconnectIfNeeded() async {
    if (_isConnecting) return;
    if (_hubConnection == null) {
      await connect();
      return;
    }
    if (_hubConnection!.state == HubConnectionState.Connected) return;

    // Connection is dead — tear down and reconnect fresh
    try { await _hubConnection?.stop(); } catch (_) {}
    _hubConnection = null;
    await connect();
  }

  /// Disconnect from the SignalR hub
  Future<void> disconnect() async {
    try {
      await _hubConnection?.stop();
    } catch (e) {
      debugPrint('SignalR disconnect error: $e');
    }
    _hubConnection = null;
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

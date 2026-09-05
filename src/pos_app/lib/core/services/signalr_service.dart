import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:signalr_netcore/signalr_client.dart';
import '../auth/auth_service.dart';
import '../config/app_config.dart';

/// SignalR connection service for realtime till updates — the same hub and
/// groups pos_web's use-pos-notifications joins.
class SignalRService {
  final Ref _ref;
  HubConnection? _hubConnection;
  bool _isConnecting = false;

  // Event streams for different update types
  final _roomStatusChanged = StreamController<Map<String, dynamic>>.broadcast();
  final _orderStatusChanged = StreamController<Map<String, dynamic>>.broadcast();
  final _serviceRequestCreated = StreamController<Map<String, dynamic>>.broadcast();
  final _branchSettingsChanged = StreamController<Map<String, dynamic>>.broadcast();
  final _ticketUpdated = StreamController<Map<String, dynamic>>.broadcast();
  final _catalogChanged = StreamController<Map<String, dynamic>>.broadcast();
  final _reconnected = StreamController<void>.broadcast();

  Stream<Map<String, dynamic>> get onRoomStatusChanged => _roomStatusChanged.stream;
  Stream<Map<String, dynamic>> get onOrderStatusChanged => _orderStatusChanged.stream;
  Stream<Map<String, dynamic>> get onServiceRequestCreated => _serviceRequestCreated.stream;
  Stream<Map<String, dynamic>> get onBranchSettingsChanged => _branchSettingsChanged.stream;

  /// A ticket opened, changed or settled — the floor and ticket screens refetch
  Stream<Map<String, dynamic>> get onTicketUpdated => _ticketUpdated.stream;

  /// An item was marked sold out (or back) somewhere else
  Stream<Map<String, dynamic>> get onCatalogChanged => _catalogChanged.stream;

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

      _register('RoomStatusChanged', _roomStatusChanged);
      _register('OrderStatusChanged', _orderStatusChanged);
      _register('ServiceRequestCreated', _serviceRequestCreated);
      _register('BranchSettingsChanged', _branchSettingsChanged);
      _register('TicketUpdated', _ticketUpdated);
      _register('CatalogChanged', _catalogChanged);

      _hubConnection!.onclose(({error}) {
        debugPrint('SignalR connection closed: $error');
      });

      _hubConnection!.onreconnecting(({error}) {
        debugPrint('SignalR reconnecting: $error');
      });

      _hubConnection!.onreconnected(({connectionId}) {
        debugPrint('SignalR reconnected: $connectionId');
        // Re-join groups after reconnect, then let the app refetch everything
        _joinGroups().then((_) => _reconnected.add(null));
      });

      await _hubConnection!.start();
      debugPrint('SignalR connected to $hubUrl');

      // Join admin and rooms groups on connect
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

  Future<void> _joinGroups() async {
    try {
      await _hubConnection?.invoke('JoinRoomsGroup');
      await _hubConnection?.invoke('JoinAdminGroup');
    } catch (e) {
      debugPrint('Failed to join SignalR groups: $e');
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
    _roomStatusChanged.close();
    _orderStatusChanged.close();
    _serviceRequestCreated.close();
    _branchSettingsChanged.close();
    _ticketUpdated.close();
    _catalogChanged.close();
    _reconnected.close();
  }
}

/// SignalR service provider
final signalRServiceProvider = Provider<SignalRService>((ref) {
  final service = SignalRService(ref);
  ref.onDispose(() => service.dispose());
  return service;
});

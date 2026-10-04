import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ninja_app_core/services/hub_client.dart';

/// The kitchen display's realtime hub. Order lifecycle events are broadcast
/// to the admin group, gated by the same Pos policy that guards the kitchen
/// endpoints; it is joined again after every reconnection.
class SignalRService extends HubClient {
  SignalRService(Ref ref)
      : super(
          ref,
          const ['OrderStatusChanged', 'BranchSettingsChanged'],
          onConnected: (hub) => hub.invoke('JoinAdminGroup'),
        );

  Stream<Map<String, dynamic>> get onOrderStatusChanged => on('OrderStatusChanged');
  Stream<Map<String, dynamic>> get onBranchSettingsChanged => on('BranchSettingsChanged');
}

/// SignalR service provider
final signalRServiceProvider = Provider<SignalRService>((ref) {
  final service = SignalRService(ref);
  ref.onDispose(service.dispose);
  return service;
});

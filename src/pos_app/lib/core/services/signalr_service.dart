import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ninja_app_core/services/hub_client.dart';

/// The till's realtime hub: the same hub and groups pos_web's
/// use-pos-notifications joins (the rooms group and the admin group), joined
/// again after every reconnection.
class SignalRService extends HubClient {
  SignalRService(Ref ref)
      : super(
          ref,
          const [
            'RoomStatusChanged',
            'OrderStatusChanged',
            'ServiceRequestCreated',
            'BranchSettingsChanged',
            'TicketUpdated',
            'CatalogChanged',
            'DeliveryChanged',
          ],
          onConnected: (hub) async {
            await hub.invoke('JoinRoomsGroup');
            await hub.invoke('JoinAdminGroup');
          },
        );

  Stream<Map<String, dynamic>> get onRoomStatusChanged => on('RoomStatusChanged');
  Stream<Map<String, dynamic>> get onOrderStatusChanged => on('OrderStatusChanged');
  Stream<Map<String, dynamic>> get onServiceRequestCreated => on('ServiceRequestCreated');
  Stream<Map<String, dynamic>> get onBranchSettingsChanged => on('BranchSettingsChanged');

  /// A ticket opened, changed or settled — the floor and ticket screens refetch
  Stream<Map<String, dynamic>> get onTicketUpdated => on('TicketUpdated');

  /// An item was marked sold out (or back) somewhere else
  Stream<Map<String, dynamic>> get onCatalogChanged => on('CatalogChanged');

  /// A delivery given to a rider, out of the door, delivered, its cash in
  Stream<Map<String, dynamic>> get onDeliveryChanged => on('DeliveryChanged');
}

/// SignalR service provider
final signalRServiceProvider = Provider<SignalRService>((ref) {
  final service = SignalRService(ref);
  ref.onDispose(service.dispose);
  return service;
});

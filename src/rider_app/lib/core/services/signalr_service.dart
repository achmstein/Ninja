import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ninja_app_core/services/hub_client.dart';

/// The rider's realtime hub. The rider joins no group of their own asking:
/// the hub puts every connection in its account's `user:{sub}` group, which
/// is where DeliveryChanged is sent.
class SignalRService extends HubClient {
  SignalRService(Ref ref) : super(ref, const ['DeliveryChanged', 'BranchSettingsChanged']);

  /// A delivery given to this rider, taken back, or moved on: the list refetches
  Stream<Map<String, dynamic>> get onDeliveryChanged => on('DeliveryChanged');
  Stream<Map<String, dynamic>> get onBranchSettingsChanged => on('BranchSettingsChanged');
}

/// SignalR service provider
final signalRServiceProvider = Provider<SignalRService>((ref) {
  final service = SignalRService(ref);
  ref.onDispose(service.dispose);
  return service;
});

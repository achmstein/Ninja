import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../models/service_request.dart';

/// Abstract repository for service request operations
abstract class ServiceRequestsRepository {
  Future<List<ServiceRequest>> getPendingRequests();
  Future<void> acknowledgeRequest(int requestId);
  Future<void> completeRequest(int requestId);
}

/// API implementation of ServiceRequestsRepository
class ApiServiceRequestsRepository implements ServiceRequestsRepository {
  final ApiClient _api;

  ApiServiceRequestsRepository(this._api);

  @override
  Future<List<ServiceRequest>> getPendingRequests() async {
    final response =
        await _api.get<List<dynamic>>('service-requests/pending');

    return (response.data ?? [])
        .map((e) => ServiceRequest.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<void> acknowledgeRequest(int requestId) async {
    await _api.put('service-requests/$requestId/acknowledge');
  }

  @override
  Future<void> completeRequest(int requestId) async {
    await _api.put('service-requests/$requestId/complete');
  }
}

/// Provider for ServiceRequestsRepository
final serviceRequestsRepositoryProvider =
    Provider<ServiceRequestsRepository>((ref) =>
        ApiServiceRequestsRepository(ref.read(notificationsApiProvider)));

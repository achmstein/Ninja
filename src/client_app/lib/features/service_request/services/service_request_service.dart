import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../models/service_request.dart';

/// Abstract interface for service request operations
abstract class ServiceRequestRepository {
  Future<ServiceRequestResponse> createRequest(CreateServiceRequest request);

  /// The customer's own requests, with where the staff have put them
  Future<List<ServiceRequestResponse>> getMine();

  /// Takes a request back while it is only sent; a 409 means someone already picked it up
  Future<void> cancel(int id);
}

/// Service request repository implementation using API client
class ApiServiceRequestRepository implements ServiceRequestRepository {
  final ApiClient _apiClient;

  ApiServiceRequestRepository(this._apiClient);

  /// Create a new service request
  @override
  Future<ServiceRequestResponse> createRequest(CreateServiceRequest request) async {
    final response = await _apiClient.post<Map<String, dynamic>>(
      'service-requests',
      data: request.toJson(),
    );

    return ServiceRequestResponse.fromJson(response.data!);
  }

  @override
  Future<List<ServiceRequestResponse>> getMine() async {
    final response = await _apiClient.get<List<dynamic>>('service-requests/mine');
    return [for (final json in response.data ?? const []) ServiceRequestResponse.fromJson(json as Map<String, dynamic>)];
  }

  @override
  Future<void> cancel(int id) => _apiClient.delete('service-requests/$id');
}

/// Provider for service request repository
final serviceRequestRepositoryProvider = Provider<ServiceRequestRepository>((ref) {
  final apiClient = ref.watch(notificationsApiProvider);
  return ApiServiceRequestRepository(apiClient);
});

/// State for tracking request submission
class ServiceRequestState {
  final bool isLoading;
  final String? error;
  final ServiceRequestResponse? lastRequest;

  const ServiceRequestState({
    this.isLoading = false,
    this.error,
    this.lastRequest,
  });

  ServiceRequestState copyWith({
    bool? isLoading,
    String? error,
    ServiceRequestResponse? lastRequest,
  }) {
    return ServiceRequestState(
      isLoading: isLoading ?? this.isLoading,
      error: error,
      lastRequest: lastRequest ?? this.lastRequest,
    );
  }
}

/// Notifier for managing service request state
class ServiceRequestNotifier extends Notifier<ServiceRequestState> {
  late ServiceRequestRepository _service;

  @override
  ServiceRequestState build() {
    _service = ref.watch(serviceRequestRepositoryProvider);
    return const ServiceRequestState();
  }

  /// Submit a service request
  Future<bool> submitRequest(CreateServiceRequest request) async {
    state = state.copyWith(isLoading: true, error: null);

    try {
      final response = await _service.createRequest(request);
      state = state.copyWith(isLoading: false, lastRequest: response);
      return true;
    } on DioException catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: e.response?.statusCode == 400 ? 'cooldown' : 'error',
      );
      return false;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: 'error',
      );
      return false;
    }
  }

  /// Clear any error state
  void clearError() {
    state = state.copyWith(error: null);
  }
}

/// Provider for service request notifier
final serviceRequestProvider =
    NotifierProvider<ServiceRequestNotifier, ServiceRequestState>(ServiceRequestNotifier.new);

/// The customer's requests, as the staff have them (client_web's
/// service-requests.ts): read while something shows them, and again every
/// 15 seconds, so a tile goes from sent to on the way without a tap. A
/// request sent or taken back shows at once, then the server's list confirms it.
class MyRequestsNotifier extends Notifier<List<ServiceRequestResponse>> {
  Timer? _poll;

  @override
  List<ServiceRequestResponse> build() {
    ref.onDispose(() => _poll?.cancel());
    _poll = Timer.periodic(const Duration(seconds: 15), (_) => refresh());
    refresh();
    return const [];
  }

  Future<void> refresh() async {
    try {
      state = await ref.read(serviceRequestRepositoryProvider).getMine();
    } catch (_) {
      // The list stays as it was; the next poll tries again
    }
  }

  /// Sent: shown at once
  void add(ServiceRequestResponse request) => state = [request, ...state.where((r) => r.id != request.id)];

  /// Taken back: gone at once
  void remove(int id) => state = state.where((r) => r.id != id).toList();
}

/// While nothing shows them, the requests are not read
final myRequestsProvider = NotifierProvider.autoDispose<MyRequestsNotifier, List<ServiceRequestResponse>>(MyRequestsNotifier.new);

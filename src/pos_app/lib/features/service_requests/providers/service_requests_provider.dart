import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/config/app_config.dart';
import '../../../core/providers/branch_provider.dart';
import '../models/service_request.dart';
import '../services/service_requests_service.dart';

/// State for service requests
class ServiceRequestsState {
  final List<ServiceRequest> requests;
  final bool isLoading;
  final String? error;

  const ServiceRequestsState({
    this.requests = const [],
    this.isLoading = false,
    this.error,
  });

  ServiceRequestsState copyWith({
    List<ServiceRequest>? requests,
    bool? isLoading,
    String? error,
  }) {
    return ServiceRequestsState(
      requests: requests ?? this.requests,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }

  /// Get pending requests only
  List<ServiceRequest> get pendingRequests =>
      requests.where((r) => r.status == ServiceRequestStatus.pending).toList();

  /// Get acknowledged requests
  List<ServiceRequest> get acknowledgedRequests =>
      requests.where((r) => r.status == ServiceRequestStatus.acknowledged).toList();
}

/// Service requests notifier
class ServiceRequestsNotifier extends Notifier<ServiceRequestsState> {
  late ServiceRequestsRepository _repository;
  Timer? _poll;

  @override
  ServiceRequestsState build() {
    ref.watch(selectedBranchIdProvider);
    _repository = ref.read(serviceRequestsRepositoryProvider);
    Future.microtask(() => loadRequests());
    // The hub's ServiceRequestCreated nudge is the primary path; the poll
    // is the fallback for a silently dead socket
    _poll?.cancel();
    _poll = Timer.periodic(AppConfig.serviceRequestsPoll, (_) => refresh());
    ref.onDispose(() => _poll?.cancel());
    return const ServiceRequestsState(isLoading: true);
  }

  /// Refetch without flashing the loading state
  Future<void> refresh() async {
    try {
      final requests = await _repository.getPendingRequests();
      if (!ref.mounted) return;
      state = state.copyWith(requests: requests, isLoading: false);
    } catch (e) {
      debugPrint('Failed to refresh service requests: $e');
    }
  }

  /// Load pending service requests
  Future<void> loadRequests() async {
    state = state.copyWith(isLoading: true, error: null);

    try {
      final requests = await _repository.getPendingRequests();

      state = state.copyWith(requests: requests, isLoading: false);
    } catch (e) {
      debugPrint('Failed to load service requests: $e');
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  /// Acknowledge a service request
  Future<bool> acknowledgeRequest(int requestId) async {
    try {
      await _repository.acknowledgeRequest(requestId);
      await loadRequests(); // Refresh list
      return true;
    } catch (e) {
      debugPrint('Failed to acknowledge request: $e');
      return false;
    }
  }

  /// Complete a service request
  Future<bool> completeRequest(int requestId) async {
    try {
      await _repository.completeRequest(requestId);
      await loadRequests(); // Refresh list
      return true;
    } catch (e) {
      debugPrint('Failed to complete request: $e');
      return false;
    }
  }
}

/// Provider for service requests
final serviceRequestsProvider =
    NotifierProvider<ServiceRequestsNotifier, ServiceRequestsState>(ServiceRequestsNotifier.new);

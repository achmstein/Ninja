import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/config/app_config.dart';
import '../../../core/providers/branch_provider.dart';
import '../models/place.dart';
import '../services/place_service.dart';

/// Rooms state
class PlacesState {
  final bool isLoading;
  final String? error;
  final List<Place> places;
  final List<Stay> openStays;
  final List<Stay>? stayHistory;
  final bool isLoadingHistory;
  final bool hasMoreHistory;
  final int historyPage;

  const PlacesState({
    this.isLoading = false,
    this.error,
    this.places = const [],
    this.openStays = const [],
    this.stayHistory,
    this.isLoadingHistory = false,
    this.hasMoreHistory = false,
    this.historyPage = 0,
  });

  PlacesState copyWith({
    bool? isLoading,
    String? error,
    List<Place>? places,
    List<Stay>? openStays,
    List<Stay>? stayHistory,
    bool? isLoadingHistory,
    bool? hasMoreHistory,
    int? historyPage,
  }) {
    return PlacesState(
      isLoading: isLoading ?? this.isLoading,
      error: error,
      places: places ?? this.places,
      openStays: openStays ?? this.openStays,
      stayHistory: stayHistory ?? this.stayHistory,
      isLoadingHistory: isLoadingHistory ?? this.isLoadingHistory,
      hasMoreHistory: hasMoreHistory ?? this.hasMoreHistory,
      historyPage: historyPage ?? this.historyPage,
    );
  }
}

/// Rooms provider
class PlacesNotifier extends Notifier<PlacesState> {
  late PlaceRepository _repository;

  Timer? _poll;

  @override
  PlacesState build() {
    ref.watch(selectedBranchIdProvider);
    _repository = ref.read(placeRepositoryProvider);
    Future.microtask(() => loadPlaces());
    // The hub's RoomStatusChanged nudge is the primary path; the poll is
    // the fallback for a silently dead socket
    _poll?.cancel();
    _poll = Timer.periodic(AppConfig.roomsPoll, (_) => refresh());
    ref.onDispose(() => _poll?.cancel());
    return const PlacesState(isLoading: true);
  }

  /// Refetch without flashing the loading state
  Future<void> refresh() async {
    try {
      final result = await _repository.loadPlaces();
      if (!ref.mounted) return;
      state = state.copyWith(isLoading: false, places: result.places, openStays: result.openStays);
    } catch (e) {
      debugPrint('Failed to  places: $e');
    }
  }

  Future<void> loadPlaces() async {
    state = state.copyWith(isLoading: true, error: null);

    try {
      final result = await _repository.loadPlaces();

      state = state.copyWith(
        isLoading: false,
        places: result.places,
        openStays: result.openStays,
      );
    } catch (e) {
      debugPrint('Failed to  places: $e');
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<bool> holdPlace(int roomId) async {
    try {
      await _repository.holdPlace(roomId);
      await loadPlaces();
      return true;
    } catch (e) {
      debugPrint('Failed to reserve room: $e');
      return false;
    }
  }

  Future<bool> startStay(int sessionId, {String? optionCode}) async {
    try {
      await _repository.startStay(sessionId, optionCode: optionCode);
      await loadPlaces();
      return true;
    } catch (e) {
      debugPrint('Failed to start session: $e');
      return false;
    }
  }

  Future<bool> endStay(int sessionId) async {
    try {
      await _repository.endStay(sessionId);
      await loadPlaces();
      return true;
    } catch (e) {
      debugPrint('Failed to end session: $e');
      return false;
    }
  }

  Future<bool> cancelStay(int sessionId) async {
    try {
      await _repository.cancelStay(sessionId);
      await loadPlaces();
      return true;
    } catch (e) {
      debugPrint('Failed to cancel session: $e');
      return false;
    }
  }




  /// Assign a customer to an active walk-in session
  Future<bool> assignStayCustomer(int sessionId, String customerId, String? customerName) async {
    try {
      await _repository.assignStayCustomer(sessionId, customerId, customerName);
      await loadPlaces();
      return true;
    } catch (e) {
      debugPrint('Failed to assign customer to session: $e');
      return false;
    }
  }

  /// Add a member to an active session
  Future<bool> addStayMember(int sessionId, String customerId, String? customerName) async {
    try {
      await _repository.addStayMember(sessionId, customerId, customerName);
      await loadPlaces();
      return true;
    } catch (e) {
      debugPrint('Failed to add member to session: $e');
      return false;
    }
  }

  /// Remove a member from an active session
  Future<bool> removeStayMember(int sessionId, String customerId) async {
    try {
      await _repository.removeStayMember(sessionId, customerId);
      await loadPlaces();
      return true;
    } catch (e) {
      debugPrint('Failed to remove member from session: $e');
      return false;
    }
  }

  /// Switch a running stay to another rate option
  Future<bool> changeOption(int sessionId, String optionCode) async {
    try {
      await _repository.changeOption(sessionId, optionCode);
      await loadPlaces();
      return true;
    } catch (e) {
      debugPrint('Failed to change rate option: $e');
      return false;
    }
  }

  /// The customer arrived: starts the clock when the hold asked for it
  Future<bool> confirmStay(int sessionId) async {
    try {
      await _repository.confirmStay(sessionId);
      await loadPlaces();
      return true;
    } catch (e) {
      debugPrint('Failed to confirm arrival: $e');
      return false;
    }
  }

  /// Start a walk-in directly (without a hold)
  Future<bool> startWalkIn(int roomId, {String? optionCode}) async {
    try {
      await _repository.startWalkIn(roomId, optionCode: optionCode);
      await loadPlaces();
      return true;
    } catch (e) {
      debugPrint('Failed to start walk-in session: $e');
      return false;
    }
  }

  static const int _historyPageSize = 20;

  /// Load session history for a specific room
  Future<void> loadStayHistory(int roomId, {bool loadMore = false}) async {
    final currentPage = loadMore ? state.historyPage + 1 : 0;
    final currentHistory = loadMore ? (state.stayHistory ?? []) : <Stay>[];

    state = state.copyWith(
      isLoadingHistory: true,
      stayHistory: loadMore ? currentHistory : null,
      historyPage: currentPage,
    );

    try {
      final newHistory = await _repository.getStayHistory(roomId, limit: _historyPageSize);

      state = state.copyWith(
        isLoadingHistory: false,
        stayHistory: [...currentHistory, ...newHistory],
        hasMoreHistory: newHistory.length >= _historyPageSize,
      );
    } catch (e) {
      state = state.copyWith(
        isLoadingHistory: false,
        stayHistory: currentHistory.isEmpty ? [] : currentHistory,
        hasMoreHistory: false,
      );
    }
  }

  /// Clear session history when closing detail sheet
  void clearSessionHistory() {
    state = state.copyWith(stayHistory: null);
  }
}

/// Rooms provider
final placesProvider = NotifierProvider<PlacesNotifier, PlacesState>(PlacesNotifier.new);

/// One session by id, whatever its state. The active list stops carrying a
/// session the moment it ends, but the ticket keeps reading it until the
/// bill is settled: the people in the room are still being named, and
/// their shares still go on their tabs. Polled like the places; session
/// actions invalidate it.
final stayProvider = FutureProvider.autoDispose.family<Stay?, int>((ref, id) async {
  final timer = Timer(AppConfig.roomsPoll, () => ref.invalidateSelf());
  ref.onDispose(timer.cancel);
  return ref.read(placeRepositoryProvider).getStay(id);
});

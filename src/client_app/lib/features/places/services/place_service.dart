import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../../../core/providers/branch_provider.dart';
import '../models/place.dart';

/// The bookable places of the branch, the customer's reservations and
/// their stays
abstract class PlaceRepository {
  /// Every bookable place of the branch that takes customers: the rooms and
  /// stations with a clock, and any table the owner opened to reservations
  Future<List<Place>> getPlaces();

  /// One place, whatever it is — the anonymous read a scanned code starts with
  Future<Place> getPlace(int id);

  /// Reserve a place for now; the customer has 10 minutes to arrive
  Future<int> holdPlace(int roomId, {bool startOnConfirm = false, String? optionCode});
  Future<List<Stay>> getMyStays();
  Future<List<Reservation>> getMyReservations();
  Future<void> cancelHold(int reservationId);
  Future<void> leaveStay(int sessionId);
  Future<PlaceScanResult> scanPlace(int roomId);
  Future<JoinStayResult> joinStay(int roomId);
}

/// API-backed repository over /api/places, /api/reservations and /api/stays
class ApiPlaceRepository implements PlaceRepository {
  final ApiClient _places;
  final ApiClient _reservations;
  final ApiClient _stays;

  ApiPlaceRepository(this._places, this._reservations, this._stays);

  @override
  Future<List<Place>> getPlaces() async {
    final response = await _places.get<List<dynamic>>('');
    return (response.data ?? [])
        .map((e) => Place.fromJson(e as Map<String, dynamic>))
        .where((p) => p.isActive && (p.isTimed || p.reservable))
        .toList();
  }

  @override
  Future<Place> getPlace(int id) async {
    final response = await _places.get<Map<String, dynamic>>('$id');
    return Place.fromJson(response.data!);
  }

  @override
  Future<int> holdPlace(int roomId, {bool startOnConfirm = false, String? optionCode}) async {
    final response = await _reservations.post<int>(
      '',
      // The rate to start at, when the clock starts on Confirm
      data: {'placeId': roomId, 'startOnConfirm': startOnConfirm, 'optionCode': optionCode},
    );
    return response.data!;
  }

  @override
  Future<List<Stay>> getMyStays() async {
    final response = await _stays.get<List<dynamic>>('my');
    return (response.data ?? [])
        .map((e) => Stay.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<List<Reservation>> getMyReservations() async {
    final response = await _reservations.get<List<dynamic>>('my');
    return (response.data ?? [])
        .map((e) => Reservation.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<void> cancelHold(int reservationId) async {
    await _reservations.post('my/$reservationId/cancel');
  }

  @override
  Future<void> leaveStay(int sessionId) async {
    await _stays.post('$sessionId/leave');
  }

  @override
  Future<PlaceScanResult> scanPlace(int roomId) async {
    final response = await _places.get<Map<String, dynamic>>('$roomId/scan');
    return PlaceScanResult.fromJson(response.data!);
  }

  @override
  Future<JoinStayResult> joinStay(int roomId) async {
    final response = await _places.post<Map<String, dynamic>>('$roomId/join');
    return JoinStayResult.fromJson(response.data!);
  }
}

/// Provider for room repository
final placeRepositoryProvider = Provider<PlaceRepository>((ref) {
  return ApiPlaceRepository(
    ref.watch(placesApiProvider),
    ref.watch(reservationsApiProvider),
    ref.watch(staysApiProvider),
  );
});

/// Provider for the branch's bookable places — keyed by branch ID for clean state per branch
final placesProvider = FutureProvider.family<List<Place>, int>((ref, branchId) async {
  final service = ref.watch(placeRepositoryProvider);
  return service.getPlaces();
});

/// Provider for customer stays
final myStaysProvider = NotifierProvider<MyStaysNotifier, AsyncValue<List<Stay>>>(MyStaysNotifier.new);

/// Provider for the customer's reservations
final myReservationsProvider =
    NotifierProvider<MyReservationsNotifier, AsyncValue<List<Reservation>>>(MyReservationsNotifier.new);

/// Stays notifier - refreshes on demand (app resume, screen focus,
/// pull-to-refresh). The reservations ride along: every screen that asks
/// for fresh stays is asking what is happening with this customer in the
/// café, and a reservation that just got seated is part of that answer.
class MyStaysNotifier extends Notifier<AsyncValue<List<Stay>>> {
  late PlaceRepository _roomService;

  @override
  AsyncValue<List<Stay>> build() {
    ref.watch(selectedBranchIdProvider);
    _roomService = ref.watch(placeRepositoryProvider);
    _loadStays();
    return const AsyncValue.loading();
  }

  Future<void> _loadStays({bool silent = false}) async {
    if (!silent) {
      state = const AsyncValue.loading();
    }

    try {
      final sessions = await _roomService.getMyStays();
      state = AsyncValue.data(sessions);
    } catch (e, st) {
      if (!silent) {
        state = AsyncValue.error(e, st);
      }
    }
  }

  /// Refresh (silent - no loading indicator)
  Future<void> refresh() async {
    await Future.wait([
      _loadStays(silent: true),
      ref.read(myReservationsProvider.notifier).refresh(),
    ]);
  }

  /// Force refresh with loading indicator
  Future<void> forceRefresh() async {
    await Future.wait([
      _loadStays(silent: false),
      ref.read(myReservationsProvider.notifier).refresh(),
    ]);
  }
}

/// Reservations notifier: the customer's open reservation and their history
class MyReservationsNotifier extends Notifier<AsyncValue<List<Reservation>>> {
  late PlaceRepository _roomService;

  @override
  AsyncValue<List<Reservation>> build() {
    ref.watch(selectedBranchIdProvider);
    _roomService = ref.watch(placeRepositoryProvider);
    _load();
    return const AsyncValue.loading();
  }

  Future<void> _load() async {
    try {
      final reservations = await _roomService.getMyReservations();
      state = AsyncValue.data(reservations);
    } catch (e, st) {
      if (state.hasValue) return;
      state = AsyncValue.error(e, st);
    }
  }

  /// Refresh (silent: whatever is showing stays until the answer lands)
  Future<void> refresh() => _load();
}

/// The customer's open reservation, if any: they are on their way, or due later
Reservation? openReservationOf(List<Reservation> reservations) =>
    reservations.where((r) => r.status.isOpen).firstOrNull;

/// Reservation state
class HoldState {
  final bool isLoading;
  final String? error;
  final int? reservationId;

  const HoldState({
    this.isLoading = false,
    this.error,
    this.reservationId,
  });

  HoldState copyWith({
    bool? isLoading,
    String? error,
    int? reservationId,
  }) {
    return HoldState(
      isLoading: isLoading ?? this.isLoading,
      error: error,
      reservationId: reservationId ?? this.reservationId,
    );
  }
}

/// Reservation notifier
class HoldNotifier extends Notifier<HoldState> {
  late PlaceRepository _roomService;

  @override
  HoldState build() {
    _roomService = ref.watch(placeRepositoryProvider);
    return const HoldState();
  }

  /// Reserve a place for now (the customer has 10 minutes to arrive)
  Future<bool> holdPlace(int roomId, {bool startOnConfirm = false, String? optionCode}) async {
    state = state.copyWith(isLoading: true, error: null);

    try {
      final reservationId =
          await _roomService.holdPlace(roomId, startOnConfirm: startOnConfirm, optionCode: optionCode);
      state = state.copyWith(isLoading: false, reservationId: reservationId);
      return true;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: e.toString(),
      );
      return false;
    }
  }

  /// Reset state
  void reset() {
    state = const HoldState();
  }
}

/// Provider for reservation
final holdProvider =
    NotifierProvider<HoldNotifier, HoldState>(HoldNotifier.new);

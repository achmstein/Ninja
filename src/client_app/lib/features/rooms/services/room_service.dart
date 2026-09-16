import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../../../core/providers/branch_provider.dart';
import '../models/room.dart';

/// The timed places of the branch and the customer's stays on them
abstract class RoomRepository {
  /// Every timed place of the branch that takes customers
  Future<List<Room>> getRooms();

  /// One place, whatever it is — the anonymous read a scanned code starts with
  Future<Room> getRoom(int id);

  /// Hold a place; the customer has 10 minutes to arrive
  Future<int> reserveRoom(int roomId, {bool startOnConfirm = false});
  Future<List<RoomSession>> getMySessions();
  Future<void> cancelReservation(int sessionId);
  Future<void> leaveSession(int sessionId);
  Future<RoomScanResult> scanRoom(int roomId);
  Future<JoinSessionResult> joinSessionByRoom(int roomId);
}

/// API-backed repository over /api/places and /api/stays
class ApiRoomRepository implements RoomRepository {
  final ApiClient _places;
  final ApiClient _stays;

  ApiRoomRepository(this._places, this._stays);

  @override
  Future<List<Room>> getRooms() async {
    final response = await _places.get<List<dynamic>>('', queryParameters: {'timed': true});
    return (response.data ?? [])
        .map((e) => Room.fromJson(e as Map<String, dynamic>))
        .where((p) => p.isActive)
        .toList();
  }

  @override
  Future<Room> getRoom(int id) async {
    final response = await _places.get<Map<String, dynamic>>('$id');
    return Room.fromJson(response.data!);
  }

  @override
  Future<int> reserveRoom(int roomId, {bool startOnConfirm = false}) async {
    final response = await _places.post<int>(
      '$roomId/hold',
      data: {'startOnConfirm': startOnConfirm},
    );
    return response.data!;
  }

  @override
  Future<List<RoomSession>> getMySessions() async {
    final response = await _stays.get<List<dynamic>>('my');
    return (response.data ?? [])
        .map((e) => RoomSession.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<void> cancelReservation(int sessionId) async {
    await _stays.post('my/$sessionId/cancel');
  }

  @override
  Future<void> leaveSession(int sessionId) async {
    await _stays.post('$sessionId/leave');
  }

  @override
  Future<RoomScanResult> scanRoom(int roomId) async {
    final response = await _places.get<Map<String, dynamic>>('$roomId/scan');
    return RoomScanResult.fromJson(response.data!);
  }

  @override
  Future<JoinSessionResult> joinSessionByRoom(int roomId) async {
    final response = await _places.post<Map<String, dynamic>>('$roomId/join');
    return JoinSessionResult.fromJson(response.data!);
  }
}

/// Provider for room repository
final roomRepositoryProvider = Provider<RoomRepository>((ref) {
  return ApiRoomRepository(ref.watch(placesApiProvider), ref.watch(staysApiProvider));
});

/// Provider for the branch's timed places — keyed by branch ID for clean state per branch
final roomsProvider = FutureProvider.family<List<Room>, int>((ref, branchId) async {
  final service = ref.watch(roomRepositoryProvider);
  return service.getRooms();
});

/// Provider for customer stays
final mySessionsProvider = NotifierProvider<MySessionsNotifier, AsyncValue<List<RoomSession>>>(MySessionsNotifier.new);

/// Stays notifier - refreshes on demand (app resume, screen focus, pull-to-refresh)
class MySessionsNotifier extends Notifier<AsyncValue<List<RoomSession>>> {
  late RoomRepository _roomService;

  @override
  AsyncValue<List<RoomSession>> build() {
    ref.watch(selectedBranchIdProvider);
    _roomService = ref.watch(roomRepositoryProvider);
    _loadSessions();
    return const AsyncValue.loading();
  }

  Future<void> _loadSessions({bool silent = false}) async {
    if (!silent) {
      state = const AsyncValue.loading();
    }

    try {
      final sessions = await _roomService.getMySessions();
      state = AsyncValue.data(sessions);
    } catch (e, st) {
      if (!silent) {
        state = AsyncValue.error(e, st);
      }
    }
  }

  /// Refresh (silent - no loading indicator)
  Future<void> refresh() async {
    await _loadSessions(silent: true);
  }

  /// Force refresh with loading indicator
  Future<void> forceRefresh() async {
    await _loadSessions(silent: false);
  }
}

/// Reservation state
class ReservationState {
  final bool isLoading;
  final String? error;
  final int? reservationId;

  const ReservationState({
    this.isLoading = false,
    this.error,
    this.reservationId,
  });

  ReservationState copyWith({
    bool? isLoading,
    String? error,
    int? reservationId,
  }) {
    return ReservationState(
      isLoading: isLoading ?? this.isLoading,
      error: error,
      reservationId: reservationId ?? this.reservationId,
    );
  }
}

/// Reservation notifier
class ReservationNotifier extends Notifier<ReservationState> {
  late RoomRepository _roomService;

  @override
  ReservationState build() {
    _roomService = ref.watch(roomRepositoryProvider);
    return const ReservationState();
  }

  /// Hold a place (the customer has 10 minutes to arrive)
  Future<bool> reserveRoom(int roomId, {bool startOnConfirm = false}) async {
    state = state.copyWith(isLoading: true, error: null);

    try {
      final reservationId = await _roomService.reserveRoom(roomId, startOnConfirm: startOnConfirm);
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
    state = const ReservationState();
  }
}

/// Provider for reservation
final reservationProvider =
    NotifierProvider<ReservationNotifier, ReservationState>(ReservationNotifier.new);

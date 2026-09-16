import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/providers/branch_provider.dart';
import '../models/room.dart';
import '../services/room_service.dart';

/// Rooms state
class RoomsState {
  final bool isLoading;
  final String? error;
  final List<Room> rooms;
  final List<RoomSession> activeSessions;
  final List<RoomSession>? sessionHistory;
  final bool isLoadingHistory;
  final bool hasMoreHistory;
  final int historyPage;

  const RoomsState({
    this.isLoading = false,
    this.error,
    this.rooms = const [],
    this.activeSessions = const [],
    this.sessionHistory,
    this.isLoadingHistory = false,
    this.hasMoreHistory = false,
    this.historyPage = 0,
  });

  RoomsState copyWith({
    bool? isLoading,
    String? error,
    List<Room>? rooms,
    List<RoomSession>? activeSessions,
    List<RoomSession>? sessionHistory,
    bool? isLoadingHistory,
    bool? hasMoreHistory,
    int? historyPage,
  }) {
    return RoomsState(
      isLoading: isLoading ?? this.isLoading,
      error: error,
      rooms: rooms ?? this.rooms,
      activeSessions: activeSessions ?? this.activeSessions,
      sessionHistory: sessionHistory ?? this.sessionHistory,
      isLoadingHistory: isLoadingHistory ?? this.isLoadingHistory,
      hasMoreHistory: hasMoreHistory ?? this.hasMoreHistory,
      historyPage: historyPage ?? this.historyPage,
    );
  }
}

/// Rooms provider
class RoomsNotifier extends Notifier<RoomsState> {
  late RoomRepository _repository;

  @override
  RoomsState build() {
    ref.watch(selectedBranchIdProvider);
    _repository = ref.read(roomRepositoryProvider);
    Future.microtask(() => loadRooms());
    return const RoomsState(isLoading: true);
  }

  Future<void> loadRooms() async {
    state = state.copyWith(isLoading: true, error: null);

    try {
      final result = await _repository.loadRooms();

      state = state.copyWith(
        isLoading: false,
        rooms: result.rooms,
        activeSessions: result.activeSessions,
      );
    } catch (e) {
      debugPrint('Failed to load rooms: $e');
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<bool> reserveRoom(int roomId) async {
    try {
      await _repository.reserveRoom(roomId);
      await loadRooms();
      return true;
    } catch (e) {
      debugPrint('Failed to reserve room: $e');
      return false;
    }
  }

  Future<bool> startSession(int sessionId, {String? playerMode}) async {
    try {
      await _repository.startSession(sessionId, playerMode: playerMode);
      await loadRooms();
      return true;
    } catch (e) {
      debugPrint('Failed to start session: $e');
      return false;
    }
  }

  Future<bool> endSession(int sessionId) async {
    try {
      await _repository.endSession(sessionId);
      await loadRooms();
      return true;
    } catch (e) {
      debugPrint('Failed to end session: $e');
      return false;
    }
  }

  Future<bool> cancelSession(int sessionId) async {
    try {
      await _repository.cancelSession(sessionId);
      await loadRooms();
      return true;
    } catch (e) {
      debugPrint('Failed to cancel session: $e');
      return false;
    }
  }

  Future<bool> createRoom(Room room) async {
    try {
      await _repository.createRoom(room);
      await loadRooms();
      return true;
    } catch (e) {
      debugPrint('Failed to create room: $e');
      return false;
    }
  }

  Future<bool> updateRoom(Room room) async {
    try {
      await _repository.updateRoom(room);
      await loadRooms();
      return true;
    } catch (e) {
      debugPrint('Failed to update room: $e');
      return false;
    }
  }

  Future<bool> deleteRoom(int roomId) async {
    try {
      await _repository.deleteRoom(roomId);
      await loadRooms();
      return true;
    } catch (e) {
      debugPrint('Failed to delete room: $e');
      return false;
    }
  }

  /// Assign a customer to an active walk-in session
  Future<bool> assignCustomerToSession(int sessionId, String customerId, String? customerName) async {
    try {
      await _repository.assignCustomerToSession(sessionId, customerId, customerName);
      await loadRooms();
      return true;
    } catch (e) {
      debugPrint('Failed to assign customer to session: $e');
      return false;
    }
  }

  /// Add a member to an active session
  Future<bool> addMemberToSession(int sessionId, String customerId, String? customerName) async {
    try {
      await _repository.addMemberToSession(sessionId, customerId, customerName);
      await loadRooms();
      return true;
    } catch (e) {
      debugPrint('Failed to add member to session: $e');
      return false;
    }
  }

  /// Remove a member from an active session
  Future<bool> removeMemberFromSession(int sessionId, String customerId) async {
    try {
      await _repository.removeMemberFromSession(sessionId, customerId);
      await loadRooms();
      return true;
    } catch (e) {
      debugPrint('Failed to remove member from session: $e');
      return false;
    }
  }

  /// Change player mode for an active session
  Future<bool> changePlayerMode(int sessionId, String playerMode) async {
    try {
      await _repository.changePlayerMode(sessionId, playerMode);
      await loadRooms();
      return true;
    } catch (e) {
      debugPrint('Failed to change player mode: $e');
      return false;
    }
  }

  /// Start a walk-in session directly (without reservation)
  Future<bool> startWalkInSession(int roomId, {String? playerMode}) async {
    try {
      await _repository.startWalkInSession(roomId, playerMode: playerMode);
      await loadRooms();
      return true;
    } catch (e) {
      debugPrint('Failed to start walk-in session: $e');
      return false;
    }
  }

  static const int _historyPageSize = 20;

  /// Load session history for a specific room
  Future<void> loadSessionHistory(int roomId, {bool loadMore = false}) async {
    final currentPage = loadMore ? state.historyPage + 1 : 0;
    final currentHistory = loadMore ? (state.sessionHistory ?? []) : <RoomSession>[];

    state = state.copyWith(
      isLoadingHistory: true,
      sessionHistory: loadMore ? currentHistory : null,
      historyPage: currentPage,
    );

    try {
      final newHistory = await _repository.getSessionHistory(roomId, limit: _historyPageSize);

      state = state.copyWith(
        isLoadingHistory: false,
        sessionHistory: [...currentHistory, ...newHistory],
        hasMoreHistory: newHistory.length >= _historyPageSize,
      );
    } catch (e) {
      state = state.copyWith(
        isLoadingHistory: false,
        sessionHistory: currentHistory.isEmpty ? [] : currentHistory,
        hasMoreHistory: false,
      );
    }
  }

  /// Clear session history when closing detail sheet
  void clearSessionHistory() {
    state = state.copyWith(sessionHistory: null);
  }
}

/// Rooms provider
final roomsProvider = NotifierProvider<RoomsNotifier, RoomsState>(RoomsNotifier.new);

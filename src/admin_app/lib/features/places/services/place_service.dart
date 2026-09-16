import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../models/room.dart';

/// Abstract repository defining all room-related API operations
abstract class RoomRepository {
  Future<({List<Room> rooms, List<RoomSession> activeSessions})> loadRooms();
  Future<void> reserveRoom(int roomId);
  Future<void> startSession(int sessionId, {String? playerMode});
  Future<void> endSession(int sessionId);
  Future<void> cancelSession(int sessionId);
  Future<void> createRoom(Room room);
  Future<void> updateRoom(Room room);
  Future<void> deleteRoom(int roomId);
  Future<void> assignCustomerToSession(int sessionId, String customerId, String? customerName);
  Future<void> addMemberToSession(int sessionId, String customerId, String? customerName);
  Future<void> removeMemberFromSession(int sessionId, String customerId);
  Future<void> startWalkInSession(int roomId, {String? playerMode});
  Future<void> changePlayerMode(int sessionId, String playerMode);
  Future<List<RoomSession>> getSessionHistory(int roomId, {int limit = 20});
}

/// Concrete implementation that calls the Rooms API
class ApiRoomRepository implements RoomRepository {
  final ApiClient _api;

  ApiRoomRepository(this._api);

  @override
  Future<({List<Room> rooms, List<RoomSession> activeSessions})> loadRooms() async {
    final results = await Future.wait([
      _api.get(''),
      _api.get('sessions/active'),
    ]);

    final roomsData = results[0].data as List<dynamic>;
    final sessionsData = results[1].data as List<dynamic>;

    final rooms = roomsData
        .map((e) => Room.fromJson(e as Map<String, dynamic>))
        .toList();

    final activeSessions = sessionsData
        .map((e) => RoomSession.fromJson(e as Map<String, dynamic>))
        .toList();

    return (rooms: rooms, activeSessions: activeSessions);
  }

  @override
  Future<void> reserveRoom(int roomId) async {
    await _api.post('$roomId/reserve');
  }

  @override
  Future<void> startSession(int sessionId, {String? playerMode}) async {
    await _api.post('sessions/$sessionId/start', data: playerMode != null ? {'playerMode': playerMode} : null);
  }

  @override
  Future<void> endSession(int sessionId) async {
    await _api.post('sessions/$sessionId/end');
  }

  @override
  Future<void> cancelSession(int sessionId) async {
    await _api.post('sessions/$sessionId/cancel');
  }

  @override
  Future<void> createRoom(Room room) async {
    await _api.post('', data: room.toJson());
  }

  @override
  Future<void> updateRoom(Room room) async {
    await _api.put('${room.id}', data: room.toJson());
  }

  @override
  Future<void> deleteRoom(int roomId) async {
    await _api.delete('$roomId');
  }

  @override
  Future<void> assignCustomerToSession(int sessionId, String customerId, String? customerName) async {
    await _api.post('sessions/$sessionId/assign-customer', data: {
      'customerId': customerId,
      'customerName': customerName,
    });
  }

  @override
  Future<void> addMemberToSession(int sessionId, String customerId, String? customerName) async {
    await _api.post('sessions/$sessionId/members', data: {
      'customerId': customerId,
      'customerName': customerName,
    });
  }

  @override
  Future<void> removeMemberFromSession(int sessionId, String customerId) async {
    await _api.delete('sessions/$sessionId/members/$customerId');
  }

  @override
  Future<void> startWalkInSession(int roomId, {String? playerMode}) async {
    await _api.post('sessions/walk-in/$roomId', data: playerMode != null ? {'playerMode': playerMode} : null);
  }

  @override
  Future<void> changePlayerMode(int sessionId, String playerMode) async {
    await _api.put('sessions/$sessionId/player-mode', data: {
      'playerMode': playerMode,
    });
  }

  @override
  Future<List<RoomSession>> getSessionHistory(int roomId, {int limit = 20}) async {
    final response = await _api.get(
      '$roomId/sessions/history',
      queryParameters: {'limit': limit},
    );
    final historyData = response.data as List<dynamic>;
    return historyData
        .map((e) => RoomSession.fromJson(e as Map<String, dynamic>))
        .toList();
  }
}

/// Provider for the room repository
final roomRepositoryProvider = Provider<RoomRepository>((ref) {
  return ApiRoomRepository(ref.read(roomsApiProvider));
});

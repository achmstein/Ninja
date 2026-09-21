import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../models/place.dart';

/// The branch's places, the reservations on them and the stays running
/// there — /api/places, /api/reservations and /api/stays
abstract class PlaceRepository {
  /// Every place of the branch, every running stay and every open reservation
  Future<({List<Place> places, List<Stay> openStays, List<Reservation> openReservations})> loadPlaces();

  /// Reserve a place for a party at the counter
  Future<void> holdPlace(int placeId);

  /// The party arrived and sat down: on a timed place the clock starts
  Future<void> seatReservation(int reservationId, {String? optionCode});

  /// The till acknowledges a reservation; one that asked for it also seats and starts the clock
  Future<void> confirmReservation(int reservationId);
  Future<void> cancelReservation(int reservationId);
  Future<void> assignReservationCustomer(int reservationId, String customerId, String? customerName);
  Future<void> endStay(int stayId);
  Future<void> cancelStay(int stayId);
  Future<void> assignStayCustomer(int stayId, String customerId, String? customerName);
  Future<void> addStayMember(int stayId, String customerId, String? customerName);
  Future<void> removeStayMember(int stayId, String customerId);
  Future<void> startWalkIn(int placeId, {String? optionCode});
  Future<void> changeOption(int stayId, String optionCode);
  Future<List<Stay>> getStayHistory(int placeId, {int limit = 20});
  Future<Stay?> getStay(int stayId);
}

/// Concrete implementation over the Places, Reservations and Stays APIs
class ApiPlaceRepository implements PlaceRepository {
  final ApiClient _places;
  final ApiClient _reservations;
  final ApiClient _stays;

  ApiPlaceRepository(this._places, this._reservations, this._stays);

  @override
  Future<({List<Place> places, List<Stay> openStays, List<Reservation> openReservations})> loadPlaces() async {
    final results = await Future.wait([
      _places.get(''),
      _stays.get('open'),
      _reservations.get('open'),
    ]);

    final placesData = results[0].data as List<dynamic>;
    final staysData = results[1].data as List<dynamic>;
    final reservationsData = results[2].data as List<dynamic>;

    final places = placesData.map((e) => Place.fromJson(e as Map<String, dynamic>)).toList();
    final openStays = staysData.map((e) => Stay.fromJson(e as Map<String, dynamic>)).toList();
    final openReservations = reservationsData.map((e) => Reservation.fromJson(e as Map<String, dynamic>)).toList();

    return (places: places, openStays: openStays, openReservations: openReservations);
  }

  @override
  Future<void> holdPlace(int placeId) async {
    await _reservations.post('', data: {'placeId': placeId, 'startOnConfirm': false});
  }

  @override
  Future<void> seatReservation(int reservationId, {String? optionCode}) async {
    await _reservations.post('$reservationId/seat', data: {'optionCode': optionCode});
  }

  @override
  Future<void> confirmReservation(int reservationId) async {
    await _reservations.post('$reservationId/confirm', data: {});
  }

  @override
  Future<void> cancelReservation(int reservationId) async {
    await _reservations.post('$reservationId/cancel');
  }

  @override
  Future<void> assignReservationCustomer(int reservationId, String customerId, String? customerName) async {
    await _reservations.post('$reservationId/assign-customer', data: {
      'customerId': customerId,
      'customerName': customerName,
    });
  }

  @override
  Future<void> endStay(int stayId) async {
    await _stays.post('$stayId/end');
  }

  @override
  Future<void> cancelStay(int stayId) async {
    await _stays.post('$stayId/cancel');
  }

  @override
  Future<void> assignStayCustomer(int stayId, String customerId, String? customerName) async {
    await _stays.post('$stayId/assign-customer', data: {
      'customerId': customerId,
      'customerName': customerName,
    });
  }

  @override
  Future<void> addStayMember(int stayId, String customerId, String? customerName) async {
    await _stays.post('$stayId/members', data: {
      'customerId': customerId,
      'customerName': customerName,
    });
  }

  @override
  Future<void> removeStayMember(int stayId, String customerId) async {
    await _stays.delete('$stayId/members/$customerId');
  }

  @override
  Future<void> startWalkIn(int placeId, {String? optionCode}) async {
    await _places.post('$placeId/walk-in', data: {'optionCode': optionCode});
  }

  @override
  Future<void> changeOption(int stayId, String optionCode) async {
    await _stays.put('$stayId/option', data: {'optionCode': optionCode});
  }

  @override
  Future<Stay?> getStay(int stayId) async {
    final response = await _stays.get('$stayId');
    return Stay.fromJson(response.data as Map<String, dynamic>);
  }

  @override
  Future<List<Stay>> getStayHistory(int placeId, {int limit = 20}) async {
    final response = await _places.get('$placeId/stays', queryParameters: {'limit': limit});
    final historyData = response.data as List<dynamic>;
    return historyData.map((e) => Stay.fromJson(e as Map<String, dynamic>)).toList();
  }
}

/// Provider for the room repository
final placeRepositoryProvider = Provider<PlaceRepository>((ref) {
  return ApiPlaceRepository(ref.read(placesApiProvider), ref.read(reservationsApiProvider), ref.read(staysApiProvider));
});

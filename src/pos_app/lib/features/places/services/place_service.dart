import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../models/place.dart';

/// The branch's places and the stays on them — /api/places and /api/stays
abstract class PlaceRepository {
  /// Every place of the branch, and every held or running stay
  Future<({List<Place> places, List<Stay> openStays})> loadPlaces();
  Future<void> holdPlace(int placeId);
  Future<void> startStay(int stayId, {String? optionCode});

  /// The customer arrived: starts the clock when the hold asked for it
  Future<void> confirmStay(int stayId);
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

/// Concrete implementation over the Places and Stays APIs
class ApiPlaceRepository implements PlaceRepository {
  final ApiClient _places;
  final ApiClient _stays;

  ApiPlaceRepository(this._places, this._stays);

  @override
  Future<({List<Place> places, List<Stay> openStays})> loadPlaces() async {
    final results = await Future.wait([
      _places.get(''),
      _stays.get('open'),
    ]);

    final placesData = results[0].data as List<dynamic>;
    final staysData = results[1].data as List<dynamic>;

    final places = placesData.map((e) => Place.fromJson(e as Map<String, dynamic>)).toList();
    final openStays = staysData.map((e) => Stay.fromJson(e as Map<String, dynamic>)).toList();

    return (places: places, openStays: openStays);
  }

  @override
  Future<void> holdPlace(int placeId) async {
    await _places.post('$placeId/hold', data: {'startOnConfirm': false});
  }

  @override
  Future<void> startStay(int stayId, {String? optionCode}) async {
    await _stays.post('$stayId/start', data: {'optionCode': optionCode});
  }

  @override
  Future<void> confirmStay(int stayId) async {
    await _stays.post('$stayId/confirm', data: {});
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
  return ApiPlaceRepository(ref.read(placesApiProvider), ref.read(staysApiProvider));
});

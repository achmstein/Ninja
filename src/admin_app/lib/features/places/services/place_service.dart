import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/models/localized_text.dart';
import '../../../core/network/api_client.dart';
import '../models/place.dart';

/// The server said no: its reason, for the screen to show
class PlaceRequestRefused implements Exception {
  final String detail;
  const PlaceRequestRefused(this.detail);

  @override
  String toString() => detail;
}

/// The branch's places and the stays on them — /api/places and /api/stays
abstract class PlaceRepository {
  /// Every place of the branch, and every held or running stay
  Future<({List<Place> places, List<Stay> openStays})> loadPlaces();

  // ---- the place itself (Admin)
  Future<void> createPlace({
    required PlaceKind kind,
    required LocalizedText name,
    LocalizedText? description,
    Tariff? tariff,
  });
  Future<void> updatePlace(int placeId, {required LocalizedText name, LocalizedText? description});

  /// Null tariff: the place stops being timed and only takes orders.
  /// Refused while a stay runs there.
  Future<void> setTariff(int placeId, Tariff? tariff);
  Future<void> setActive(int placeId, bool isActive);
  Future<void> setStatus(int placeId, PlaceStatus status);
  Future<void> deletePlace(int placeId);

  // ---- stays
  Future<void> holdPlace(int placeId, {String? customerName, bool startOnConfirm = false});
  Future<void> startWalkIn(int placeId, {String? optionCode});
  Future<void> startStay(int stayId, {String? optionCode});

  /// The customer arrived: starts the clock when the hold asked for it
  Future<void> confirmStay(int stayId, {String? optionCode});
  Future<void> endStay(int stayId);
  Future<void> cancelStay(int stayId);
  Future<void> changeOption(int stayId, String optionCode);
  Future<void> assignStayCustomer(int stayId, String customerId, String? customerName);
  Future<void> addStayMember(int stayId, String customerId, String? customerName);
  Future<void> removeStayMember(int stayId, String customerId);
  Future<List<Stay>> getStayHistory(int placeId, {int limit = 20});
  Future<Stay?> getStay(int stayId);
}

/// Concrete implementation over the Places and Stays APIs
class ApiPlaceRepository implements PlaceRepository {
  final ApiClient _places;
  final ApiClient _stays;

  ApiPlaceRepository(this._places, this._stays);

  /// Runs a call and turns the server's ProblemDetails into a readable refusal
  Future<T> _refusable<T>(Future<T> Function() call) async {
    try {
      return await call();
    } on DioException catch (e) {
      final data = e.response?.data;
      final detail = data is Map ? (data['detail'] ?? data['title']) : null;
      if (detail is String && detail.isNotEmpty) throw PlaceRequestRefused(detail);
      rethrow;
    }
  }

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
  Future<void> createPlace({
    required PlaceKind kind,
    required LocalizedText name,
    LocalizedText? description,
    Tariff? tariff,
  }) =>
      _refusable(() => _places.post('', data: {
            'kind': kind.value,
            'name': name.toJson(),
            'description': description?.toJson(),
            'tariff': tariff?.toJson(),
          }));

  @override
  Future<void> updatePlace(int placeId, {required LocalizedText name, LocalizedText? description}) =>
      _refusable(() => _places.put('$placeId', data: {
            'name': name.toJson(),
            'description': description?.toJson(),
          }));

  @override
  Future<void> setTariff(int placeId, Tariff? tariff) =>
      _refusable(() => _places.put('$placeId/tariff', data: {'tariff': tariff?.toJson()}));

  @override
  Future<void> setActive(int placeId, bool isActive) =>
      _refusable(() => _places.put('$placeId/active', data: {'isActive': isActive}));

  @override
  Future<void> setStatus(int placeId, PlaceStatus status) =>
      _refusable(() => _places.put('$placeId/status', queryParameters: {'status': status.value}));

  @override
  Future<void> deletePlace(int placeId) => _refusable(() => _places.delete('$placeId'));

  @override
  Future<void> holdPlace(int placeId, {String? customerName, bool startOnConfirm = false}) =>
      _refusable(() => _places.post('$placeId/hold', data: {
            'customerName': customerName,
            'startOnConfirm': startOnConfirm,
          }));

  @override
  Future<void> startWalkIn(int placeId, {String? optionCode}) =>
      _refusable(() => _places.post('$placeId/walk-in', data: {'optionCode': optionCode}));

  @override
  Future<void> startStay(int stayId, {String? optionCode}) =>
      _refusable(() => _stays.post('$stayId/start', data: {'optionCode': optionCode}));

  @override
  Future<void> confirmStay(int stayId, {String? optionCode}) =>
      _refusable(() => _stays.post('$stayId/confirm', data: {'optionCode': optionCode}));

  @override
  Future<void> endStay(int stayId) => _refusable(() => _stays.post('$stayId/end'));

  @override
  Future<void> cancelStay(int stayId) => _refusable(() => _stays.post('$stayId/cancel'));

  @override
  Future<void> changeOption(int stayId, String optionCode) =>
      _refusable(() => _stays.put('$stayId/option', data: {'optionCode': optionCode}));

  @override
  Future<void> assignStayCustomer(int stayId, String customerId, String? customerName) =>
      _refusable(() => _stays.post('$stayId/assign-customer', data: {
            'customerId': customerId,
            'customerName': customerName,
          }));

  @override
  Future<void> addStayMember(int stayId, String customerId, String? customerName) =>
      _refusable(() => _stays.post('$stayId/members', data: {
            'customerId': customerId,
            'customerName': customerName,
          }));

  @override
  Future<void> removeStayMember(int stayId, String customerId) =>
      _refusable(() => _stays.delete('$stayId/members/$customerId'));

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

/// Provider for the place repository
final placeRepositoryProvider = Provider<PlaceRepository>((ref) {
  return ApiPlaceRepository(ref.read(placesApiProvider), ref.read(staysApiProvider));
});

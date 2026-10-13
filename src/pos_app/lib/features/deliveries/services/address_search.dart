import 'dart:math';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ninja_app_core/auth/auth_service.dart';
import '../../../core/config/app_config.dart';
import '../../../core/network/api_client.dart';

/// Address search for a phoned-in delivery, kept cheap as the customer
/// app's is: Google is asked through the business's own server, which holds
/// the key, only once three letters stand still for 350 ms, and one search
/// carries one session token until a place is picked, so its keystrokes are
/// billed as that one pick.

/// The fewest letters searched for, as the server has it
const minSearchLength = 3;

/// How long the typing pauses before the server is asked
const searchDebounce = Duration(milliseconds: 350);

/// What is sent, or null while it is too short to be worth a call
String? searchableQuery(String text) {
  final q = text.trim().replaceAll(RegExp(r'\s+'), ' ');
  return q.length >= minSearchLength ? q : null;
}

/// A new session's token: a version 4 UUID, which Google takes as is
String newSearchSession([Random? random]) {
  final r = random ?? Random.secure();
  final bytes = List<int>.generate(16, (_) => r.nextInt(256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
}

/// One of Google's suggestions: the street or place, and the area under it
@immutable
class PlaceSuggestion {
  final String placeId;
  final String primaryText;
  final String? secondaryText;

  const PlaceSuggestion({required this.placeId, required this.primaryText, this.secondaryText});
}

/// Where a picked suggestion is, and the address Google writes for it
@immutable
class PickedPlace {
  final double lat;
  final double lng;
  final String? address;

  const PickedPlace(this.lat, this.lng, this.address);

  /// As the location field takes coordinates, which read back as the same pin
  String get locationText => '${lat.toStringAsFixed(6)}, ${lng.toStringAsFixed(6)}';
}

double? _number(Object? v) => v is num ? v.toDouble() : double.tryParse('$v');

/// `GET /api/tenant/places/…`, leaning toward the business's first branch (the server's default)
class AddressSearchService {
  final ApiClient _api;

  AddressSearchService(this._api);

  Future<List<PlaceSuggestion>> suggest(String query, {required String session, required String language}) async {
    final q = searchableQuery(query);
    if (q == null) return const [];
    try {
      final response = await _api.get<List<dynamic>>('autocomplete', queryParameters: {'q': q, 'session': session, 'lang': language});
      return [
        for (final s in response.data ?? const [])
          if (s is Map && s['placeId'] is String && s['primaryText'] is String)
            PlaceSuggestion(placeId: s['placeId'] as String, primaryText: s['primaryText'] as String, secondaryText: s['secondaryText'] as String?),
      ];
    } on DioException catch (e) {
      debugPrint('Address search failed: ${e.response?.statusCode ?? e.message}');
      return const [];
    }
  }

  /// Where [suggestion] is; closes the search's session. Null when it cannot be read
  Future<PickedPlace?> pick(PlaceSuggestion suggestion, {required String session, required String language}) async {
    try {
      final response = await _api.get<Map<String, dynamic>>(Uri.encodeComponent(suggestion.placeId),
          queryParameters: {'session': session, 'lang': language});
      final data = response.data ?? const {};
      final lat = _number(data['lat']);
      final lng = _number(data['lng']);
      if (lat == null || lng == null) return null;
      return PickedPlace(lat, lng, data['address'] as String?);
    } on DioException catch (e) {
      debugPrint('Place details failed: ${e.response?.statusCode ?? e.message}');
      return null;
    }
  }
}

final addressSearchProvider = Provider<AddressSearchService>((ref) {
  final auth = ref.read(authServiceProvider.notifier);
  return AddressSearchService(ApiClient(auth, baseUrl: '${AppConfig.tenantApiUrl}/places/'));
});

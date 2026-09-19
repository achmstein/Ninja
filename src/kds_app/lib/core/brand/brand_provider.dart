import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'brand_service.dart';
import 'tenant_brand.dart';

/// Same key the web apps use for their localStorage copy
const String _brandKey = 'ninja-brand';

/// The cached brand, read before the first frame
TenantBrand? _initialBrand;

/// Call this before runApp() so the first frame already carries the brand
/// this device saw last time
Future<void> initializeBrand() async {
  try {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_brandKey);
    if (raw != null) {
      _initialBrand = TenantBrand.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    }
  } catch (e) {
    debugPrint('Failed to read the cached brand: $e');
  }
}

/// The tenant's brand: the cached copy first, the network's when it lands,
/// and [TenantBrand.neutral] until either is known.
class BrandNotifier extends Notifier<TenantBrand> {
  @override
  TenantBrand build() {
    refresh();
    return _initialBrand ?? TenantBrand.neutral;
  }

  /// Re-read the brand; the screen follows and the cache is updated
  Future<void> refresh() async {
    try {
      final brand = await ref.read(tenantRepositoryProvider).getBrand();
      state = brand;
      _initialBrand = brand;
      await _save(brand);
    } catch (e) {
      debugPrint('Failed to load the brand: $e');
    }
  }

  Future<void> _save(TenantBrand brand) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_brandKey, jsonEncode(brand.toJson()));
    } catch (_) {
      // The next start just waits for the network
    }
  }
}

/// The café this board runs for. On screen the board is Ninja; the café's
/// switches are what the platform reads from here.
final brandProvider = NotifierProvider<BrandNotifier, TenantBrand>(BrandNotifier.new);

/// Every switch on until the brand is known
final featuresProvider = Provider<TenantFeatures>((ref) {
  return ref.watch(brandProvider).features;
});

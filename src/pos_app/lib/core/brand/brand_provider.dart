import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ninja_app_core/brand/brand_provider.dart';

export 'package:ninja_app_core/brand/brand_provider.dart';

/// No tables to open or seat: the till is the open bills and the counter
final isCloudKitchenProvider = Provider<bool>((ref) {
  return ref.watch(brandProvider).isCloudKitchen;
});

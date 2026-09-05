import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../core/providers/branch_provider.dart';
import '../models/pricing.dart';
import '../services/tickets_service.dart';

String _key(int branchId) => 'pos.pricing.$branchId';

/// The branch's service charge and VAT rules, as Sales applies them. Fetched
/// whenever the branch is known and kept on the till, so an offline sale
/// can be priced the way the server will price it when replayed.
class PricingNotifier extends AsyncNotifier<PricingView> {
  @override
  Future<PricingView> build() async {
    final branchId = ref.watch(selectedBranchIdProvider);
    if (branchId == null) return const PricingView();
    final prefs = await SharedPreferences.getInstance();
    try {
      final fresh = await ref.read(ticketsRepositoryProvider).getPricing(branchId);
      await prefs.setString(_key(branchId), json.encode(fresh.toJson()));
      return fresh;
    } catch (_) {
      // Offline: the last rules seen for this branch, or none
      final cached = prefs.getString(_key(branchId));
      return cached == null ? const PricingView() : PricingView.fromJson(json.decode(cached) as Map<String, dynamic>);
    }
  }
}

final pricingProvider = AsyncNotifierProvider<PricingNotifier, PricingView>(PricingNotifier.new);

import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/brand/brand_provider.dart';
import '../../../core/config/app_config.dart';
import '../../../core/providers/branch_provider.dart';
import '../models/delivery_order.dart';
import '../services/delivery_service.dart';

/// The branch's deliveries out, on the board's order: waiting for a rider,
/// with one, delivered with the cash still out. Nothing at all where the
/// business does not deliver (an add-on): no request, no poll. The hub's
/// DeliveryChanged is the primary update path; the poll covers a dead socket.
class DeliveriesNotifier extends AsyncNotifier<List<DeliveryOrder>> {
  Timer? _poll;

  @override
  Future<List<DeliveryOrder>> build() async {
    ref.watch(selectedBranchIdProvider);
    _poll?.cancel();
    if (!ref.watch(featuresProvider.select((f) => f.delivery))) return const [];
    _poll = Timer.periodic(AppConfig.deliveriesPoll, (_) => refresh());
    ref.onDispose(() => _poll?.cancel());
    return _load();
  }

  Future<List<DeliveryOrder>> _load() async => boardOrder(await ref.read(deliveryRepositoryProvider).getDeliveries());

  Future<void> refresh() async {
    if (!ref.read(featuresProvider).delivery) return;
    final result = await AsyncValue.guard(_load);
    if (!ref.mounted) return;
    if (result.hasValue) state = result;
  }
}

final deliveriesProvider = AsyncNotifierProvider<DeliveriesNotifier, List<DeliveryOrder>>(DeliveriesNotifier.new);

/// The rider picker: those whose app has checked in at the branch, then the
/// branch's riders who have not opened it yet. Identity's list only adds to
/// Ordering's; when it cannot be read the picker still has the first.
final tillRidersProvider = FutureProvider.autoDispose<List<TillRider>>((ref) async {
  final branchId = ref.watch(selectedBranchIdProvider);
  final repository = ref.read(deliveryRepositoryProvider);
  final heard = await repository.getRiders();
  List<RiderAccount> accounts;
  try {
    accounts = await repository.getRiderAccounts();
  } catch (_) {
    accounts = const [];
  }
  return mergeRiders(heard, accounts, branchId);
});

/// What a delivery taken over the phone asks, for the sale pad's button:
/// whether the branch delivers (even while the customers' orders are paused)
/// and its fee. Not asked where the business does not deliver.
final tillDeliveryTermsProvider = FutureProvider.autoDispose<TillDeliveryQuote>((ref) async {
  ref.watch(selectedBranchIdProvider);
  if (!ref.watch(featuresProvider.select((f) => f.delivery))) return const TillDeliveryQuote();
  return ref.read(deliveryRepositoryProvider).tillQuote();
});

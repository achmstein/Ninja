import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ninja_app_core/providers/branch_provider.dart';
import '../customers/services/customer_search_service.dart';
import '../deliveries/models/delivery_order.dart';
import '../deliveries/services/delivery_service.dart';
import '../sale/models/sale_delivery.dart';
import '../sale/models/sale_line.dart';
import '../sale/providers/sale_provider.dart';

/// One call, as far as it has got: who is calling, where they were delivered
/// before (by any branch), and which branches reach the location they gave
@immutable
class CallCentreState {
  /// The customer account with the caller's number, when there is one
  final IdentityUser? customer;
  final List<KnownAddress> known;

  /// The branches' answer for [resolvedFor]
  final StaffDeliveryResolution? resolution;
  final String? resolvedFor;
  final bool resolving;
  final bool resolveFailed;

  /// The branch the delivery goes to: the nearest taking orders, or the agent's pick
  final DeliveryAlternative? chosen;

  const CallCentreState({
    this.customer,
    this.known = const [],
    this.resolution,
    this.resolvedFor,
    this.resolving = false,
    this.resolveFailed = false,
    this.chosen,
  });

  CallCentreState copyWith({
    IdentityUser? customer,
    bool clearCustomer = false,
    List<KnownAddress>? known,
    StaffDeliveryResolution? resolution,
    String? resolvedFor,
    bool clearResolution = false,
    bool? resolving,
    bool? resolveFailed,
    DeliveryAlternative? chosen,
    bool clearChosen = false,
  }) =>
      CallCentreState(
        customer: clearCustomer ? null : customer ?? this.customer,
        known: known ?? this.known,
        resolution: clearResolution ? null : resolution ?? this.resolution,
        resolvedFor: clearResolution ? null : resolvedFor ?? this.resolvedFor,
        resolving: resolving ?? this.resolving,
        resolveFailed: resolveFailed ?? this.resolveFailed,
        chosen: clearChosen || clearResolution ? null : chosen ?? this.chosen,
      );
}

/// The call centre's work for one call, out of the screen: looking the
/// caller up, asking which branch reaches them, and starting the order at
/// the branch chosen, where the till then works as that branch
class CallCentreController extends Notifier<CallCentreState> {
  int _asks = 0;
  String _lookedUp = '';

  @override
  CallCentreState build() => const CallCentreState();

  /// Next caller: nothing of the last call is kept
  void reset() {
    _asks++;
    _lookedUp = '';
    state = const CallCentreState();
  }

  /// The caller's account and their earlier addresses, by [phone] (normalized)
  Future<void> lookUp(String phone) async {
    if (phone == _lookedUp) return;
    _lookedUp = phone;
    if (phone.isEmpty) {
      state = state.copyWith(clearCustomer: true, known: const []);
      return;
    }
    IdentityUser? customer;
    try {
      customer = (await ref.read(counterCustomerServiceProvider).lookup(phone: phone)).match;
    } catch (_) {
      // Only a convenience: the agent types the name
    }
    if (!ref.mounted || _lookedUp != phone) return;
    var known = const <KnownAddress>[];
    try {
      final found = await ref
          .read(deliveryRepositoryProvider)
          .knownAddresses(customerUserId: customer?.id, phone: phone, everyBranch: true);
      final seen = <String>{};
      known = [for (final a in found) if (seen.add(a.identity)) a];
    } catch (_) {}
    if (!ref.mounted || _lookedUp != phone) return;
    state = customer == null ? state.copyWith(clearCustomer: true, known: known) : state.copyWith(customer: customer, known: known);
  }

  /// Which branches deliver to [location]; the nearest one taking orders is chosen
  Future<void> resolve(String location) async {
    final asked = location.trim();
    if (asked.isEmpty) {
      state = state.copyWith(clearResolution: true, resolveFailed: false);
      return;
    }
    final ask = ++_asks;
    state = state.copyWith(clearResolution: true, resolving: true, resolveFailed: false);
    try {
      final resolution = await ref.read(deliveryRepositoryProvider).resolveForStaff(asked);
      if (!ref.mounted || ask != _asks) return;
      state = CallCentreState(
        customer: state.customer,
        known: state.known,
        resolution: resolution,
        resolvedFor: asked,
        chosen: resolution.suggested,
      );
    } catch (_) {
      if (!ref.mounted || ask != _asks) return;
      state = state.copyWith(resolving: false, resolveFailed: true);
    }
  }

  /// The agent picked another branch (a paused one only after a second tap, on the screen)
  void choose(DeliveryAlternative branch) => state = state.copyWith(chosen: branch);

  /// Start the order at [branchId]: the till becomes that branch (its menu,
  /// prices and stock), and the sale opens with the caller on it, and where
  /// it goes when it is a delivery. A normal till order there from then on.
  Future<void> start({required int branchId, required SaleCustomer customer, SaleDelivery? delivery}) async {
    final sale = ref.read(saleProvider.notifier);
    sale.setTarget(null);
    sale.clear();
    await ref.read(branchProvider.notifier).selectBranch(branchId);
    sale.setCustomer(customer);
    sale.setDelivery(delivery);
  }
}

final callCentreControllerProvider = NotifierProvider<CallCentreController, CallCentreState>(CallCentreController.new);

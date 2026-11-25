import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ninja_app_core/models/localized_text.dart';
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

  /// Every named area of every delivering branch, as last answered: kept
  /// while the branches are asked again, so the picker stays where it is
  final List<DeliveryZone> zones;

  /// The named area the delivery goes to: the agent's pick by name, or the
  /// one the point on the map is in at the branch chosen. Its branch is [chosen].
  final DeliveryZone? zone;

  const CallCentreState({
    this.customer,
    this.known = const [],
    this.resolution,
    this.resolvedFor,
    this.resolving = false,
    this.resolveFailed = false,
    this.chosen,
    this.zones = const [],
    this.zone,
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
    List<DeliveryZone>? zones,
    DeliveryZone? zone,
    bool clearZone = false,
  }) =>
      CallCentreState(
        customer: clearCustomer ? null : customer ?? this.customer,
        known: known ?? this.known,
        resolution: clearResolution ? null : resolution ?? this.resolution,
        resolvedFor: clearResolution ? null : resolvedFor ?? this.resolvedFor,
        resolving: resolving ?? this.resolving,
        resolveFailed: resolveFailed ?? this.resolveFailed,
        chosen: clearChosen || clearResolution ? null : chosen ?? this.chosen,
        zones: zones ?? this.zones,
        zone: clearZone ? null : zone ?? this.zone,
      );
}

/// The call centre's work for one call, out of the screen: looking the
/// caller up, asking which branch reaches them, and starting the order at
/// the branch chosen, where the till then works as that branch
class CallCentreController extends Notifier<CallCentreState> {
  int _asks = 0;
  String _lookedUp = '';

  /// The agent picked the area by name: no point on the map changes it
  bool _zoneByHand = false;

  @override
  CallCentreState build() => const CallCentreState();

  /// Next caller: nothing of the last call is kept
  void reset() {
    _asks++;
    _lookedUp = '';
    _zoneByHand = false;
    state = const CallCentreState();
    // Before anything is known of where: the branches that deliver, to pick from
    unawaited(resolve(''));
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
      // An account the owner switched off is not attached to the order
      final match = (await ref.read(counterCustomerServiceProvider).lookup(phone: phone)).match;
      customer = match != null && match.enabled ? match : null;
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

  /// Which branches deliver to [location], a point on the map as coordinates:
  /// the nearest one taking orders is chosen. With none (the caller only said
  /// where they live) every branch that delivers comes back, and the agent picks.
  Future<void> resolve(String location) async {
    final asked = location.trim();
    final ask = ++_asks;
    // An area the map found goes with the point it was found for; one picked by name stays
    state = state.copyWith(clearResolution: true, resolving: true, resolveFailed: false, clearZone: !_zoneByHand);
    try {
      final resolution = await ref.read(deliveryRepositoryProvider).resolveForStaff(asked);
      if (!ref.mounted || ask != _asks) return;
      // The area picked by name, as the list has it now; gone from it, the pick is too
      final held = _zoneByHand && state.zone != null ? zoneById(resolution.zones, state.zone!.zoneId) : null;
      _zoneByHand = held != null;
      final suggested = resolution.suggested;
      state = CallCentreState(
        customer: state.customer,
        known: state.known,
        resolution: resolution,
        resolvedFor: asked,
        zones: resolution.zones,
        chosen: held != null ? _branchFor(held, resolution) : suggested,
        // The point is in one of the suggested branch's areas: that area, without asking
        zone: held ?? (suggested == null ? null : _zoneAt(suggested, resolution)),
      );
    } catch (_) {
      if (!ref.mounted || ask != _asks) return;
      state = state.copyWith(resolving: false, resolveFailed: true);
    }
  }

  /// The agent picked another branch (a paused one only after a second tap, on
  /// the screen): with it, the area of that branch the point is in, if any
  void choose(DeliveryAlternative branch) {
    _zoneByHand = false;
    final zone = state.resolution == null ? null : _zoneAt(branch, state.resolution!);
    state = state.copyWith(chosen: branch, zone: zone, clearZone: zone == null);
  }

  /// The agent picked the area the caller named: the order goes to that
  /// area's branch, whatever the map or an earlier pick said. Null clears it:
  /// back to the branch the map suggests, or the agent's pick by hand.
  void pickZone(DeliveryZone? zone) {
    final resolution = state.resolution;
    if (zone == null) {
      _zoneByHand = false;
      final suggested = resolution?.suggested;
      state = state.copyWith(chosen: suggested, clearChosen: suggested == null, clearZone: true);
      return;
    }
    _zoneByHand = true;
    state = state.copyWith(zone: zone, chosen: resolution == null ? null : _branchFor(zone, resolution));
  }

  /// The branch an area belongs to, as an offer: how far it is when the map
  /// knows, and what that area asks
  static DeliveryAlternative _branchFor(DeliveryZone zone, StaffDeliveryResolution resolution) {
    var distance = 0;
    for (final b in resolution.branches) {
      if (b.branchId == zone.branchId) distance = b.distanceMeters;
    }
    return DeliveryAlternative(
      branchId: zone.branchId,
      distanceMeters: distance,
      fee: zone.fee,
      minimumOrder: zone.minimumOrder,
      paused: zone.branchPaused,
      zoneId: zone.zoneId,
      zoneName: zone.name,
      etaMinutes: zone.etaMinutes,
      zoneOff: !zone.on,
    );
  }

  /// The area of [branch] the point on the map is in, off the list (or as the
  /// offer itself describes it, should the list not have it); null when it is
  /// in none, or in one switched off: that takes the agent's own taps, by name
  static DeliveryZone? _zoneAt(DeliveryAlternative branch, StaffDeliveryResolution resolution) {
    final id = branch.zoneId;
    if (id == null || branch.zoneOff) return null;
    final listed = zoneById(resolution.zones, id);
    if (listed != null) return listed.on ? listed : null;
    return
        DeliveryZone(
          zoneId: id,
          branchId: branch.branchId,
          name: branch.zoneName ?? const LocalizedText(),
          fee: branch.fee,
          minimumOrder: branch.minimumOrder,
          etaMinutes: branch.etaMinutes,
          on: !branch.zoneOff,
          branchPaused: branch.paused,
          drawn: true,
        );
  }

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

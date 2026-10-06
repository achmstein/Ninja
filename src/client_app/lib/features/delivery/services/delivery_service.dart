import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../core/auth/auth_service.dart';
import '../../../core/brand/brand_provider.dart';
import '../../../core/network/api_client.dart';
import '../../../core/models/branch.dart';
import '../../../core/providers/branch_provider.dart';
import '../../../core/providers/branch_switch.dart';
import '../../../core/providers/current_place_provider.dart';
import '../../cart/services/cart_service.dart';
import '../models/delivery_address.dart';

/// The branch's answer for a point (`GET /api/orders/delivery/quote`): whether
/// it delivers now, whether the point is within its radius, how far, its fee
/// and its minimum
@immutable
class DeliveryQuote {
  final bool delivers;
  final bool inRange;
  final int? distanceMeters;
  final double fee;
  final double minimumOrder;

  const DeliveryQuote({required this.delivers, required this.inRange, this.distanceMeters, this.fee = 0, this.minimumOrder = 0});

  static double _num(Object? v) => v is num ? v.toDouble() : double.tryParse('$v') ?? 0;

  factory DeliveryQuote.fromJson(Map<String, dynamic> json) => DeliveryQuote(
        delivers: json['delivers'] as bool? ?? false,
        inRange: json['inRange'] as bool? ?? false,
        distanceMeters: (json['distanceMeters'] as num?)?.toInt(),
        fee: _num(json['fee']),
        minimumOrder: _num(json['minimumOrder']),
      );
}

/// Which of the business's branches deliver to a point
/// (`GET /api/orders/delivery/resolve`): nearest first, none when no branch
/// goes that far; [delivers] false while the business does not deliver at all
@immutable
class DeliveryResolution {
  final bool delivers;
  final List<({int branchId, double meters})> branches;

  const DeliveryResolution({required this.delivers, this.branches = const []});

  factory DeliveryResolution.fromJson(Map<String, dynamic> json) => DeliveryResolution(
        delivers: json['delivers'] as bool? ?? false,
        branches: [
          for (final b in (json['branches'] as List?) ?? const [])
            (branchId: ((b as Map)['branchId'] as num).toInt(), meters: DeliveryQuote._num(b['distanceMeters'])),
        ],
      );
}

/// The branch that delivers to an address: the nearest of those the server
/// says reach it that the customer can order from (open, taking orders).
/// The address, not the last branch used, decides (client_web's servingBranch)
({int branchId, double meters})? servingBranch(List<({int branchId, double meters})> reaching, List<Branch> branches) {
  for (final candidate in reaching) {
    final branch = branches.where((b) => b.id == candidate.branchId).firstOrNull;
    if (branch != null && branch.isActive && branch.isOrderingEnabled) return candidate;
  }
  return null;
}

/// The customer's own side of delivery, all on Ordering: what a delivery here
/// would cost, and their saved addresses
class DeliveryRepository {
  final ApiClient _orders;

  DeliveryRepository(this._orders);

  Future<DeliveryQuote> quote(double latitude, double longitude) async {
    final response = await _orders.get<Map<String, dynamic>>('delivery/quote', queryParameters: {'latitude': latitude, 'longitude': longitude});
    return DeliveryQuote.fromJson(response.data ?? const {});
  }

  /// Which branches reach a point, asked of no branch in particular
  Future<DeliveryResolution> resolve(double latitude, double longitude) async {
    final response = await _orders.get<Map<String, dynamic>>('delivery/resolve', queryParameters: {'latitude': latitude, 'longitude': longitude});
    return DeliveryResolution.fromJson(response.data ?? const {});
  }

  /// The signed-in customer's saved addresses, latest first
  Future<List<DeliveryAddress>> addresses() async {
    final response = await _orders.get<List<dynamic>>('addresses');
    return [for (final e in response.data ?? const []) DeliveryAddress.fromJson((e as Map).cast<String, dynamic>())];
  }

  Future<DeliveryAddress> add(DeliveryAddress address) async {
    final response = await _orders.post<Map<String, dynamic>>('addresses', data: {...address.body(), 'label': address.label});
    return DeliveryAddress.fromJson(response.data ?? address.toJson());
  }

  Future<DeliveryAddress> update(DeliveryAddress address) async {
    final response = await _orders.put<Map<String, dynamic>>('addresses/${address.id}', data: {...address.body(), 'label': address.label});
    return DeliveryAddress.fromJson(response.data ?? address.toJson());
  }

  Future<void> remove(int id) => _orders.delete<void>('addresses/$id');
}

final deliveryRepositoryProvider = Provider<DeliveryRepository>((ref) => DeliveryRepository(ref.watch(ordersApiProvider)));

/// The signed-in customer's saved addresses; none where the business does not deliver
class MyAddressesNotifier extends AsyncNotifier<List<DeliveryAddress>> {
  @override
  Future<List<DeliveryAddress>> build() async {
    final signedIn = ref.watch(authServiceProvider.select((a) => a.isAuthenticated));
    if (!signedIn || !ref.watch(featuresProvider.select((f) => f.delivery))) return const [];
    return ref.read(deliveryRepositoryProvider).addresses();
  }

  Future<void> refresh() async {
    final result = await AsyncValue.guard(build);
    if (ref.mounted) state = result;
  }
}

final myAddressesProvider = AsyncNotifierProvider<MyAddressesNotifier, List<DeliveryAddress>>(MyAddressesNotifier.new);

/// The customer's delivery choice, kept on the phone: whether they want it
/// brought (rather than collect it) and where to. It belongs to whoever
/// chose it: another account signing in on the same phone starts clean.
@immutable
class DeliveryChoice {
  final bool wanted;
  final DeliveryAddress? address;
  final String? owner;

  const DeliveryChoice({this.wanted = true, this.address, this.owner});
}

/// The web's own key, so a phone moving between the two keeps nothing it should not
const _choiceKey = 'ninja-delivery';

class DeliveryChoiceNotifier extends Notifier<DeliveryChoice> {
  @override
  DeliveryChoice build() {
    final owner = ref.watch(authServiceProvider.select((a) => a.userId));
    _restore(owner);
    return DeliveryChoice(owner: owner);
  }

  Future<void> _restore(String? owner) async {
    try {
      final raw = (await SharedPreferences.getInstance()).getString(_choiceKey);
      if (raw == null || !ref.mounted) return;
      final json = jsonDecode(raw) as Map<String, dynamic>;
      // Someone else's choice: it goes
      if (json['owner'] != owner) return;
      final address = json['address'];
      state = DeliveryChoice(
        wanted: json['wanted'] as bool? ?? true,
        address: address is Map ? DeliveryAddress.fromJson(address.cast<String, dynamic>()) : null,
        owner: owner,
      );
    } catch (e) {
      debugPrint('Delivery choice not restored: $e');
    }
  }

  Future<void> _save() async {
    try {
      await (await SharedPreferences.getInstance()).setString(
        _choiceKey,
        jsonEncode({'wanted': state.wanted, 'address': state.address?.toJson(), 'owner': state.owner}),
      );
    } catch (_) {}
  }

  void setWanted(bool wanted) {
    state = DeliveryChoice(wanted: wanted, address: state.address, owner: state.owner);
    _save();
  }

  void setAddress(DeliveryAddress? address) {
    state = DeliveryChoice(wanted: state.wanted, address: address, owner: state.owner);
    _save();
  }
}

final deliveryChoiceProvider = NotifierProvider<DeliveryChoiceNotifier, DeliveryChoice>(DeliveryChoiceNotifier.new);

/// The branch's answer for a pin, asked again when the branch changes; kept a minute
final deliveryQuoteProvider = FutureProvider.autoDispose.family<DeliveryQuote, ({double lat, double lng, int branchId})>((ref, key) async {
  final link = ref.keepAlive();
  Future<void>.delayed(const Duration(minutes: 1), link.close);
  return ref.read(deliveryRepositoryProvider).quote(key.lat, key.lng);
});

/// Which branches reach a pin; kept a minute
final deliveryResolutionProvider = FutureProvider.autoDispose.family<DeliveryResolution, ({double lat, double lng})>((ref, key) async {
  final link = ref.keepAlive();
  Future<void>.delayed(const Duration(minutes: 1), link.close);
  return ref.read(deliveryRepositoryProvider).resolve(key.lat, key.lng);
});

/// What stands in the way of a delivery, in the order the customer meets it
enum DeliveryProblem { address, checking, quoteFailed, range, minimum }

/// What stands in the way: no address, the branch still answering (or not
/// answering at all), too far, too little. Pure, so it is tested apart from
/// the providers (client_web's deliveryProblem)
DeliveryProblem? deliveryProblem({
  required bool active,
  required bool hasAddress,
  required bool quoted,
  required bool quoteFailed,
  required bool inRange,
  required double short,
}) {
  if (!active) return null;
  if (!hasAddress) return DeliveryProblem.address;
  if (quoteFailed) return DeliveryProblem.quoteFailed;
  if (!quoted) return DeliveryProblem.checking;
  if (!inRange) return DeliveryProblem.range;
  return short > 0 ? DeliveryProblem.minimum : null;
}

/// Where the order is going when it is brought: what the tray shows and the
/// order sends. Offered where the business and the branch deliver and the
/// customer is not ordering to a table or a room; the address is then quoted
/// by the branch, and the order can go once it is in range and the dishes
/// reach the minimum (client_web's useDelivery)
@immutable
class DeliveryState {
  /// The branch delivers and the order is not for a place in it
  final bool offered;

  /// Offered and chosen: the order is to be brought
  final bool active;
  final DeliveryAddress? address;

  /// What the branch adds for bringing it; 0 until quoted
  final double fee;
  final double minimum;

  /// How much more the dishes must come to; 0 when enough
  final double short;
  final bool quoted;
  final bool inRange;

  /// The branch the address belongs to, when that is not the one the order
  /// is at: the order moves there ([moveTo]), or, while the customer is at
  /// this one, is offered the move
  final ({int branchId, double meters})? servedBy;

  /// Some branch reaches the address; false when none goes that far
  final bool reached;

  /// The branch the order is to move to now, for the address: [servedBy],
  /// unless the customer is at this branch (a bill, a hold, a clock)
  final int? moveTo;
  final DeliveryProblem? problem;

  const DeliveryState({
    this.offered = false,
    this.active = false,
    this.address,
    this.fee = 0,
    this.minimum = 0,
    this.short = 0,
    this.quoted = false,
    this.inRange = false,
    this.servedBy,
    this.reached = true,
    this.moveTo,
    this.problem,
  });

  /// Active, addressed, in range and enough: nothing stands in the way
  bool get ready => active && problem == null;
}

final deliveryStateProvider = Provider<DeliveryState>((ref) {
  final delivers = ref.watch(featuresProvider.select((f) => f.delivery));
  final branch = ref.watch(branchProvider.select((b) => b.selectedBranch));
  final branches = ref.watch(branchProvider.select((b) => b.branches));
  final destination = ref.watch(orderDestinationProvider);
  // The business delivers, and so does one of its branches: whichever the order is at now, the
  // address picks the one that brings it
  final offered = delivers &&
      destination == null &&
      branch != null &&
      branches.any((b) => b.isActive && b.isDeliveryEnabled && b.isOrderingEnabled);
  if (!offered) return const DeliveryState();

  final choice = ref.watch(deliveryChoiceProvider);
  final active = choice.wanted;
  // A saved address is one of theirs, or none (removed elsewhere)
  final saved = ref.watch(myAddressesProvider).value;
  final chosen = choice.address;
  final address = chosen != null && (chosen.id == null || saved == null || saved.any((a) => a.id == chosen.id)) ? chosen : null;

  final quote = active && address != null
      ? ref.watch(deliveryQuoteProvider((lat: address.latitude, lng: address.longitude, branchId: branch.id)))
      : null;
  // Which branches reach the address, asked of no branch in particular
  final resolution = active && address != null
      ? ref.watch(deliveryResolutionProvider((lat: address.latitude, lng: address.longitude)))
      : null;
  final reaching = resolution?.value;
  final serving = reaching != null ? servingBranch(reaching.branches, branches) : null;
  final servedBy = serving != null && serving.branchId != branch.id ? serving : null;
  final reached = reaching == null || serving != null;
  // The order follows the address to its branch, unless the customer is at this one
  final moveTo = servedBy != null && !ref.watch(atBranchProvider) ? servedBy.branchId : null;

  final answer = quote?.value;
  // While the order is on its way to the address's branch, this one's answer is not the one that counts
  final quoted = answer != null && address != null && !(resolution?.isLoading ?? false) && moveTo == null;
  final inRange = quoted && answer.delivers && answer.inRange;
  final minimum = quoted ? answer.minimumOrder : 0.0;
  final short = (minimum - ref.watch(cartTotalProvider)).clamp(0.0, double.infinity);
  final problem = deliveryProblem(
    active: active,
    hasAddress: address != null,
    quoted: quoted,
    quoteFailed: quote != null && quote.hasError && !quote.isLoading,
    inRange: inRange,
    short: short,
  );
  return DeliveryState(
    offered: true,
    active: active,
    address: address,
    fee: active && inRange ? answer.fee : 0,
    minimum: minimum,
    short: short,
    quoted: quoted,
    inRange: inRange,
    servedBy: servedBy,
    reached: reached,
    moveTo: moveTo,
    problem: problem,
  );
});

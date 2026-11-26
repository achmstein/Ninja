import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/config/app_config.dart';
import '../../call_centre/call_centre_mode.dart';
import '../../customers/services/customer_search_service.dart';
import '../models/delivery_order.dart';
import '../services/delivery_service.dart';

/// What the phone-order form knows besides what is typed: the branch's
/// answer for the location it last asked about, whether it is asking, and the
/// caller's earlier addresses
@immutable
class DeliveryFormState {
  /// The branch's answer, for [quoteFor]
  final TillDeliveryQuote? quote;

  /// The pasted location [quote] answered (trimmed); its pin belongs to that text only
  final String? quoteFor;

  /// Asking the branch about the location in the field
  final bool reading;

  /// The last ask failed: no pin is known for the field
  final bool quoteFailed;

  final List<KnownAddress> known;

  /// The named area the cashier picked by name, as the branch's list has it
  final DeliveryZone? picked;

  /// With an area picked by name, the other area the pin itself falls in:
  /// said to the cashier with a way to use it, never taken over quietly
  final DeliveryZone? pinZone;

  /// The customer account that has the number typed, when there is one
  final IdentityUser? account;

  /// The location link sent to the caller, while the form waits for it or after
  final String? shareToken;

  /// Making the link
  final bool shareMaking;

  /// The link could not be made
  final bool shareFailed;

  /// The caller's point, once they shared it through the link
  final LocationShare? shared;

  /// The link stopped taking a location before the caller shared one
  final bool shareExpired;

  const DeliveryFormState({
    this.quote,
    this.quoteFor,
    this.reading = false,
    this.quoteFailed = false,
    this.known = const [],
    this.picked,
    this.pinZone,
    this.account,
    this.shareToken,
    this.shareMaking = false,
    this.shareFailed = false,
    this.shared,
    this.shareExpired = false,
  });

  /// A link was sent and the caller has not shared yet: the form waits
  bool get shareWaiting => shareToken != null && shared == null && !shareExpired;

  /// The area the delivery goes to: the one picked by name, else the one the
  /// pin fell in. The quote's fee and minimum are then that area's. An area
  /// switched off is never chosen by a pin: it takes the cashier's own taps.
  DeliveryZone? get zone => picked ?? (pinInOffArea ? null : quote?.zone);

  /// The pin fell in an area that is switched off, and the cashier picked none by name
  bool get pinInOffArea => picked == null && quote?.zoneId != null && (quote!.zoneOff || quote!.zone?.on == false);

  DeliveryFormState copyWith({
    TillDeliveryQuote? quote,
    String? quoteFor,
    bool? reading,
    bool? quoteFailed,
    List<KnownAddress>? known,
    bool clearQuote = false,
    DeliveryZone? picked,
    bool clearPicked = false,
    DeliveryZone? pinZone,
    bool clearPinZone = false,
    IdentityUser? account,
    bool clearAccount = false,
    String? shareToken,
    bool? shareMaking,
    bool? shareFailed,
    LocationShare? shared,
    bool clearShared = false,
    bool? shareExpired,
  }) =>
      DeliveryFormState(
        quote: clearQuote ? null : quote ?? this.quote,
        quoteFor: clearQuote ? null : quoteFor ?? this.quoteFor,
        reading: reading ?? this.reading,
        quoteFailed: quoteFailed ?? this.quoteFailed,
        known: known ?? this.known,
        picked: clearPicked ? null : picked ?? this.picked,
        pinZone: clearPinZone ? null : pinZone ?? this.pinZone,
        account: clearAccount ? null : account ?? this.account,
        shareToken: shareToken ?? this.shareToken,
        shareMaking: shareMaking ?? this.shareMaking,
        shareFailed: shareFailed ?? this.shareFailed,
        shared: clearShared ? null : shared ?? this.shared,
        shareExpired: shareExpired ?? this.shareExpired,
      );

  /// The pin for what is in the field now: only when the branch answered
  /// exactly this text and read a point from it
  ({double latitude, double longitude})? pinFor(String location) {
    final text = location.trim();
    final q = quote;
    if (text.isEmpty || q == null || quoteFor != text || !q.pinned) return null;
    return (latitude: q.latitude!, longitude: q.longitude!);
  }
}

/// The phone-order form's work, out of the widget: asking the branch about
/// a pasted location (debounced, the answer tied to the text it was for),
/// and looking up the caller's earlier addresses by account or number
class DeliveryFormController extends Notifier<DeliveryFormState> {
  Timer? _locationDebounce;
  Timer? _phoneDebounce;
  Timer? _sharePoll;
  String? _lastLocation;
  String _lookedUpPhone = '';
  int _asks = 0;

  @override
  DeliveryFormState build() {
    ref.onDispose(() {
      _locationDebounce?.cancel();
      _phoneDebounce?.cancel();
      _sharePoll?.cancel();
    });
    return const DeliveryFormState();
  }

  /// A link for the caller to share where their phone is: made once per form
  /// (Send again sends the same one), then asked about every few seconds
  /// until the caller shares or it stops taking one. Null when it could not be made.
  Future<LocationShareLink?> makeShareLink({Duration poll = AppConfig.locationSharePoll}) async {
    if (state.shareMaking) return null;
    state = state.copyWith(shareMaking: true, shareFailed: false);
    try {
      final link = await ref.read(deliveryRepositoryProvider).createLocationShare();
      if (!ref.mounted) return null;
      state = state.copyWith(shareToken: link.token, shareMaking: false, shareExpired: false, clearShared: true);
      watchShare(link.token, poll: poll);
      return link;
    } catch (_) {
      if (ref.mounted) state = state.copyWith(shareMaking: false, shareFailed: true);
      return null;
    }
  }

  /// Wait for what comes back through [token]: a link sent earlier for this
  /// delivery, when the form opens on it again, or one just made
  void watchShare(String token, {Duration poll = AppConfig.locationSharePoll}) {
    _sharePoll?.cancel();
    if (state.shareToken != token) state = state.copyWith(shareToken: token);
    _sharePoll = Timer.periodic(poll, (_) => unawaited(readShare()));
  }

  /// Ask once whether the caller shared; stops the waiting when they did, or the link expired
  Future<void> readShare() async {
    final token = state.shareToken;
    if (token == null || state.shared != null || state.shareExpired) {
      _sharePoll?.cancel();
      return;
    }
    try {
      final share = await ref.read(deliveryRepositoryProvider).getLocationShare(token);
      if (!ref.mounted || state.shareToken != token) return;
      if (share.shared) {
        _sharePoll?.cancel();
        state = state.copyWith(shared: share);
      } else if (share.expired) {
        _sharePoll?.cancel();
        state = state.copyWith(shareExpired: true);
      }
    } catch (_) {
      // A blip: asked again on the next tick
    }
  }

  /// The location field changed. A cursor move or a selection is not a
  /// change: only new text is asked about. [startWith] is the area a sale
  /// being changed already goes to, when the form opens on it.
  void locationChanged(String text, {Duration debounce = AppConfig.deliveryLookupDebounce, DeliveryZone? startWith}) {
    final asked = text.trim();
    if (asked == _lastLocation) return;
    _lastLocation = asked;
    _locationDebounce?.cancel();
    // The old answer is not this text's: no pin until the new one comes
    state = state.copyWith(reading: asked.isNotEmpty, quoteFailed: false, picked: startWith);
    _locationDebounce = Timer(debounce, () => readLocation(asked));
  }

  /// The cashier picked the area the caller named, or cleared it (null): the
  /// branch is asked again at once, so the fee and minimum said are that
  /// area's, or the branch's own again
  void pickZone(DeliveryZone? zone) {
    if (zone == null && state.picked == null) return;
    _locationDebounce?.cancel();
    state = state.copyWith(picked: zone, clearPicked: zone == null, reading: true, quoteFailed: false);
    unawaited(readLocation(_lastLocation ?? ''));
  }

  /// Ask the branch about [location] (its terms, and the pin read from it),
  /// for the area picked by name when there is one
  Future<void> readLocation(String location) async {
    final asked = location.trim();
    final ask = ++_asks;
    try {
      final quote = await ref.read(deliveryRepositoryProvider).tillQuote(location: asked, zoneId: state.picked?.zoneId);
      if (!ref.mounted || ask != _asks) return;
      // The area picked, as the list has it now; taken off the list, the pick goes with it
      final picked = state.picked == null ? null : zoneById(quote.zones, state.picked!.zoneId);
      state = state.copyWith(quote: quote, quoteFor: asked, reading: false, quoteFailed: false, picked: picked, clearPicked: picked == null);
      await _readPinZone(asked, ask);
    } catch (_) {
      if (!ref.mounted || ask != _asks) return;
      // Nothing known about this text: a pin from an earlier text must not stand in for it
      state = state.copyWith(clearQuote: true, reading: false, quoteFailed: true);
    }
  }

  /// With an area picked by name the branch answers for that area: the pin's
  /// own area is asked apart, so one that disagrees is said, not overruled
  Future<void> _readPinZone(String asked, int ask) async {
    final picked = state.picked;
    if (picked == null || asked.isEmpty) {
      if (state.pinZone != null) state = state.copyWith(clearPinZone: true);
      return;
    }
    try {
      final own = (await ref.read(deliveryRepositoryProvider).tillQuote(location: asked)).zone;
      if (!ref.mounted || ask != _asks) return;
      state = own != null && own.zoneId != picked.zoneId ? state.copyWith(pinZone: own) : state.copyWith(clearPinZone: true);
    } catch (_) {
      // Only a hint: without it the area picked stands
    }
  }

  /// The phone field changed: the caller's earlier addresses and their
  /// account, once the number is long enough
  void phoneChanged({required String? customerUserId, required String normalizedPhone}) {
    _phoneDebounce?.cancel();
    _phoneDebounce = Timer(AppConfig.deliveryLookupDebounce, () {
      unawaited(lookUpKnown(customerUserId: customerUserId, normalizedPhone: normalizedPhone));
      if ((customerUserId ?? '').isEmpty) unawaited(lookUpAccount(normalizedPhone));
    });
  }

  String _accountPhone = '';

  /// The one customer account with this number, switched on: their name comes with it
  Future<void> lookUpAccount(String normalizedPhone) async {
    if (normalizedPhone == _accountPhone) return;
    _accountPhone = normalizedPhone;
    if (normalizedPhone.isEmpty) {
      if (state.account != null) state = state.copyWith(clearAccount: true);
      return;
    }
    try {
      final match = (await ref.read(counterCustomerServiceProvider).lookup(phone: normalizedPhone)).match;
      if (!ref.mounted || _accountPhone != normalizedPhone) return;
      state = match != null && match.enabled ? state.copyWith(account: match) : state.copyWith(clearAccount: true);
    } catch (_) {
      // Only a convenience: the cashier types the name
    }
  }

  Future<void> lookUpKnown({required String? customerUserId, required String normalizedPhone}) async {
    final hasAccount = (customerUserId ?? '').isNotEmpty;
    if (!hasAccount && normalizedPhone.isEmpty) {
      if (state.known.isNotEmpty) state = state.copyWith(known: const []);
      return;
    }
    if (normalizedPhone == _lookedUpPhone && state.known.isNotEmpty) return;
    _lookedUpPhone = normalizedPhone;
    try {
      final known = await ref.read(deliveryRepositoryProvider).knownAddresses(
          customerUserId: customerUserId,
          phone: normalizedPhone,
          // The call centre answers for every branch: any of them may have delivered there
          everyBranch: ref.read(callCentreModeProvider));
      // The same door once, whichever list it came from
      final seen = <String>{};
      if (ref.mounted) state = state.copyWith(known: [for (final a in known) if (seen.add(a.identity)) a]);
    } catch (_) {
      // Only a convenience: the cashier types the address
    }
  }
}

final deliveryFormControllerProvider =
    NotifierProvider.autoDispose<DeliveryFormController, DeliveryFormState>(DeliveryFormController.new);

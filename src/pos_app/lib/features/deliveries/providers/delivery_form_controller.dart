import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/config/app_config.dart';
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

  const DeliveryFormState({this.quote, this.quoteFor, this.reading = false, this.quoteFailed = false, this.known = const []});

  DeliveryFormState copyWith({
    TillDeliveryQuote? quote,
    String? quoteFor,
    bool? reading,
    bool? quoteFailed,
    List<KnownAddress>? known,
    bool clearQuote = false,
  }) =>
      DeliveryFormState(
        quote: clearQuote ? null : quote ?? this.quote,
        quoteFor: clearQuote ? null : quoteFor ?? this.quoteFor,
        reading: reading ?? this.reading,
        quoteFailed: quoteFailed ?? this.quoteFailed,
        known: known ?? this.known,
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
  String? _lastLocation;
  String _lookedUpPhone = '';
  int _asks = 0;

  @override
  DeliveryFormState build() {
    ref.onDispose(() {
      _locationDebounce?.cancel();
      _phoneDebounce?.cancel();
    });
    return const DeliveryFormState();
  }

  /// The location field changed. A cursor move or a selection is not a
  /// change: only new text is asked about.
  void locationChanged(String text, {Duration debounce = AppConfig.deliveryLookupDebounce}) {
    final asked = text.trim();
    if (asked == _lastLocation) return;
    _lastLocation = asked;
    _locationDebounce?.cancel();
    // The old answer is not this text's: no pin until the new one comes
    state = state.copyWith(reading: asked.isNotEmpty, quoteFailed: false);
    _locationDebounce = Timer(debounce, () => readLocation(asked));
  }

  /// Ask the branch about [location] (its terms, and the pin read from it)
  Future<void> readLocation(String location) async {
    final asked = location.trim();
    final ask = ++_asks;
    try {
      final quote = await ref.read(deliveryRepositoryProvider).tillQuote(location: asked);
      if (!ref.mounted || ask != _asks) return;
      state = state.copyWith(quote: quote, quoteFor: asked, reading: false, quoteFailed: false);
    } catch (_) {
      if (!ref.mounted || ask != _asks) return;
      // Nothing known about this text: a pin from an earlier text must not stand in for it
      state = state.copyWith(clearQuote: true, reading: false, quoteFailed: true);
    }
  }

  /// The phone field changed: the caller's earlier addresses, once the number is long enough
  void phoneChanged({required String? customerUserId, required String normalizedPhone}) {
    _phoneDebounce?.cancel();
    _phoneDebounce = Timer(AppConfig.deliveryLookupDebounce, () => lookUpKnown(customerUserId: customerUserId, normalizedPhone: normalizedPhone));
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
      final known = await ref.read(deliveryRepositoryProvider).knownAddresses(customerUserId: customerUserId, phone: normalizedPhone);
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

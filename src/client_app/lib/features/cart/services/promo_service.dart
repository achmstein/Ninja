import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';

/// A promo code typed at checkout, and what Catalog says it is worth
/// against the cart right now. Nothing is redeemed here: the order
/// carries the code and Catalog redeems it when the items check out.
class PromoState {
  final String? code;
  final double discount;

  /// Why the code gives nothing (NotFound, Expired, AlreadyUsed…), or null
  /// when it applies; 'error' when the quote itself failed.
  final String? reason;
  final bool checking;

  const PromoState({this.code, this.discount = 0, this.reason, this.checking = false});

  bool get applied => code != null && reason == null && !checking && discount > 0;
}

class PromoNotifier extends Notifier<PromoState> {
  int _seq = 0;

  @override
  PromoState build() => const PromoState();

  Future<void> apply(String code, double subtotal) async {
    final normalized = code.trim().toUpperCase();
    if (normalized.isEmpty) return;
    state = PromoState(code: normalized, checking: true);
    await _quote(normalized, subtotal);
  }

  /// The cart changed under an applied code: ask again, the minimum and
  /// a percentage both move with the subtotal.
  Future<void> requote(double subtotal) async {
    final code = state.code;
    if (code == null) return;
    await _quote(code, subtotal);
  }

  void clear() {
    _seq++;
    state = const PromoState();
  }

  Future<void> _quote(String code, double subtotal) async {
    final seq = ++_seq;
    try {
      final response = await ref.read(catalogApiProvider).get<Map<String, dynamic>>(
        'promos/quote',
        queryParameters: {'code': code, 'subtotal': subtotal},
      );
      if (seq != _seq) return;
      final data = response.data ?? const {};
      state = PromoState(
        code: code,
        discount: ((data['discount'] ?? 0) as num).toDouble(),
        reason: data['reason'] as String?,
      );
    } catch (_) {
      if (seq != _seq) return;
      state = PromoState(code: code, reason: 'error');
    }
  }
}

final promoProvider = NotifierProvider<PromoNotifier, PromoState>(PromoNotifier.new);

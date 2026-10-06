import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../core/network/api_client.dart';
import '../../core/providers/current_place_provider.dart';
import 'models/pay_view.dart';
import 'pay_math.dart';
import 'services/pay_service.dart';

/// Paying ahead online (client_web's lib/pay-ahead.ts): an order brought to
/// the door or collected at the counter can be paid by card or wallet as it is
/// placed, the till seeing it only once it is paid. Where the business takes
/// it (Sales says so, with the fee a guest would carry), the open order asks
/// Online or Cash; the last answer is kept on the phone. An order for a table
/// or a room is paid on its bill, never ahead.

double _num(dynamic v) => v is num ? v.toDouble() : double.tryParse('${v ?? ''}') ?? 0;

/// Whether the customer can pay ahead here (Sales `PayAheadOptionsView`)
class PayAheadOptions {
  final bool available;
  final String currency;
  final bool guestPaysFee;
  final double feePercent;
  final double feeFixed;
  final bool simulated;

  /// A card is only held at the checkout, and charged once the branch accepts the order
  final bool holdsCards;

  const PayAheadOptions({
    this.available = false,
    this.currency = 'EGP',
    this.guestPaysFee = false,
    this.feePercent = 0,
    this.feeFixed = 0,
    this.simulated = false,
    this.holdsCards = false,
  });

  factory PayAheadOptions.fromJson(Map<String, dynamic> json) => PayAheadOptions(
        available: json['available'] as bool? ?? false,
        currency: json['currency'] as String? ?? 'EGP',
        guestPaysFee: json['feeMode'] == 'Guest',
        feePercent: _num(json['feePercent']),
        feeFixed: _num(json['feeFixed']),
        simulated: json['simulated'] as bool? ?? false,
        holdsCards: json['holdsCards'] as bool? ?? false,
      );

  /// What the card or wallet is charged over an order of [total]: the fee, where the customer carries it
  double feeFor(double total) => guestPaysFee ? guestFee(total, feePercent, feeFixed) : 0;
}

/// An order paid ahead as its customer pays it (Sales `OrderPayView`)
class OrderToPay {
  final int orderId;
  final double amount;
  final double fee;
  final double charged;
  final String currency;

  /// "Due" (waiting for its payment), "Paid" or "Cancelled"
  final String status;
  final DateTime dueBy;
  final String? paymentKey;
  final String? paymentStatus;
  final bool simulated;
  final bool holdsCards;

  const OrderToPay({
    required this.orderId,
    required this.amount,
    required this.fee,
    required this.charged,
    required this.currency,
    required this.status,
    required this.dueBy,
    this.paymentKey,
    this.paymentStatus,
    this.simulated = false,
    this.holdsCards = false,
  });

  bool get isDue => status == 'Due';
  bool get isPaid => status == 'Paid';

  factory OrderToPay.fromJson(Map<String, dynamic> json) => OrderToPay(
        orderId: (json['orderId'] as num).toInt(),
        amount: _num(json['amount']),
        fee: _num(json['fee']),
        charged: _num(json['charged']),
        currency: json['currency'] as String? ?? 'EGP',
        status: json['status'] as String? ?? 'Due',
        dueBy: DateTime.parse(json['dueBy'] as String),
        paymentKey: json['paymentKey'] as String?,
        paymentStatus: json['paymentStatus'] as String?,
        simulated: json['simulated'] as bool? ?? false,
        holdsCards: json['holdsCards'] as bool? ?? false,
      );
}

/// Sales' pay-ahead calls, on the payments API
class PayAheadRepository {
  final ApiClient api;

  PayAheadRepository(this.api);

  /// Whether the customer can pay ahead here; nothing offered when it cannot be asked
  Future<PayAheadOptions> payAheadOptions() async {
    final response = await api.get<Map<String, dynamic>>('ahead');
    return PayAheadOptions.fromJson(response.data!);
  }

  /// The order as its customer pays it; null until Sales has heard of it (a moment after it is placed)
  Future<OrderToPay?> orderToPay(int orderId) async {
    try {
      final response = await api.get<Map<String, dynamic>>('orders/$orderId');
      return OrderToPay.fromJson(response.data!);
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) return null;
      rethrow;
    }
  }

  /// Starts paying the order; the checkout to send the customer to. Throws [PayException] with the reason when refused
  Future<StartedPayment> startOrder(int orderId, {String? payerName, String? payerPhone}) async {
    try {
      final response = await api.post<Map<String, dynamic>>('orders/$orderId', data: {'payerName': payerName, 'payerPhone': payerPhone});
      return StartedPayment.fromJson(response.data!);
    } on DioException catch (e) {
      final data = e.response?.data;
      if (e.response?.statusCode == 400 && data is Map && data['detail'] is String) throw PayException(data['detail'] as String);
      if (e.response?.statusCode == 404) throw const NothingToPay();
      rethrow;
    }
  }
}

final payAheadRepositoryProvider = Provider<PayAheadRepository>((ref) => PayAheadRepository(ref.read(paymentsApiProvider)));

/// Whether the business takes payment ahead, asked once a while
final payAheadOptionsProvider = FutureProvider<PayAheadOptions>((ref) async {
  try {
    return await ref.read(payAheadRepositoryProvider).payAheadOptions();
  } catch (_) {
    // Not asked: not offered, and the order is paid as before
    return const PayAheadOptions();
  }
});

enum PayMethod { online, cash }

/// The customer's last answer, kept on the phone for the next order (the web's key); online until they say otherwise
class PayChoiceNotifier extends Notifier<PayMethod> {
  static const _key = 'ninja-pay-choice';

  @override
  PayMethod build() {
    _load();
    return PayMethod.online;
  }

  Future<void> _load() async {
    try {
      final saved = (await SharedPreferences.getInstance()).getString(_key);
      if (saved == 'cash') state = PayMethod.cash;
    } catch (_) {}
  }

  Future<void> set(PayMethod method) async {
    state = method;
    try {
      (await SharedPreferences.getInstance()).setString(_key, method.name);
    } catch (_) {}
  }
}

final payChoiceProvider = NotifierProvider<PayChoiceNotifier, PayMethod>(PayChoiceNotifier.new);

/// Whether, and how, the order being made is paid ahead
class PayAhead {
  /// It may be: it goes to a door or the counter, and the business takes it
  final bool offered;

  /// It will be: offered, and the customer chose to
  final bool online;
  final PayAheadOptions options;

  const PayAhead({required this.offered, required this.online, required this.options});

  double feeFor(double total) => online ? options.feeFor(total) : 0;
}

final payAheadProvider = Provider<PayAhead>((ref) {
  final forDoorOrCounter = ref.watch(orderDestinationProvider) == null;
  final options = ref.watch(payAheadOptionsProvider).value ?? const PayAheadOptions();
  final offered = forDoorOrCounter && options.available;
  return PayAhead(offered: offered, online: offered && ref.watch(payChoiceProvider) == PayMethod.online, options: options);
});

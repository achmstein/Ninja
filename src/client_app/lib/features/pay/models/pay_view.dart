import '../../../core/models/localized_text.dart';

double _num(dynamic v) => v is num ? v.toDouble() : double.tryParse('${v ?? ''}') ?? 0;

/// One line of the bill as a paying guest sees it (Sales `PayLineView`).
class PayLine {
  final int id;
  final LocalizedText description;
  final LocalizedText? details;
  final double qty;
  final double total;

  /// Its part of the total, with the discount, service and VAT taken through
  final double share;

  /// Paid for, or being paid for, by someone: not selectable
  final bool claimed;

  /// Ordered by this guest
  final bool isMine;

  const PayLine({
    required this.id,
    required this.description,
    this.details,
    required this.qty,
    required this.total,
    required this.share,
    this.claimed = false,
    this.isMine = false,
  });

  factory PayLine.fromJson(Map<String, dynamic> json) => PayLine(
        id: (json['id'] as num).toInt(),
        description: LocalizedText.parse(json['description']),
        details: LocalizedText.parseNullable(json['details']),
        qty: _num(json['qty']),
        total: _num(json['total']),
        share: _num(json['share']),
        claimed: json['claimed'] as bool? ?? false,
        isMine: json['isMine'] as bool? ?? false,
      );
}

/// A share paid or in checkout, as the table sees it (Sales `PayShareView`).
class PayShare {
  final String? payerName;
  final double amount;

  /// "Pending" or "Paid"
  final String status;
  final DateTime? paidAt;
  final bool isMine;

  /// The payment's key; only on the guest's own shares
  final String? key;

  const PayShare({
    this.payerName,
    required this.amount,
    required this.status,
    this.paidAt,
    this.isMine = false,
    this.key,
  });

  bool get isPaid => status == 'Paid';
  bool get isPending => status == 'Pending';

  /// The guest's own share still held in checkout: theirs to cancel or finish
  bool get isMyPending => isMine && isPending && key != null;

  factory PayShare.fromJson(Map<String, dynamic> json) => PayShare(
        payerName: json['payerName'] as String?,
        amount: _num(json['amount']),
        status: json['status'] as String? ?? '',
        paidAt: json['paidAt'] == null ? null : DateTime.tryParse(json['paidAt'] as String),
        isMine: json['isMine'] as bool? ?? false,
        key: json['key'] as String?,
      );
}

/// How the café takes payments (Sales `PayOptionsView`).
class PayOptions {
  final bool ready;
  final String currency;

  /// "Cafe" (the café absorbs the provider's fee) or "Guest"
  final String feeMode;
  final double feePercent;
  final double feeFixed;
  final bool allowItems;
  final bool allowEqual;
  final bool allowCustom;
  final bool card;
  final bool wallet;
  final bool applePay;

  /// A demo café without a provider: its checkout is a pretend page
  final bool simulated;

  const PayOptions({
    this.ready = false,
    this.currency = 'EGP',
    this.feeMode = 'Cafe',
    this.feePercent = 0,
    this.feeFixed = 0,
    this.allowItems = false,
    this.allowEqual = false,
    this.allowCustom = false,
    this.card = false,
    this.wallet = false,
    this.applePay = false,
    this.simulated = false,
  });

  bool get guestPaysFee => feeMode == 'Guest';
  bool get canSplit => allowItems || allowEqual || allowCustom;

  factory PayOptions.fromJson(Map<String, dynamic> json) => PayOptions(
        ready: json['ready'] as bool? ?? false,
        currency: json['currency'] as String? ?? 'EGP',
        feeMode: json['feeMode'] as String? ?? 'Cafe',
        feePercent: _num(json['feePercent']),
        feeFixed: _num(json['feeFixed']),
        allowItems: json['allowItems'] as bool? ?? false,
        allowEqual: json['allowEqual'] as bool? ?? false,
        allowCustom: json['allowCustom'] as bool? ?? false,
        card: json['card'] as bool? ?? false,
        wallet: json['wallet'] as bool? ?? false,
        applePay: json['applePay'] as bool? ?? false,
        simulated: json['simulated'] as bool? ?? false,
      );
}

/// A bill as a guest pays it (Sales `PayView`): what is on it, what is paid,
/// held and left, and how the café lets them split it.
class PayView {
  final int ticketId;
  final int? placeId;
  final LocalizedText? locationName;
  final String status;
  final List<PayLine> lines;
  final double subtotal;
  final double discount;
  final double serviceCharge;
  final double vat;
  final double total;
  final double paid;
  final double held;
  final double remaining;
  final List<PayShare> shares;

  /// Who sat at the table, where the bill knows (a room's party)
  final int? people;
  final PayOptions options;
  final bool canPay;

  /// Why not: "off", "not-set-up", "closed", "clock-running", "empty",
  /// "paid", "being-paid"; null when [canPay]
  final String? why;

  const PayView({
    required this.ticketId,
    this.placeId,
    this.locationName,
    this.status = 'Open',
    this.lines = const [],
    this.subtotal = 0,
    this.discount = 0,
    this.serviceCharge = 0,
    this.vat = 0,
    required this.total,
    this.paid = 0,
    this.held = 0,
    required this.remaining,
    this.shares = const [],
    this.people,
    this.options = const PayOptions(),
    this.canPay = false,
    this.why,
  });

  factory PayView.fromJson(Map<String, dynamic> json) => PayView(
        ticketId: (json['ticketId'] as num).toInt(),
        placeId: (json['placeId'] as num?)?.toInt(),
        locationName: LocalizedText.parseNullable(json['locationName']),
        status: json['status'] as String? ?? 'Open',
        lines: ((json['lines'] as List<dynamic>?) ?? const [])
            .map((e) => PayLine.fromJson(e as Map<String, dynamic>))
            .toList(),
        subtotal: _num(json['subtotal']),
        discount: _num(json['discount']),
        serviceCharge: _num(json['serviceCharge']),
        vat: _num(json['vat']),
        total: _num(json['total']),
        paid: _num(json['paid']),
        held: _num(json['held']),
        remaining: _num(json['remaining']),
        shares: ((json['shares'] as List<dynamic>?) ?? const [])
            .map((e) => PayShare.fromJson(e as Map<String, dynamic>))
            .toList(),
        people: (json['people'] as num?)?.toInt(),
        options: json['options'] is Map<String, dynamic>
            ? PayOptions.fromJson(json['options'] as Map<String, dynamic>)
            : const PayOptions(),
        canPay: json['canPay'] as bool? ?? false,
        why: json['why'] as String?,
      );
}

/// Where the provider's checkout waits for the guest (Sales `StartedPayment`).
class StartedPayment {
  final String key;
  final String checkoutUrl;
  final double amount;
  final double fee;
  final double charged;

  const StartedPayment({
    required this.key,
    required this.checkoutUrl,
    required this.amount,
    required this.fee,
    required this.charged,
  });

  factory StartedPayment.fromJson(Map<String, dynamic> json) => StartedPayment(
        key: json['key'] as String,
        checkoutUrl: json['checkoutUrl'] as String,
        amount: _num(json['amount']),
        fee: _num(json['fee']),
        charged: _num(json['charged']),
      );
}

/// How one payment stands (Sales `PaymentStatusView`).
class PaymentStatus {
  /// "Pending", "Paid", "Failed", "Expired" or "Refunded"
  final String status;
  final double amount;
  final double fee;
  final double charged;
  final String currency;
  final String? failureReason;
  final bool billClosed;

  const PaymentStatus({
    required this.status,
    this.amount = 0,
    this.fee = 0,
    this.charged = 0,
    this.currency = 'EGP',
    this.failureReason,
    this.billClosed = false,
  });

  bool get isPending => status == 'Pending';
  bool get isPaid => status == 'Paid';

  factory PaymentStatus.fromJson(Map<String, dynamic> json) => PaymentStatus(
        status: json['status'] as String? ?? 'Pending',
        amount: _num(json['amount']),
        fee: _num(json['fee']),
        charged: _num(json['charged']),
        currency: json['currency'] as String? ?? 'EGP',
        failureReason: json['failureReason'] as String?,
        billClosed: json['billClosed'] as bool? ?? false,
      );
}

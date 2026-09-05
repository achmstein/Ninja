import '../../features/sale/models/sale_line.dart';
import '../../features/tickets/models/settle.dart';
import '../models/money.dart';

enum OfflineSaleStatus { queued, failed }

/// What the sale pad knows about a counter sale before any money is taken;
/// the settle dialog turns it into an [OfflineSale] once it is paid
class OfflineSaleDraft {
  /// The order's idempotency key — the same one an online charge would use
  final String requestId;
  final DateTime placedAt;
  final List<SaleLine> lines;
  final String note;
  final SaleCustomer? customer;

  const OfflineSaleDraft({required this.requestId, required this.placedAt, required this.lines, this.note = '', this.customer});
}

/// A counter sale rung up and paid while the backend was out of reach:
/// everything the till needs to replay it later exactly as it happened —
/// the lines, who paid what, when, and the number it printed on the
/// customer's receipt. The ids double as idempotency keys, so a replay cut
/// off halfway can be retried without selling anything twice.
class OfflineSale {
  final String id;
  final String settleRequestId;
  final DateTime placedAt;
  final int? branchId;
  final String provisionalReceiptNumber;
  final List<SaleLine> lines;
  final String note;
  final SaleCustomer? customer;
  final List<SettlePayment> payments;
  final double subtotal;
  final double vat;
  final double total;
  final double change;
  final OfflineSaleStatus status;
  final String? error;

  /// Filled in as the replay progresses, so a retry picks up where it stopped
  final int? orderId;
  final int? ticketId;

  const OfflineSale({
    required this.id,
    required this.settleRequestId,
    required this.placedAt,
    required this.branchId,
    required this.provisionalReceiptNumber,
    required this.lines,
    this.note = '',
    this.customer,
    required this.payments,
    required this.subtotal,
    required this.vat,
    required this.total,
    required this.change,
    this.status = OfflineSaleStatus.queued,
    this.error,
    this.orderId,
    this.ticketId,
  });

  OfflineSale copyWith({OfflineSaleStatus? status, String? error, bool clearError = false, int? orderId, int? ticketId}) =>
      OfflineSale(
        id: id,
        settleRequestId: settleRequestId,
        placedAt: placedAt,
        branchId: branchId,
        provisionalReceiptNumber: provisionalReceiptNumber,
        lines: lines,
        note: note,
        customer: customer,
        payments: payments,
        subtotal: subtotal,
        vat: vat,
        total: total,
        change: change,
        status: status ?? this.status,
        error: clearError ? null : (error ?? this.error),
        orderId: orderId ?? this.orderId,
        ticketId: ticketId ?? this.ticketId,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'settleRequestId': settleRequestId,
        'placedAt': placedAt.toUtc().toIso8601String(),
        'branchId': branchId,
        'provisionalReceiptNumber': provisionalReceiptNumber,
        'lines': lines.map((l) => l.toJson()).toList(),
        'note': note,
        'customer': customer?.toJson(),
        'payments': payments.map((p) => p.toJson()).toList(),
        'subtotal': subtotal,
        'vat': vat,
        'total': total,
        'change': change,
        'status': status.name,
        'error': error,
        'orderId': orderId,
        'ticketId': ticketId,
      };

  factory OfflineSale.fromJson(Map<String, dynamic> json) => OfflineSale(
        id: json['id'] as String,
        settleRequestId: json['settleRequestId'] as String,
        placedAt: DateTime.parse(json['placedAt'] as String),
        branchId: json['branchId'] as int?,
        provisionalReceiptNumber: json['provisionalReceiptNumber'] as String,
        lines: ((json['lines'] as List<dynamic>?) ?? []).map((e) => SaleLine.fromJson(e as Map<String, dynamic>)).toList(),
        note: json['note'] as String? ?? '',
        customer: json['customer'] == null ? null : SaleCustomer.fromJson(json['customer'] as Map<String, dynamic>),
        payments: ((json['payments'] as List<dynamic>?) ?? []).map((e) => SettlePayment.fromJson(e as Map<String, dynamic>)).toList(),
        subtotal: toNumber(json['subtotal']),
        vat: toNumber(json['vat']),
        total: toNumber(json['total']),
        change: toNumber(json['change']),
        status: json['status'] == OfflineSaleStatus.failed.name ? OfflineSaleStatus.failed : OfflineSaleStatus.queued,
        error: json['error'] as String?,
        orderId: json['orderId'] as int?,
        ticketId: json['ticketId'] as int?,
      );
}

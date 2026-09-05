import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/models/money.dart';
import '../../../core/network/api_client.dart';
import '../models/move_lines.dart';
import '../models/open_ticket.dart';
import '../models/pricing.dart';
import '../models/refund.dart';
import '../models/settled_ticket_summary.dart';
import '../models/settle.dart';
import '../models/ticket_detail.dart';
import '../models/ticket_summary.dart';

/// A rule the server refused (a 400 with a plain-text reason) — surfaced
/// to the cashier as the toast text, like pos_web shows `response.data`.
class SalesException implements Exception {
  final String message;
  const SalesException(this.message);

  @override
  String toString() => message;
}

class TicketNotFound implements Exception {
  const TicketNotFound();
}

abstract class TicketsRepository {
  Future<List<TicketSummary>> getOpenTickets();

  /// Throws [TicketNotFound] when the bill is gone (discarded, or never existed).
  Future<TicketDetail> getTicket(int id);

  /// The ticket a confirmed order landed on; null while the confirmation
  /// event is still in flight (the till polls this after a counter sale).
  Future<int?> getTicketByOrder(int orderId);

  /// Returns the new ticket id, or 0 when the request id was already accepted
  /// Closed bills, newest receipt first; `receiptNumber` narrows it to one.
  /// No total count: a full page means "maybe more"
  Future<List<SettledTicketSummary>> getSettledTickets({int pageIndex = 0, int pageSize = 50, int? receiptNumber});

  /// The branch's service charge and VAT rules, as the server prices with
  Future<PricingView> getPricing(int branchId);

  Future<int> openTicket(OpenTicketRequest request, {String? requestId});

  Future<SettleResult> settle(int id, SettleRequest request, {String? requestId});

  /// Discard an empty open ticket (counter and table only)
  Future<void> discard(int id, {String? requestId});

  /// Move lines to another bill (or a new one); returns the bill they landed on
  Future<int> moveLines(int id, MoveLinesRequest request, {String? requestId});

  /// Name (or re-name) whose lines these are — a Sales-side snapshot on just
  /// those lines; a whole order goes through Ordering instead
  Future<void> assignLinesCustomer(int id, {required List<int> lineIds, String? customerId, required String customerName, String? requestId});

  /// Owner-only: void an open ticket with a reason
  Future<void> voidTicket(int id, String reason, {String? requestId});

  /// Owner-only: a credit note against a settled ticket
  Future<RefundResult> refund(int id, RefundRequest request, {String? requestId});
}

class ApiTicketsRepository implements TicketsRepository {
  final ApiClient _apiClient;

  ApiTicketsRepository(this._apiClient);

  @override
  Future<List<TicketSummary>> getOpenTickets() async {
    final response = await _apiClient.get<List<dynamic>>('tickets/open');
    return (response.data ?? [])
        .map((e) => TicketSummary.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<TicketDetail> getTicket(int id) async {
    try {
      final response = await _apiClient.get<Map<String, dynamic>>('tickets/$id');
      return TicketDetail.fromJson(response.data!);
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) throw const TicketNotFound();
      rethrow;
    }
  }

  @override
  Future<int?> getTicketByOrder(int orderId) async {
    try {
      final response = await _apiClient.get<Map<String, dynamic>>('tickets/by-order/$orderId');
      return toInt(response.data?['ticketId']);
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) return null;
      rethrow;
    }
  }

  @override
  Future<List<SettledTicketSummary>> getSettledTickets({int pageIndex = 0, int pageSize = 50, int? receiptNumber}) async {
    final response = await _apiClient.get<List<dynamic>>(
      'tickets/settled',
      queryParameters: {
        'pageIndex': pageIndex,
        'pageSize': pageSize,
        'receiptNumber': ?receiptNumber,
      },
    );
    return (response.data ?? []).map((e) => SettledTicketSummary.fromJson(e as Map<String, dynamic>)).toList();
  }

  @override
  Future<PricingView> getPricing(int branchId) async {
    final response = await _apiClient.get<Map<String, dynamic>>('tickets/pricing/$branchId');
    return PricingView.fromJson(response.data!);
  }

  @override
  Future<int> openTicket(OpenTicketRequest request, {String? requestId}) async {
    try {
      final response = await _apiClient.post<Map<String, dynamic>>(
        'tickets',
        data: request.toJson(),
        requestId: requestId,
      );
      return toInt(response.data?['ticketId']);
    } on DioException catch (e) {
      throw asSalesException(e);
    }
  }

  @override
  Future<SettleResult> settle(int id, SettleRequest request, {String? requestId}) async {
    try {
      final response = await _apiClient.post<Map<String, dynamic>>(
        'tickets/$id/settle',
        data: request.toJson(),
        requestId: requestId,
      );
      return SettleResult.fromJson(response.data!);
    } on DioException catch (e) {
      throw asSalesException(e);
    }
  }

  @override
  Future<void> discard(int id, {String? requestId}) async {
    try {
      await _apiClient.delete('tickets/$id', requestId: requestId);
    } on DioException catch (e) {
      throw asSalesException(e);
    }
  }

  @override
  Future<int> moveLines(int id, MoveLinesRequest request, {String? requestId}) async {
    try {
      final response = await _apiClient.post<Map<String, dynamic>>(
        'tickets/$id/move-lines',
        data: request.toJson(),
        requestId: requestId,
      );
      return toInt(response.data?['ticketId']);
    } on DioException catch (e) {
      throw asSalesException(e);
    }
  }

  @override
  Future<void> assignLinesCustomer(int id,
      {required List<int> lineIds, String? customerId, required String customerName, String? requestId}) async {
    try {
      await _apiClient.post(
        'tickets/$id/lines/customer',
        data: {'lineIds': lineIds, 'customerId': customerId, 'customerName': customerName},
        requestId: requestId,
      );
    } on DioException catch (e) {
      throw asSalesException(e);
    }
  }

  @override
  Future<void> voidTicket(int id, String reason, {String? requestId}) async {
    try {
      await _apiClient.post('tickets/$id/void', data: {'reason': reason}, requestId: requestId);
    } on DioException catch (e) {
      throw asSalesException(e);
    }
  }

  @override
  Future<RefundResult> refund(int id, RefundRequest request, {String? requestId}) async {
    try {
      final response = await _apiClient.post<Map<String, dynamic>>(
        'tickets/$id/refunds',
        data: request.toJson(),
        requestId: requestId,
      );
      return RefundResult.fromJson(response.data!);
    } on DioException catch (e) {
      throw asSalesException(e);
    }
  }
}

final ticketsRepositoryProvider = Provider<TicketsRepository>((ref) {
  return ApiTicketsRepository(ref.read(salesApiProvider));
});

/// A 400 carries the domain's own words (a rule Sales refused); anything
/// else stays a transport error for the generic toast
Exception asSalesException(DioException e) {
  final data = e.response?.data;
  if (e.response?.statusCode == 400 && data is String && data.isNotEmpty) {
    return SalesException(data);
  }
  if (data is Map && data['title'] is String) {
    return SalesException(data['title'] as String);
  }
  return e;
}

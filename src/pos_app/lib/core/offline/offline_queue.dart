import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../features/orders/services/order_service.dart';
import '../../features/sale/models/pos_order_request.dart';
import '../../features/tickets/models/settle.dart';
import '../../features/tickets/providers/tickets_provider.dart';
import '../../features/tickets/services/tickets_service.dart';
import '../config/app_config.dart';
import '../network/network_status.dart';
import 'offline_sale.dart';

const _salesKey = 'pos.offline.sales';
const _nextNumberKey = 'pos.offline.next';

List<OfflineSale> _initial = const [];

/// Read before `runApp`, like the cart: what was sold during the last
/// outage is whole before any screen can ask about it
Future<void> initializeOfflineQueue() async {
  final prefs = await SharedPreferences.getInstance();
  final raw = prefs.getString(_salesKey);
  if (raw == null) return;
  try {
    _initial = [for (final e in json.decode(raw) as List<dynamic>) OfflineSale.fromJson(e as Map<String, dynamic>)];
  } catch (_) {
    _initial = const [];
  }
}

/// The next provisional receipt number this till hands out: `P-0001`,
/// `P-0002`, … — printed on the offline receipt and echoed by the server
/// beside the real number once the sale is replayed
Future<String> nextProvisionalReceiptNumber() async {
  final prefs = await SharedPreferences.getInstance();
  final next = (prefs.getInt(_nextNumberKey) ?? 0) + 1;
  await prefs.setInt(_nextNumberKey, next);
  return 'P-${next.toString().padLeft(4, '0')}';
}

/// The sales rung up while the backend was out of reach, replayed in order
/// the moment it is back: the POS order (dated when it was sold, confirmed
/// on arrival), then the settle against the ticket it opened (dated the
/// same, carrying the provisional number). A replay that cannot reach the
/// server stops and waits; one the server refuses is kept as failed, with
/// its reason, for the cashier to look at.
class OfflineQueueNotifier extends Notifier<List<OfflineSale>> {
  bool _draining = false;

  @override
  List<OfflineSale> build() => _initial;

  int get queuedCount => state.where((s) => s.status == OfflineSaleStatus.queued).length;
  int get failedCount => state.where((s) => s.status == OfflineSaleStatus.failed).length;

  Future<void> enqueue(OfflineSale sale) => _set([...state, sale]);

  Future<void> discard(String id) => _set(state.where((s) => s.id != id).toList());

  Future<void> retry(String id) async {
    await _update(id, (s) => s.copyWith(status: OfflineSaleStatus.queued, clearError: true));
    await drain();
  }

  Future<void> drain() async {
    if (_draining) return;
    _draining = true;
    try {
      for (final sale in List.of(state.where((s) => s.status == OfflineSaleStatus.queued))) {
        try {
          await _replay(sale);
          await _set(state.where((s) => s.id != sale.id).toList());
        } catch (e) {
          if (NetworkStatus.isConnectionError(e)) {
            // Still out — everything behind it waits too
            networkStatus.reportFailure();
            break;
          }
          await _update(sale.id, (s) => s.copyWith(status: OfflineSaleStatus.failed, error: _describe(e)));
        }
      }
      if (ref.mounted && state.isNotEmpty) {
        ref.read(openTicketsProvider.notifier).refresh();
      }
    } finally {
      _draining = false;
    }
  }

  Future<void> _replay(OfflineSale sale) async {
    final orders = ref.read(orderRepositoryProvider);
    final tickets = ref.read(ticketsRepositoryProvider);

    var current = sale;
    if (current.orderId == null) {
      final orderId = await orders.createPosOrder(
        PosOrderRequest(lines: current.lines, note: current.note, customer: current.customer, placedAt: current.placedAt, replay: true),
        requestId: current.id,
      );
      // 0 is a deduplicated retry whose id was lost with the till's memory:
      // the order is in, its ticket is on the floor, and only the settle is
      // missing — a person has to do that one
      if (orderId == 0) throw const SalesException('The order was already placed; settle its ticket from the floor.');
      current = current.copyWith(orderId: orderId);
      await _update(current.id, (_) => current);
    }

    if (current.ticketId == null) {
      final ticketId = await _awaitTicket(tickets, current.orderId!);
      current = current.copyWith(ticketId: ticketId);
      await _update(current.id, (_) => current);
    }

    await tickets.settle(
      current.ticketId!,
      SettleRequest(
        payments: current.payments,
        settledAt: current.placedAt,
        provisionalReceiptNumber: current.provisionalReceiptNumber,
      ),
      requestId: current.settleRequestId,
    );
  }

  // The counter ticket materializes off the order-confirmed event, so the
  // order → ticket lookup 404s for a moment
  Future<int> _awaitTicket(TicketsRepository tickets, int orderId) async {
    final deadline = DateTime.now().add(AppConfig.ticketByOrderTimeout);
    while (true) {
      final ticketId = await tickets.getTicketByOrder(orderId);
      if (ticketId != null) return ticketId;
      if (DateTime.now().isAfter(deadline)) {
        throw const SalesException('The order went through but its ticket has not appeared yet. Try again in a moment.');
      }
      await Future<void>.delayed(AppConfig.ticketByOrderPoll);
    }
  }

  static String _describe(Object e) {
    if (e is SalesException) return e.message;
    if (e is DioException) {
      final data = e.response?.data;
      if (data is String && data.isNotEmpty && data.length < 200) return data;
      return 'HTTP ${e.response?.statusCode ?? '?'}';
    }
    return e.toString();
  }

  Future<void> _update(String id, OfflineSale Function(OfflineSale) change) =>
      _set([for (final s in state) s.id == id ? change(s) : s]);

  Future<void> _set(List<OfflineSale> next) async {
    state = next;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_salesKey, json.encode(next.map((s) => s.toJson()).toList()));
    } catch (e) {
      debugPrint('Offline queue not saved: $e');
    }
  }
}

final offlineQueueProvider = NotifierProvider<OfflineQueueNotifier, List<OfflineSale>>(OfflineQueueNotifier.new);

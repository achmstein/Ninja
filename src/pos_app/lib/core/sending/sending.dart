import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ninja_app_core/network/api_client.dart' show inBranch;
import 'package:ninja_app_core/network/network_status.dart';
import 'package:ninja_app_core/providers/locale_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../features/catalog/services/catalog_service.dart';
import '../../features/orders/services/order_service.dart';
import '../../features/sale/models/pos_order_request.dart';
import '../../features/sale/models/sale_line.dart';
import '../../features/tickets/providers/tickets_provider.dart';
import '../../l10n/app_localizations.dart';
import '../network/api_errors.dart';

const _sendsKey = 'pos.sending';

/// Past this, a placed order whose lines never showed is let go: it is in,
/// and its bill catches up over SignalR or the floor's own refresh
const placedTimeout = Duration(seconds: 15);

/// How long a line that just landed keeps its tick
const _landedFor = Duration(milliseconds: 1500);

/// - `sending`: the order is on its way to the server
/// - `placed`: the server took it; the ticket has not shown its lines yet
/// - `failed`: it never got in, and waits for the cashier to retry or remove it
enum SendStatus { sending, placed, failed }

/// A charge the till has already shown on the bill but the server has not
/// confirmed yet: lines added to an open ticket, or a new counter sale
/// whose ticket does not exist yet. Kept on the device, so a restart or a
/// dropped connection never loses one; the request id makes sending it
/// again safe (the server recognises a repeat and does not sell it twice).
/// The web twin is pos_web's features/sending.
class Sending {
  /// The order's idempotency key, and this entry's id
  final String requestId;

  /// The bill the lines go onto; null for a new counter sale
  final int? ticketId;

  /// Where it was rung up: a retry goes there whatever branch the till shows by then
  final int? branchId;
  final List<SaleLine> lines;
  final String note;
  final SaleCustomer? customer;
  final SendStatus status;
  final int? orderId;

  /// What the cashier is told when the server refused it
  final String? error;

  /// The connection, not the server, stopped it: a counter sale can still be taken offline
  final bool offline;

  /// When it was sent, or placed once it is: what the timeouts count from
  final DateTime startedAt;

  const Sending({
    required this.requestId,
    required this.ticketId,
    required this.branchId,
    required this.lines,
    this.note = '',
    this.customer,
    this.status = SendStatus.sending,
    this.orderId,
    this.error,
    this.offline = false,
    required this.startedAt,
  });

  double get total => saleTotal(lines);

  Sending copyWith({SendStatus? status, int? orderId, String? error, bool clearError = false, bool? offline, DateTime? startedAt}) =>
      Sending(
        requestId: requestId,
        ticketId: ticketId,
        branchId: branchId,
        lines: lines,
        note: note,
        customer: customer,
        status: status ?? this.status,
        orderId: orderId ?? this.orderId,
        error: clearError ? null : (error ?? this.error),
        offline: offline ?? this.offline,
        startedAt: startedAt ?? this.startedAt,
      );

  Map<String, dynamic> toJson() => {
        'requestId': requestId,
        'ticketId': ticketId,
        'branchId': branchId,
        'lines': lines.map((l) => l.toJson()).toList(),
        'note': note,
        'customer': customer?.toJson(),
        'status': status.name,
        'orderId': orderId,
        'error': error,
        'offline': offline,
        'startedAt': startedAt.toUtc().toIso8601String(),
      };

  factory Sending.fromJson(Map<String, dynamic> json) => Sending(
        requestId: json['requestId'] as String,
        ticketId: json['ticketId'] as int?,
        branchId: json['branchId'] as int?,
        lines: ((json['lines'] as List<dynamic>?) ?? []).map((e) => SaleLine.fromJson(e as Map<String, dynamic>)).toList(),
        note: json['note'] as String? ?? '',
        customer: json['customer'] == null ? null : SaleCustomer.fromJson(json['customer'] as Map<String, dynamic>),
        status: SendStatus.values.firstWhere((s) => s.name == json['status'], orElse: () => SendStatus.failed),
        orderId: json['orderId'] as int?,
        error: json['error'] as String?,
        offline: json['offline'] as bool? ?? false,
        startedAt: DateTime.tryParse(json['startedAt'] as String? ?? '') ?? DateTime.now(),
      );
}

/// What happened to one attempt; the state already says so too
enum SendOutcome { placed, alreadyPlaced, failed }

List<Sending> _initial = const [];

/// Read before `runApp`, like the cart and the offline queue: a charge cut
/// off by a restart is on its bill before any screen can ask
Future<void> initializeSending() async {
  try {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_sendsKey);
    if (raw == null) return;
    _initial = [for (final e in json.decode(raw) as List<dynamic>) Sending.fromJson(e as Map<String, dynamic>)];
  } catch (_) {
    _initial = const [];
  }
}

class SendingNotifier extends Notifier<List<Sending>> {
  @override
  List<Sending> build() => _initial;

  /// Puts a charge on the till and starts sending it
  Future<SendOutcome> start(Sending send) async {
    await _set([...state.where((s) => s.requestId != send.requestId), send]);
    return this.send(send.requestId);
  }

  /// Sends (or sends again) one charge, keeping its state here as it goes
  Future<SendOutcome> send(String requestId) async {
    final send = state.where((s) => s.requestId == requestId).firstOrNull;
    if (send == null) return SendOutcome.failed;
    await _update(requestId, (s) => s.copyWith(status: SendStatus.sending, clearError: true, offline: false));
    try {
      final orderId = await inBranch(
        send.branchId,
        () => ref.read(orderRepositoryProvider).createPosOrder(
              PosOrderRequest(lines: send.lines, note: send.note, customer: send.customer, ticketId: send.ticketId),
              requestId: send.requestId,
            ),
      );
      _saveCustomerPreferences(send.customer?.id, send.lines);
      // 0 is a repeat the server recognised: an earlier attempt went in, and
      // its lines are on the bill already
      if (orderId == 0) {
        if (ref.mounted && send.ticketId != null) ref.invalidate(ticketProvider(send.ticketId!));
        await drop(requestId);
        return SendOutcome.alreadyPlaced;
      }
      await _update(requestId, (s) => s.copyWith(status: SendStatus.placed, orderId: orderId, startedAt: DateTime.now()));
      if (ref.mounted) {
        if (send.ticketId != null) ref.invalidate(ticketProvider(send.ticketId!));
        ref.read(openTicketsProvider.notifier).refresh();
      }
      return SendOutcome.placed;
    } catch (e) {
      final offline = NetworkStatus.isConnectionError(e);
      if (offline) networkStatus.reportFailure();
      final l10n = lookupAppLocalizations(ref.read(localeProvider));
      await _update(
        requestId,
        (s) => s.copyWith(status: SendStatus.failed, offline: offline, error: offline ? l10n.sendNoConnection : describeError(e, l10n)),
      );
      return SendOutcome.failed;
    }
  }

  /// Takes a send off the till: removed by the cashier, or let go
  Future<void> drop(String requestId) => _set(state.where((s) => s.requestId != requestId).toList());

  /// Its lines are on the bill: the send goes, and they are ticked for a moment
  Future<void> land(String requestId, int orderId) async {
    ref.read(landedOrdersProvider.notifier).mark(orderId);
    await drop(requestId);
  }

  /// Picks up where a restart left the sends: one still on its way is sent
  /// again (the request id makes that safe), and one placed long ago is let go
  void resume() {
    for (final send in List.of(state)) {
      if (send.status == SendStatus.sending) unawaited(this.send(send.requestId));
    }
    sweep();
  }

  /// Lets go of placed orders whose lines never showed in time
  void sweep() {
    final now = DateTime.now();
    for (final send in List.of(state)) {
      if (send.status == SendStatus.placed && now.difference(send.startedAt) > placedTimeout) {
        unawaited(drop(send.requestId));
      }
    }
  }

  /// Remembers how the customer had their items customized, so the pad
  /// prefills it next time — fire-and-forget, as the customer app does
  void _saveCustomerPreferences(String? customerId, List<SaleLine> lines) {
    if (customerId == null || customerId.isEmpty) return;
    final byProduct = <int, List<Map<String, int>>>{};
    for (final line in lines) {
      if (line.customizations.isEmpty) continue;
      byProduct[line.productId] = [
        for (final c in line.customizations) {'customizationId': c.customizationId, 'optionId': c.optionId},
      ];
    }
    if (byProduct.isEmpty) return;
    final items = [
      for (final entry in byProduct.entries) {'catalogItemId': entry.key, 'selectedOptions': entry.value},
    ];
    unawaited(ref.read(catalogRepositoryProvider).saveCustomerPreferences(customerId, items).catchError((_) {}));
  }

  Future<void> _update(String requestId, Sending Function(Sending) change) =>
      _set([for (final s in state) s.requestId == requestId ? change(s) : s]);

  Future<void> _set(List<Sending> next) async {
    if (!ref.mounted) return;
    state = next;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_sendsKey, json.encode(next.map((s) => s.toJson()).toList()));
    } catch (e) {
      debugPrint('Sends not saved: $e');
    }
  }
}

final sendingProvider = NotifierProvider<SendingNotifier, List<Sending>>(SendingNotifier.new);

/// Orders whose lines have just landed on their bill, ticked for a moment
class LandedOrdersNotifier extends Notifier<Set<int>> {
  @override
  Set<int> build() => const {};

  void mark(int orderId) {
    state = {...state, orderId};
    Timer(_landedFor, () {
      if (ref.mounted) state = {...state}..remove(orderId);
    });
  }
}

final landedOrdersProvider = NotifierProvider<LandedOrdersNotifier, Set<int>>(LandedOrdersNotifier.new);

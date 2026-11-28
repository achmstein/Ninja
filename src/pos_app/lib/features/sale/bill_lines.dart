import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';
import '../../core/network/api_errors.dart';
import '../../core/widgets/pos_toast.dart';
import '../../l10n/app_localizations.dart';
import '../orders/services/order_service.dart';
import '../places/providers/places_provider.dart';
import '../places/stay_actions.dart';
import '../places/status.dart';
import '../ticket/dialogs/move_target_dialog.dart';
import '../tickets/models/move_lines.dart';
import '../tickets/models/ticket_detail.dart';
import '../tickets/providers/tickets_provider.dart';
import '../tickets/services/tickets_service.dart';
import 'widgets/customer_dialog.dart';

/// What is done to lines already on a bill, from the order screen or from the
/// bill's own page: moved to another bill (one open already, or a new one,
/// which is how a bill is split), or told whose they are after the fact. The
/// web till's `useBillLines` is the same.

/// Whether a sent line can be picked: the room's time is the room's, and
/// what a part payment paid for is done, as is an item cancelled whole
bool pickableLine(TicketLineView line) => line.source != 'SessionTime' && !line.paid && !line.cancelledWhole;

/// The one customer every given line is for, by name: none when a line is
/// nobody's or there are two. A new tab for the lines opens under it
String? oneCustomer(List<TicketLineView> lines) {
  String? key;
  String? name;
  for (final line in lines) {
    final n = (line.customerName ?? '').trim();
    if (n.isEmpty) return null;
    final k = (line.customerId ?? '').isNotEmpty ? line.customerId! : n;
    if (key != null && k != key) return null;
    key = k;
    name = n;
  }
  return name;
}

/// Which call names each picked line. A whole order goes through Ordering:
/// the customer owns the order and its points, so naming it moves the points
/// with it. Part of an order is a snapshot on just those lines (the bill, the
/// receipt, an account payment), the points staying where they are. Lines
/// with no order behind them (the room's time) are nobody's to name.
({List<int> orderIds, List<int> lineIds}) assignCalls(List<TicketLineView> lines, Set<int> picked) {
  final byOrder = <int, List<int>>{};
  for (final line in lines) {
    final orderId = line.orderId;
    if (orderId == null) continue;
    (byOrder[orderId] ??= []).add(line.id);
  }
  final orderIds = <int>[];
  final lineIds = <int>[];
  for (final entry in byOrder.entries) {
    final chosen = entry.value.where(picked.contains).toList();
    if (chosen.isEmpty) continue;
    if (chosen.length == entry.value.length) {
      orderIds.add(entry.key);
    } else {
      lineIds.addAll(chosen);
    }
  }
  return (orderIds: orderIds, lineIds: lineIds);
}

/// Asks whose the picked lines are, and says so to the server. The room's
/// people are offered first on a room's bill; somebody with an account named
/// on its lines is in the room, and goes onto its roster, so their share of
/// the time has a tab at settle. True once they are named; false when nobody
/// was picked or it could not be done, which is said. [onBusy] brackets the
/// calls themselves.
Future<bool> assignPickedLines(
  BuildContext context,
  WidgetRef ref,
  TicketDetail ticket,
  Set<int> picked, {
  void Function(bool busy)? onBusy,
}) async {
  final calls = assignCalls(ticket.lines, picked);
  if (calls.orderIds.isEmpty && calls.lineIds.isEmpty) return false;

  final sessionId = ticket.sessionId;
  final session = sessionId == null ? null : ref.read(stayProvider(sessionId)).value;
  final roster = session?.roster ?? const <({String id, String name})>[];
  final customer = await showCustomerDialog(context, quickPicks: roster);
  if (customer == null || !context.mounted) return false;
  final accountId = customer.id ?? '';
  if (session != null && accountId.isNotEmpty && !roster.any((member) => member.id == accountId)) {
    unawaited(StayActions(ref, context).addMember(session.id, accountId, customer.name));
  }
  final l10n = AppLocalizations.of(context)!;
  onBusy?.call(true);
  try {
    final orders = ref.read(orderRepositoryProvider);
    // A fresh id per call: the server deduplicates a retried request, and a
    // later naming is a new one
    await Future.wait([
      for (final orderId in calls.orderIds)
        orders.assignOrderCustomer(orderId,
            customerUserId: customer.id, customerName: customer.name, requestId: const Uuid().v4()),
    ]);
    if (calls.lineIds.isNotEmpty) {
      await ref.read(ticketsRepositoryProvider).assignLinesCustomer(
            ticket.id,
            lineIds: calls.lineIds,
            customerId: customer.id,
            customerName: customer.name,
            requestId: const Uuid().v4(),
          );
    }
    ref.invalidate(ticketProvider(ticket.id));
    unawaited(ref.read(openTicketsProvider.notifier).refresh());
    if (context.mounted) showPosToast(context, PosToastType.success, l10n.customerAssigned);
    return true;
  } catch (e) {
    if (context.mounted) {
      // A 400 carries the domain's own words (cancelled, already somebody's)
      final detail = describeError(e, l10n);
      showPosToast(context, PosToastType.error, l10n.failedToAssignCustomer,
          description: detail == l10n.somethingWentWrong ? null : detail);
    }
    return false;
  } finally {
    onBusy?.call(false);
  }
}

/// Asks where the picked lines go (one list of every place they can: an open
/// bill, a new tab by name, a second bill for the same place, a free table)
/// and moves them there. Answers with the bill they are on now and what it
/// is called when it was open already, so the till can follow them; null
/// when nothing was picked or they could not be moved, which is said.
Future<({int ticketId, String? label})?> movePickedLines(
  BuildContext context,
  WidgetRef ref,
  TicketDetail ticket,
  Set<int> picked, {
  void Function(bool busy)? onBusy,
}) async {
  if (picked.isEmpty) return null;
  final movable = ticket.lines.where((line) => line.source != 'SessionTime').length;
  final target = await showMoveTargetDialog(
    context,
    ticket: ticket,
    count: picked.length,
    allSelected: picked.length >= movable,
    suggestedName: oneCustomer([for (final line in ticket.lines) if (picked.contains(line.id)) line]),
  );
  if (target == null || !context.mounted) return null;
  final l10n = AppLocalizations.of(context)!;
  // What the bill moved to is called, read before the move changes the floor
  final label = switch (target) {
    MoveToTicket(:final ticketId) =>
      (ref.read(openTicketsProvider).value ?? const []).where((open) => open.id == ticketId).firstOrNull?.label,
    _ => null,
  };
  onBusy?.call(true);
  try {
    final landedOn = await ref.read(ticketsRepositoryProvider).moveLines(
          ticket.id,
          MoveLinesRequest(lineIds: picked.toList(), target: target),
          // A retry on business Wi-Fi must not become a second command
          requestId: const Uuid().v4(),
        );
    ref.invalidate(ticketProvider(ticket.id));
    ref.invalidate(ticketProvider(landedOn));
    unawaited(ref.read(openTicketsProvider.notifier).refresh());
    if (context.mounted) showPosToast(context, PosToastType.success, l10n.linesMoved);
    return (ticketId: landedOn, label: label);
  } catch (e) {
    if (context.mounted) showPosToast(context, PosToastType.error, describeError(e, l10n));
    return null;
  } finally {
    onBusy?.call(false);
  }
}

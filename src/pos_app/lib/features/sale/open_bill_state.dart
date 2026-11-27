import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/layout/breakpoints.dart';
import '../../core/sending/sending.dart';
import '../orders/models/order.dart';
import '../orders/providers/pending_orders_provider.dart';
import '../places/providers/places_provider.dart';
import '../places/status.dart';
import '../tickets/models/ticket_detail.dart';
import '../tickets/providers/tickets_provider.dart';
import '../tickets/services/tickets_service.dart';
import 'bill_actions.dart';
import 'bill_payers.dart';
import 'bill_people_state.dart';
import 'widgets/part_payment_sheet.dart';
import 'widgets/pay_who_sheet.dart';

/// The open bill under the order screen: kept in step with the server, left
/// when it is gone, and paid. The web till's `useOpenBill` and its payment
/// sheets are the same.
///
/// - **In step**: lines charged here and not confirmed yet ([sendsOf]) are
///   landed as the bill shows them, with quick re-reads while any is on its
///   way.
/// - **Left**: discarded under the screen, the till goes back to the floor;
///   paid or voided, to the bill's own page.
/// - **Paid** ([pay]): asked who is paying when it is more than one person's
///   or its room's clock runs, then one person's part or the whole settle.
mixin OpenBillState<W extends ConsumerStatefulWidget> on ConsumerState<W>, BillPeopleState<W> {
  /// The phone's order sheet, which this opens on a bill with something on it and closes on the way out
  Future<void> openOrderSheet();
  void closeOrderSheet();

  /// Starts watching the bill and what is on its way to it: once, from initState
  void watchBill() {
    final ticketId = billId;
    if (ticketId == null) return;
    ref.listenManual(ticketProvider(ticketId), _onTicket, fireImmediately: true);
    ref.listenManual(sendingProvider, (_, _) {
      _landArrived();
      _syncLandingPoll();
    }, fireImmediately: true);
  }

  /// From dispose
  void stopWatchingBill() => _landingPoll?.cancel();

  /// Quick refreshes while an order the server took is still to show its lines here
  Timer? _landingPoll;

  /// The bill went, or closed, under the screen: the till is on its way elsewhere
  bool _leaving = false;

  /// A phone opens a bill with something on it on the order, once
  bool _openedOnOrder = false;

  /// Lines charged onto this bill that the server has not confirmed yet
  /// (core/sending): shown faded over the bill's own, in its total, and
  /// holding the payment until they are in
  List<Sending> sendsOf(List<Sending> all) =>
      onBill ? all.where((s) => s.ticketId == billId).toList() : const [];

  /// An order's lines are on the bill: its faded copy goes, the real ones tick
  void _landArrived() {
    final ticketId = billId;
    final ticket = ticketId == null ? null : ref.read(ticketProvider(ticketId)).value;
    if (ticket == null) return;
    final orderIds = {for (final line in ticket.lines) ?line.orderId};
    for (final send in sendsOf(ref.read(sendingProvider))) {
      final orderId = send.orderId;
      if (send.status == SendStatus.placed && orderId != null && orderIds.contains(orderId)) {
        unawaited(ref.read(sendingProvider.notifier).land(send.requestId, orderId));
      }
    }
  }

  void _syncLandingPoll() {
    final placed = sendsOf(ref.read(sendingProvider)).any((s) => s.status == SendStatus.placed);
    if (!placed) {
      _landingPoll?.cancel();
      _landingPoll = null;
    } else {
      _landingPoll ??= Timer.periodic(const Duration(milliseconds: 700), (_) {
        if (mounted) ref.invalidate(ticketProvider(billId!));
      });
    }
  }

  /// The bill as it is read, and read again. Gone (discarded under the
  /// screen): back to the floor. Paid or voided: nothing more is rung onto
  /// it, its own page says the rest
  void _onTicket(AsyncValue<TicketDetail>? previous, AsyncValue<TicketDetail> next) {
    if (next.error is TicketNotFound) return _leaveTo('/');
    final ticket = next.value;
    if (ticket == null) return;
    if (!ticket.isOpen || ticket.isVoided) {
      // Paid from here a moment ago: the settle goes on to the floor itself
      if (!_settling) _leaveTo('/ticket/${ticket.id}');
      return;
    }
    _landArrived();
    // A phone shows the menu first; a bill with something on it opens on the bill instead
    if (!_openedOnOrder) {
      _openedOnOrder = true;
      if (ticket.lines.isNotEmpty) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted && !_leaving && context.isNarrow) openOrderSheet();
        });
      }
    }
  }

  void _leaveTo(String location) {
    if (_leaving) return;
    _leaving = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      closeOrderSheet();
      context.go(location);
    });
  }

  /// Paid from here: the bill closes under the screen, and the settle goes on to the floor itself
  bool _settling = false;

  /// Taking the money. A bill that is more than one person's asks who is
  /// paying first: everything in one payment (the ordinary settle), or one
  /// person's own part, the bill staying open for the rest. Always asked
  /// under a running clock: somebody may be leaving while the others play on,
  /// and pays what they had with whatever they choose towards the time
  Future<void> pay() async {
    final ticketId = billId;
    final ticket = ticketId == null ? null : ref.read(ticketProvider(ticketId)).value;
    if (ticketId == null || ticket == null || _settling) return;
    final sessionId = ticket.sessionId;
    final stay = sessionId == null ? null : ref.read(stayProvider(sessionId)).value;
    final payers = payersOf(ticket.lines);
    final clockRunning = stay?.isRunning ?? false;
    if (payers.length < 2 && !clockRunning) return _settle();

    final left = billLeftToPay(ticket);
    final title = billTitle(context, ticket);
    final choice =
        await showPayWho(context,
            title: title, total: left, payers: payers, partPaid: ticket.partPaid > 0, clockRunning: clockRunning);
    if (choice == null || !mounted) return;
    if (choice.onAccount) {
      await showPartPayment(
        context,
        ticketId: ticketId,
        title: title,
        part: (name: null, lineIds: const <int>[], amount: 0),
        left: left,
        clockRunning: clockRunning,
      );
      return;
    }
    final payer = choice.payer;
    if (payer == null) return _settle();
    // Their items carry their share of the bill's service, tax and discount.
    // The last part is the bill's rest: that is its ordinary payment, which closes it
    final share = payerShare(payer, ticket.lines, ticket.total);
    // Under a running clock the bill is not whole yet: what is on it so far is never its rest
    if (share <= 0 || (!clockRunning && share >= left)) return _settle();
    await showPartPayment(
      context,
      ticketId: ticketId,
      title: title,
      part: (name: payer.name, lineIds: payer.lineIds, amount: share),
      left: left,
      clockRunning: clockRunning,
    );
  }

  /// The bill's whole payment: the same guards and the same settle page as
  /// the bill's own (bill_actions), then on to the floor
  Future<void> _settle() async {
    final ticketId = billId;
    final ticket = ticketId == null ? null : ref.read(ticketProvider(ticketId)).value;
    if (ticketId == null || ticket == null || _settling) return;
    final sessionId = ticket.sessionId;
    // The stay is read by id, not off the running ones: once it has ended the
    // bill is still open, and the people in the room are still its account holders
    final stay = sessionId == null ? null : ref.read(stayProvider(sessionId)).value;
    final waiting = pendingForTicket(ref.read(pendingOrdersProvider).value ?? const <Order>[],
        sessionId: sessionId, placeId: ticket.placeId);
    _settling = true;
    final outcome = await settleBill(
      context,
      ref,
      ticket,
      waiting: waiting,
      activeSession: stay != null && stay.isRunning ? stay : null,
      members: stay?.members ?? const [],
    );
    _settling = false;
    if (!mounted) return;
    if (outcome != null) {
      closeOrderSheet();
      context.go('/');
      return;
    }
    // Left unpaid, the cashier is back on its order; closed some other way meanwhile, on its own page
    final now = ref.read(ticketProvider(ticketId)).value;
    if (now != null && (!now.isOpen || now.isVoided)) _leaveTo('/ticket/$ticketId');
  }
}

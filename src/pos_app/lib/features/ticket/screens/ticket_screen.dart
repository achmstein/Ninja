import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import 'package:shimmer/shimmer.dart';
import '../../customers/dialogs/customer_card_dialog.dart';
import '../../../core/auth/auth_service.dart';
import '../../../core/layout/breakpoints.dart';
import '../../../core/models/dates.dart';
import 'package:ninja_app_core/models/localized_text.dart';
import '../../../core/models/money.dart';
import '../../../core/network/api_errors.dart';
import '../../../core/services/branch_names.dart';
import '../../../core/printing/print_service.dart';
import '../../../core/sending/sending.dart';
import '../../../core/sending/sending_lines.dart';
import 'package:ninja_app_core/theme/app_theme.dart';
import 'package:ninja_app_core/widgets/confirm_dialog.dart';
import '../../../core/widgets/paid_tag.dart';
import '../../../core/widgets/pos_toast.dart';
import '../../../l10n/app_localizations.dart';
import '../../floor/widgets/bill_card.dart' show ticketTypeLabel;
import '../../orders/models/order.dart';
import '../../orders/providers/pending_orders_provider.dart';
import '../../orders/widgets/pending_orders.dart';
import '../../places/models/place.dart';
import '../../places/providers/places_provider.dart';
import '../../places/stay_actions.dart';
import '../../places/status.dart';
import '../../places/widgets/stay_bar.dart';
import '../../places/widgets/stay_members.dart';
import '../../places/widgets/time_so_far.dart';
import '../../sale/bill_actions.dart';
import '../../sale/bill_lines.dart';
import '../../tickets/models/enums.dart';
import '../../tickets/models/online_payment.dart';
import '../../tickets/models/pricing.dart';
import '../../tickets/services/online_payments_service.dart';
import '../widgets/online_payments_card.dart';
import '../../tickets/models/ticket_detail.dart';
import '../../tickets/providers/tickets_provider.dart';
import '../../tickets/services/tickets_service.dart';
import '../dialogs/discard_dialog.dart';
import '../dialogs/refund_dialog.dart';
import '../dialogs/change_tender_dialog.dart';
import '../tenders.dart';
import '../dialogs/void_dialog.dart';
import '../dialogs/discount_dialog.dart';
import '../dialogs/kitchen_reprint_dialog.dart';
import '../dialogs/breakdown_dialog.dart';
import '../lines.dart';
import '../../../core/utils/bidi.dart';
import '../../../core/theme/type_roles.dart';

/// One bill: what is on it, who it was for, and the way to take the money.
/// Arriving from the sale pad with `autoSettle`, the walk-in is standing at
/// the till, so the settle dialog opens by itself — once, and only after
/// the ticket is known to still be open.
class TicketScreen extends ConsumerStatefulWidget {
  final int ticketId;
  final bool autoSettle;

  /// Where Back goes: the floor, or the receipts list that opened this bill
  final String backTo;

  const TicketScreen({super.key, required this.ticketId, this.autoSettle = false, this.backTo = '/'});

  @override
  ConsumerState<TicketScreen> createState() => _TicketScreenState();
}

class _TicketScreenState extends ConsumerState<TicketScreen> {
  ProviderSubscription<AsyncValue<TicketDetail>>? _subscription;
  bool _autoSettleConsumed = false;
  bool _leaving = false;
  bool _selecting = false;
  final Set<int> _selected = {};
  bool _busy = false;
  // Quick refreshes while an order the server took is still to show its lines here
  Timer? _landingPoll;

  // Lines just charged to this bill sit at its end: brought into view as
  // they arrive, so the cashier sees them breathe and land without scrolling
  final _sendingKey = GlobalKey();
  int _shownSends = 0;

  void _revealSends(int count) {
    if (count <= _shownSends) {
      _shownSends = count;
      return;
    }
    _shownSends = count;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final target = _sendingKey.currentContext;
      if (target == null || !mounted) return;
      Scrollable.ensureVisible(target,
          alignment: 1, duration: const Duration(milliseconds: 350), curve: Curves.easeOutCubic);
    });
  }

  @override
  void initState() {
    super.initState();
    _subscription = ref.listenManual(ticketProvider(widget.ticketId), _onTicket, fireImmediately: true);
    ref.listenManual(sendingProvider, (_, _) {
      _landArrived();
      _syncLandingPoll();
    }, fireImmediately: true);
  }

  @override
  void dispose() {
    _subscription?.close();
    _landingPoll?.cancel();
    super.dispose();
  }

  /// Lines charged onto this bill that the server has not confirmed yet
  /// (core/sending): shown faded under the bill's own, in its total, and
  /// holding the payment until they are in
  List<Sending> _sends(List<Sending> all) => all.where((s) => s.ticketId == widget.ticketId).toList();

  /// An order's lines are on the bill: its faded copy goes, the real ones tick
  void _landArrived() {
    final ticket = ref.read(ticketProvider(widget.ticketId)).value;
    if (ticket == null) return;
    final orderIds = {for (final line in ticket.lines) ?line.orderId};
    for (final send in _sends(ref.read(sendingProvider))) {
      final orderId = send.orderId;
      if (send.status == SendStatus.placed && orderId != null && orderIds.contains(orderId)) {
        unawaited(ref.read(sendingProvider.notifier).land(send.requestId, orderId));
      }
    }
  }

  void _syncLandingPoll() {
    final placed = _sends(ref.read(sendingProvider)).any((s) => s.status == SendStatus.placed);
    if (!placed) {
      _landingPoll?.cancel();
      _landingPoll = null;
    } else {
      _landingPoll ??= Timer.periodic(const Duration(milliseconds: 700), (_) {
        if (mounted) ref.invalidate(ticketProvider(widget.ticketId));
      });
    }
  }

  void _onTicket(AsyncValue<TicketDetail>? previous, AsyncValue<TicketDetail> next) {
    // Gone: an empty room ticket auto-discarded when its session ended, or
    // any ticket deleted out from under the screen. A 404 is the only honest
    // signal that the bill no longer exists — hand the cashier back.
    if (next.error is TicketNotFound) {
      _leave();
      return;
    }
    _landArrived();
    final ticket = next.value;
    if (ticket == null || !widget.autoSettle || _autoSettleConsumed) return;
    _autoSettleConsumed = true;
    if (!ticket.isOpen) return;
    // The listener may fire during initState; the dialog needs a frame
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _settle(ticket);
    });
  }

  void _leave() {
    if (_leaving) return;
    _leaving = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.go(widget.backTo);
    });
  }

  Future<void> _settle(
    TicketDetail ticket, {
    List<Order> waiting = const [],
    Stay? activeSession,
    List<StayMember> members = const [],
  }) async {
    // The guards and the settle page are the order screen's too (sale/bill_actions)
    final outcome =
        await settleBill(context, ref, ticket, waiting: waiting, activeSession: activeSession, members: members);
    // Paid, the bill is done: Done (or the way back) from the settled page goes on to the open bills, not
    // back to a closed bill with nothing left to do on it. Left unpaid, the cashier is back on the bill
    if (outcome != null && mounted) context.go('/');
  }

  // Same rule for Void, server-enforced too: time that has not landed yet
  // is money, and a void would write it off unseen
  Future<void> _voidGuarded(Stay? activeSession) async {
    if (activeSession == null) return _void();
    final l10n = AppLocalizations.of(context)!;
    final end = await showConfirmDialog(
      context,
      title: l10n.voidWithSessionTitle,
      cancelLabel: l10n.goBack,
      actionLabel: l10n.endSessionButton,
      destructive: true,
    );
    if (end && mounted) await StayActions(ref, context).endStay(activeSession.id);
  }

  Future<void> _discard() async {
    final discarded = await showDiscardDialog(context, widget.ticketId);
    if (discarded && mounted) context.go('/');
  }

  Future<void> _void() async {
    // The orders on the bill took their ingredients when they were confirmed
    final lines = ref.read(ticketProvider(widget.ticketId)).value?.lines ?? const [];
    final orderIds = {for (final line in lines) ?line.orderId}.toList();
    final voided = await showVoidDialog(context, widget.ticketId, orderIds: orderIds);
    if (voided && mounted) context.go('/');
  }

  Future<void> _discount(TicketDetail ticket) async {
    await showDiscountDialog(context, ticket);
  }

  Future<void> _refund(TicketDetail ticket) async {
    await showRefundDialog(context, ticket);
  }

  // Money a guest paid from their phone goes back through the provider,
  // while the bill is still open
  Future<void> _refundOnline(OnlinePaymentView payment) async {
    final l10n = AppLocalizations.of(context)!;
    final name = (payment.payerName ?? '').trim().isNotEmpty ? payment.payerName!.trim() : l10n.guest;
    final sure = await showConfirmDialog(
      context,
      title: l10n.refundOnlineTitle(money(context, payment.amount + payment.fee), name),
      description: l10n.refundOnlineHint,
      cancelLabel: l10n.goBack,
      actionLabel: l10n.refundOnline,
      destructive: true,
    );
    if (!sure || !mounted) return;
    setState(() => _busy = true);
    try {
      final done = await ref.read(onlinePaymentsRepositoryProvider).refund(payment.key);
      ref.invalidate(onlinePaymentsProvider(widget.ticketId));
      ref.invalidate(ticketProvider(widget.ticketId));
      if (mounted) {
        showPosToast(
          context,
          done ? PosToastType.success : PosToastType.info,
          done ? l10n.onlineRefundedToast : l10n.onlineRefundPendingToast,
        );
      }
    } catch (e) {
      if (mounted) showPosToast(context, PosToastType.error, describeError(e, l10n));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  // A guest who left the checkout without paying holds their share for a
  // while; the till lets it go so the share can be paid again
  Future<void> _releaseOnline(OnlinePaymentView payment) async {
    final l10n = AppLocalizations.of(context)!;
    setState(() => _busy = true);
    try {
      await ref.read(onlinePaymentsRepositoryProvider).cancel(payment.key);
      ref.invalidate(onlinePaymentsProvider(widget.ticketId));
      if (mounted) showPosToast(context, PosToastType.success, l10n.onlineReleasedToast);
    } catch (e) {
      if (mounted) showPosToast(context, PosToastType.error, describeError(e, l10n));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _print(TicketDetail ticket) async {
    final l10n = AppLocalizations.of(context)!;
    try {
      await ref.read(printServiceProvider).printReceipt(ticket, l10n: l10n, locale: Localizations.localeOf(context));
      if (mounted) showPosToast(context, PosToastType.success, l10n.printed);
    } catch (e) {
      if (mounted) showPosToast(context, PosToastType.error, describePrintError(e, l10n));
    }
  }

  void _toggleSelecting() => setState(() {
        _selecting = !_selecting;
        _selected.clear();
      });

  void _toggleLine(int id) => setState(() {
        if (!_selected.remove(id)) _selected.add(id);
      });

  void _setBusy(bool busy) {
    if (mounted) setState(() => _busy = busy);
  }

  void _stopSelecting() {
    if (!mounted) return;
    setState(() {
      _selecting = false;
      _selected.clear();
    });
  }

  /// The selected lines go to another bill (one list of every place they
  /// can go), and the till follows them there. Shared with the order screen
  /// (sale/bill_lines)
  Future<void> _move(TicketDetail ticket) async {
    final to = await movePickedLines(context, ref, ticket, {..._selected}, onBusy: _setBusy);
    if (to == null || !mounted) return;
    _stopSelecting();
    context.go('/ticket/${to.ticketId}');
  }

  /// The selected lines are told whose they are: a whole order through
  /// Ordering, part of one as a snapshot on just those lines (sale/bill_lines)
  Future<void> _assign(TicketDetail ticket) async {
    final named = await assignPickedLines(context, ref, ticket, {..._selected}, onBusy: _setBusy);
    if (named) _stopSelecting();
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final async = ref.watch(ticketProvider(widget.ticketId));
    // Voiding and refunding are Owner-only (the server enforces the same rule)
    final isOwner = ref.watch(authServiceProvider.select((s) => s.isOwner));
    // Online payments: what guests paid, or are paying, from their phones
    final online = ref.watch(onlinePaymentsProvider(widget.ticketId)).value ?? const <OnlinePaymentView>[];
    // A payment that just landed may have settled the bill by itself
    ref.listen(onlinePaymentsProvider(widget.ticketId), (previous, next) {
      final before = previous?.value?.where((p) => p.isPaid).length ?? 0;
      final after = next.value?.where((p) => p.isPaid).length ?? 0;
      if (after != before) ref.invalidate(ticketProvider(widget.ticketId));
    });

    // Redirecting to the floor — don't flash the stale bill on the way out
    if (async.error is TicketNotFound || _leaving) return const SizedBox.shrink();

    // A refresh keeps the last bill on screen; only the first load is blank
    final ticket = async.value;
    if (ticket == null) {
      return async.isLoading ? const _Skeleton() : _NotFound(l10n: l10n, backTo: widget.backTo);
    }

    final lines = ticket.lines;
    final sends = ticket.isOpen ? _sends(ref.watch(sendingProvider)) : const <Sending>[];
    _revealSends(sends.length);
    final onTheirWay = sends.where((s) => s.status != SendStatus.failed).toList();
    final landed = ref.watch(landedOrdersProvider);
    // App orders for this table or session that have not been accepted yet —
    // they are not on the bill until someone taps Confirm
    final waiting = ticket.isOpen
        ? pendingForTicket(ref.watch(pendingOrdersProvider).value ?? const [], sessionId: ticket.sessionId, placeId: ticket.placeId)
        : const <Order>[];
    // A room ticket's time only lands when its session ends, so the screen
    // shows the running clock and guards the settle until then. The session
    // is read by id, not off the active list: once it has ended the bill is
    // still open, and the people in the room are still its account holders
    final sessionAsync = ticket.isOpen && ticket.sessionId != null ? ref.watch(stayProvider(ticket.sessionId!)) : null;
    final session = sessionAsync?.value;
    // A room ticket whose session hasn't arrived yet: shimmer the room card in
    // its place rather than showing nothing until it lands.
    final sessionLoading = sessionAsync != null && !sessionAsync.hasValue;
    final activeSession = session != null && session.isRunning ? session : null;
    // Ended, bill still open: the time has landed and the roster stays
    // editable so every share can find its tab
    final endedSession = session != null && !session.isRunning ? session : null;
    final groups = groupLinesByCustomer(lines);
    final shared = !(groups.length == 1 && groups.single.unattributed);
    // Selecting moves individual lines to another ticket, so the rounds
    // come back apart the moment the cashier is choosing between them
    final selecting = _selecting && !ticket.isSettled;
    List<TicketLineView> shown(List<TicketLineView> source) => selecting ? source : mergeIdenticalLines(source);

    // The place is the headline: a cashier arrives here from a tile that
    // said "Table 1" and is standing in front of that table. The kind of
    // place is only spelled out when the name does not already say it —
    // the fallback for a counter ticket, which has no name of its own.
    final typeLabel = ticketTypeLabel(l10n, ticket.type);
    final placeName = ticket.locationName?.localized(context) ?? '';
    final location = placeName.isNotEmpty ? placeName : typeLabel;
    final title = placeName.isNotEmpty ? placeName : (ticket.label ?? typeLabel);

    // Nothing on the ticket yet means nothing to audit, so any cashier can
    // discard it. A room ticket is discardable too, but only once its
    // session has ended with nothing on it — while it runs, there is time
    // still to come. Once a line lands, only an owner's void (with its
    // reason) takes it off the floor.
    final canDiscard = lines.isEmpty && sends.isEmpty && (ticket.sessionId == null || ticket.sessionEndedAt != null);
    final canVoid = !canDiscard && isOwner;

    // The bill on the start side, the panel on the end side, ruled off like
    // the sale pad: the room (its clock, rate, people, the way to end it)
    // and the money with what is done with it stay in view however long
    // the bill grows. A narrow screen stacks the room over the bill and
    // keeps the money at the foot.
    final size = MediaQuery.sizeOf(context);
    final wide = size.width >= 900;
    final rule = BorderSide(color: theme.colors.border);

    final header = Container(
      height: Sizes.header,
      padding: const EdgeInsets.symmetric(horizontal: Sizes.gap, vertical: Sizes.gapSm),
      decoration: BoxDecoration(border: Border(bottom: rule)),
      child: TicketHeader(
        ticket: ticket,
        title: title,
        backTo: widget.backTo,
        selecting: _selecting,
        canSelect: lines.isNotEmpty,
        canDiscard: canDiscard,
        canVoid: canVoid,
        onToggleSelecting: _toggleSelecting,
        onDiscard: _discard,
        onVoid: () => _voidGuarded(activeSession),
        onDiscount: () => _discount(ticket),
      ),
    );

    // The room, while there is one: running, its whole card; ended with the
    // bill still open, the time it came to where the clock stood (its money
    // is a line on the bill now), and the people, still editable so every
    // share finds its tab
    final room = <Widget>[
      if (sessionLoading) const _SessionCardSkeleton(),
      if (activeSession != null) StayBar(session: activeSession, panel: true),
      if (endedSession != null) ...[
        _EndedTime(session: endedSession),
        const SizedBox(height: Sizes.gapXl),
        TypeLabel(l10n.inTheRoom),
        const SizedBox(height: Sizes.gapSm),
        StayMembers(session: endedSession),
      ],
    ];

    final bill = <Widget>[
      // Who took it, only when another branch did (a phone order sent here):
      // why a bill nobody here rang up is on the floor, and whom to ask.
      // Taken here, everyone on shift knows, and the line was noise
      if ((ticket.takenBy ?? '').isNotEmpty && ticket.takenAtBranchId != null)
        Padding(
          padding: const EdgeInsets.only(bottom: Sizes.gap),
          child: Text(
            l10n.takenByAt(ticket.takenBy!, branchNameOf(ref.watch(allBranchesProvider).value, ticket.takenAtBranchId, context)),
            style: theme.type.detail.copyWith(color: theme.colors.mutedForeground),
          ),
        ),
      // Confirmed here, they land on this bill — which is why the guard
      // stops a settle while any are still waiting
      if (waiting.isNotEmpty) ...[
        Container(
          padding: const EdgeInsets.all(Sizes.gap),
          decoration: BoxDecoration(
            color: AppColors.amber500.withValues(alpha: 0.1),
            border: Border.all(color: AppColors.amber500.withValues(alpha: 0.5)),
            borderRadius: BorderRadius.circular(Sizes.radiusCard),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Icon(FIcons.clock, size: Sizes.icon, color: AppColors.amber(theme.colors.brightness)),
                  const SizedBox(width: Sizes.gapSm),
                  Expanded(
                    child: Text(l10n.ticketPendingOrders(waiting.length),
                        style: theme.type.heading),
                  ),
                ],
              ),
              const SizedBox(height: Sizes.gapSm),
              PendingOrders(orders: waiting),
            ],
          ),
        ),
        const SizedBox(height: Sizes.gapLg),
      ],
      if (lines.isEmpty)
        // Nothing to say while a session runs: the clock in the panel is the
        // bill so far; nor while lines are on their way
        if (activeSession == null && sends.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 64),
            child: Text(l10n.emptyTicket,
                textAlign: TextAlign.center, style: theme.type.body.copyWith(color: theme.colors.mutedForeground)),
          )
        else
          const SizedBox.shrink()
      else if (!shared)
        _LineList(lines: shown(lines), selecting: selecting, selected: _selected, onToggle: _toggleLine, landed: landed)
      else
        // Shared bill: one heading per person, each with its own subtotal,
        // so the cashier can read (and split) who owes what. Lines nobody
        // was named for stay together under the table's own heading.
        Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (final (index, group) in groups.indexed) ...[
              if (index > 0) const SizedBox(height: Sizes.gapLg),
              _GroupHeading(
                name: group.name ?? (group.unattributed ? location : l10n.guest),
                total: group.total,
                customerId: group.lines.isNotEmpty ? group.lines.first.customerId : null,
              ),
              _LineList(
                lines: shown(group.lines),
                selecting: selecting,
                selected: _selected,
                onToggle: _toggleLine,
                landed: landed,
              ),
            ],
          ],
        ),
      KeyedSubtree(key: _sendingKey, child: SendingLines(sends: sends)),
      if (online.isNotEmpty && !ticket.isVoided) ...[
        const SizedBox(height: Sizes.gapLg),
        OnlinePaymentsCard(
          ticket: ticket,
          payments: online,
          onRefund: _busy ? null : _refundOnline,
          onRelease: _busy ? null : _releaseOnline,
        ),
      ],
      if (ticket.isVoided) ...[
        const SizedBox(height: Sizes.gapLg),
        _VoidTombstone(ticket: ticket),
      ],
      // What it was paid with; a Cash, Card or InstaPay payment recorded
      // under the wrong one can be put right, until a refund leans on it
      if (ticket.isSettled && ticket.payments.isNotEmpty) ...[
        const SizedBox(height: Sizes.gapLg),
        TypeLabel(l10n.payments),
        for (final payment in ticket.payments) ...[
          const SizedBox(height: Sizes.gapSm),
          _PaymentCard(
            payment: payment,
            onChangeTender: ticket.refunds.isEmpty && payment.canChangeTender
                ? () => showChangeTenderDialog(context, ticket, payment)
                : null,
          ),
        ],
      ],
      if (ticket.refunds.isNotEmpty) ...[
        const SizedBox(height: Sizes.gapLg),
        TypeLabel(l10n.refundsTitle),
        for (final refund in ticket.refunds) ...[
          const SizedBox(height: Sizes.gapSm),
          _RefundCard(refund: refund),
        ],
      ],
    ];

    // Every bill is laid out the same: the header across the top, the money
    // and what is done with it in the bar across the foot, so Settle, the
    // Select actions and Print are always in the same place. A room adds
    // only its panel (the clock, the rate, the people, the way to end it)
    // beside the lines; a narrow screen puts it over them.
    final withPanel = wide && room.isNotEmpty;

    final foot = TicketActionBar(
      ticket: ticket,
      activeSession: activeSession,
      selecting: selecting,
      selectedCount: _selected.length,
      busy: _busy,
      canRefund: isOwner && ticket.refundedTotal < ticket.total,
      paidOnline: online.paidOnline,
      total: onTheirWay.isEmpty ? ticket.total : totalWith(ticket, onTheirWay.fold(0, (sum, s) => sum + s.total)),
      confirming: onTheirWay.isNotEmpty,
      // Not while a guest is at the provider's checkout, nor before every
      // line charged here is in: the money is never taken against a bill the
      // server has not got all of
      onSettle: lines.isEmpty || online.anyPending || sends.isNotEmpty
          ? null
          : () => _settle(ticket, waiting: waiting, activeSession: activeSession, members: session?.members ?? const []),
      onPrint: () => _print(ticket),
      onRefund: () => _refund(ticket),
      onAssign: () => _assign(ticket),
      onMove: () => _move(ticket),
    );

    Widget scroll(List<Widget> children) => SingleChildScrollView(
          padding: const EdgeInsets.all(Sizes.gapLg),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: children),
        );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        header,
        Expanded(
          child: withPanel
              ? Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Expanded(child: scroll(bill)),
                    Container(
                      width: size.width >= 1280 ? 380 : 340,
                      // A light tint: the room's own surface beside the bill, not more of its list
                      decoration: BoxDecoration(
                        color: theme.colors.muted.withValues(alpha: 0.4),
                        border: BorderDirectional(start: rule),
                      ),
                      child: scroll(room),
                    ),
                  ],
                )
              : scroll([...room, if (room.isNotEmpty) const SizedBox(height: Sizes.gapXl), ...bill]),
        ),
        foot,
      ],
    );
  }
}

/// The bill's header row, ruled off like the sale pad's: the way back, the
/// place, then the two things a cashier does most (add, select) as buttons
/// and the rest (discount, the kitchen's paper, discard or void) in ⋯, away
/// from Settle in the panel so none of them can be fat-fingered
class TicketHeader extends ConsumerStatefulWidget {
  final TicketDetail ticket;
  final String title;
  final String backTo;
  final bool selecting;
  final bool canSelect;
  final bool canDiscard;
  final bool canVoid;
  final VoidCallback onToggleSelecting;
  final VoidCallback onDiscard;
  final VoidCallback onVoid;
  final VoidCallback onDiscount;

  const TicketHeader({
    super.key,
    required this.ticket,
    required this.title,
    required this.backTo,
    required this.selecting,
    required this.canSelect,
    required this.canDiscard,
    required this.canVoid,
    required this.onToggleSelecting,
    required this.onDiscard,
    required this.onVoid,
    required this.onDiscount,
  });

  @override
  ConsumerState<TicketHeader> createState() => _HeaderState();
}

class _HeaderState extends ConsumerState<TicketHeader> with SingleTickerProviderStateMixin {
  late final FPopoverController _menu = FPopoverController(vsync: this);

  @override
  void dispose() {
    _menu.dispose();
    super.dispose();
  }

  Future<void> _printBill(TicketDetail ticket) async {
    final l10n = AppLocalizations.of(context)!;
    try {
      await ref.read(printServiceProvider).printBill(ticket, l10n: l10n, locale: Localizations.localeOf(context));
      if (mounted) showPosToast(context, PosToastType.success, l10n.printed);
    } catch (e) {
      if (mounted) showPosToast(context, PosToastType.error, describePrintError(e, l10n));
    }
  }

  void _pick(VoidCallback action) {
    _menu.hide();
    action();
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final ticket = widget.ticket;
    final rowStyle = theme.type.body;
    final destructiveStyle = rowStyle.copyWith(color: theme.colors.destructive);
    final reprint = canReprintKitchen(ref, ticket);

    final menuItems = [
      // The bill on paper before it is paid: the customer looks it over, then says how they pay
      if (ticket.isOpen && ticket.lines.isNotEmpty)
        FItem(
          prefix: const Icon(FIcons.printer, size: Sizes.icon),
          title: Text(l10n.printBill, style: rowStyle),
          onPress: () => _pick(() => _printBill(ticket)),
        ),
      if (ticket.isOpen)
        FItem(
          prefix: const Icon(FIcons.badgePercent, size: Sizes.icon),
          title: Text(l10n.discount, style: rowStyle),
          // Once applied, the row reads the amount; the panel repeats it under the total
          suffix: ticket.discount > 0
              ? Text('−${money(context, ticket.discount)}',
                  style: rowStyle.copyWith(color: AppColors.successColor, fontFeatures: const [FontFeature.tabularFigures()]))
              : null,
          onPress: widget.canSelect ? () => _pick(widget.onDiscount) : null,
        ),
      if (reprint)
        FItem(
          prefix: const Icon(FIcons.printer, size: Sizes.icon),
          title: Text(l10n.kitchenTickets, style: rowStyle),
          onPress: () => _pick(() => showKitchenReprint(context, ticket)),
        ),
      if (ticket.isOpen && widget.canDiscard)
        FItem(
          prefix: Icon(FIcons.trash2, size: Sizes.icon, color: theme.colors.destructive),
          title: Text(l10n.discardTicket, style: destructiveStyle),
          onPress: () => _pick(widget.onDiscard),
        )
      else if (ticket.isOpen && widget.canVoid)
        FItem(
          prefix: Icon(FIcons.ban, size: Sizes.icon, color: theme.colors.destructive),
          title: Text(l10n.voidTicket, style: destructiveStyle),
          onPress: () => _pick(widget.onVoid),
        ),
    ];

    // A phone has no room for the words beside the bill's name: the buttons
    // keep their icons and their size, and say what they are when held
    final compact = context.isCompact;
    Widget action(String label, {required IconData icon, FButtonVariant? variant, VoidCallback? onPress}) => compact
        ? Tooltip(
            message: label,
            child: SizedBox.square(
              dimension: Sizes.control,
              child: FButton.icon(variant: variant, onPress: onPress, child: Icon(icon, size: Sizes.icon)),
            ),
          )
        : SizedBox(
            height: Sizes.control,
            child: FButton(
              variant: variant,
              mainAxisSize: MainAxisSize.min,
              onPress: onPress,
              prefix: Icon(icon, size: Sizes.icon),
              child: Text(label, style: theme.type.button),
            ),
          );

    return Row(
      children: [
        SizedBox.square(
          dimension: Sizes.control,
          child: FButton.icon(
            variant: FButtonVariant.ghost,
            onPress: () => context.go(widget.backTo),
            child: Icon(FIcons.arrowLeft, size: Sizes.iconNav),
          ),
        ),
        const SizedBox(width: Sizes.gapSm),
        Expanded(
          child: Text.rich(
            TextSpan(
              text: widget.title,
              style: theme.type.title,
              children: [
                TextSpan(
                  text: '  ${hashNumber(ticket.id)}',
                  style: theme.type.body.copyWith(
                    fontWeight: FontWeight.w500,
                    color: theme.colors.mutedForeground,
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
              ],
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
        const SizedBox(width: Sizes.gapSm),
        if (ticket.isSettled)
          FBadge(
            variant: FBadgeVariant.secondary,
            child: Text(
              ticket.receiptNumber == null
                  ? l10n.settledBadge
                  : '${l10n.settledBadge} · ${l10n.receiptNumber(ticket.receiptNumber!)}',
              style: const TextStyle(fontFeatures: [FontFeature.tabularFigures()]),
            ),
          )
        else if (ticket.isVoided)
          FBadge(variant: FBadgeVariant.destructive, child: Text(l10n.voidedBadge))
        else ...[
          // The pad, pointed at this bill — same flow as a new sale, the
          // money just comes later
          action(l10n.addItems, icon: FIcons.shoppingCart, onPress: () => context.go('/sale?ticket=${ticket.id}')),
          const SizedBox(width: Sizes.gapSm),
          action(
            l10n.selectLines,
            icon: FIcons.listChecks,
            variant: widget.selecting ? FButtonVariant.secondary : FButtonVariant.outline,
            onPress: widget.canSelect ? widget.onToggleSelecting : null,
          ),
        ],
        if (menuItems.isNotEmpty) ...[
          const SizedBox(width: Sizes.gapSm),
          FPopoverMenu(
            control: FPopoverControl.managed(controller: _menu),
            menuAnchor: AlignmentDirectional.topEnd,
            childAnchor: AlignmentDirectional.bottomEnd,
            menu: [FItemGroup(children: menuItems)],
            builder: (context, controller, _) => SizedBox.square(
              dimension: Sizes.control,
              child: FButton.icon(
                variant: FButtonVariant.outline,
                onPress: controller.toggle,
                child: const Icon(FIcons.ellipsis, size: Sizes.icon),
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class _GroupHeading extends StatelessWidget {
  final String name;
  final double total;

  /// An account holder: the name opens their card
  final String? customerId;

  const _GroupHeading({required this.name, required this.total, this.customerId});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final id = customerId;
    final label = Text(name,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: theme.type.heading);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: theme.colors.muted.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(Sizes.radius),
      ),
      child: Row(
        children: [
          Icon(FIcons.user, size: Sizes.iconSmall, color: theme.colors.foreground),
          const SizedBox(width: 8),
          Expanded(
            child: id != null && id.isNotEmpty
                ? FTappable(onPress: () => showCustomerCard(context, id: id, name: name), child: label)
                : label,
          ),
          const SizedBox(width: 8),
          Text(money(context, total),
              style: theme.type.body.copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
        ],
      ),
    );
  }
}

class _LineList extends StatelessWidget {
  final List<TicketLineView> lines;
  final bool selecting;
  final Set<int> selected;
  final ValueChanged<int> onToggle;

  /// Orders just confirmed by the server, whose lines tick for a moment
  final Set<int> landed;

  const _LineList(
      {required this.lines, required this.selecting, required this.selected, required this.onToggle, this.landed = const {}});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final (index, line) in lines.indexed) ...[
          if (index > 0) Container(height: 1, color: theme.colors.border),
          _LineRow(
            line: line,
            // The room's time is the room's, and what a part payment paid for is done
            selectable: selecting && pickableLine(line),
            selected: selected.contains(line.id),
            onToggle: () => onToggle(line.id),
            landed: landed.contains(line.orderId),
          ),
        ],
      ],
    );
  }
}

class _LineRow extends StatelessWidget {
  final TicketLineView line;
  final bool selectable;
  final bool selected;
  final VoidCallback onToggle;

  /// Just confirmed by the server: it fades up from how it was shown on its way, ticked
  final bool landed;

  const _LineRow(
      {required this.line, required this.selectable, required this.selected, required this.onToggle, this.landed = false});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final negative = line.total < 0;
    final emerald = AppColors.emerald(theme.colors.brightness);
    final muted = theme.type.detail.copyWith(color: theme.colors.mutedForeground);
    final details = line.details?.localized(context);

    final content = Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (selectable) ...[
          Container(
            width: 24,
            height: 24,
            margin: const EdgeInsets.only(top: 2),
            decoration: BoxDecoration(
              color: selected ? theme.colors.primary : null,
              border: Border.all(color: selected ? theme.colors.primary : theme.colors.border),
              borderRadius: BorderRadius.circular(6),
            ),
            child: selected ? Icon(FIcons.check, size: Sizes.iconSmall, color: theme.colors.primaryForeground) : null,
          ),
          const SizedBox(width: 12),
        ],
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                line.description?.localized(context) ?? '',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: theme.type.body.copyWith(
                  fontWeight: FontWeight.w500,
                  color: negative ? emerald : null,
                ),
              ),
              if (details != null && details.isNotEmpty)
                Text(details, maxLines: 1, overflow: TextOverflow.ellipsis, style: muted),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Flexible(
                    child: Text(
                      line.discount > 0
                          ? '${_qty(line.qty)} × ${money(context, line.unitPrice)} − ${money(context, line.discount)} (${l10n.discount})'
                          : '${_qty(line.qty)} × ${money(context, line.unitPrice)}',
                      style: muted.copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(width: 12),
        // Taken earlier as a part payment: on the bill, not in what is left to pay
        if (line.paid) ...[
          const Padding(padding: EdgeInsets.only(top: 3), child: PaidTag()),
          const SizedBox(width: 8),
        ],
        Text(
          money(context, line.total),
          style: theme.type.heading.copyWith(
            color: negative
                ? emerald
                : line.paid
                    ? theme.colors.mutedForeground
                    : null,
            fontFeatures: const [FontFeature.tabularFigures()],
          ),
        ),
      ],
    );

    final box = Container(
      constraints: const BoxConstraints(minHeight: Sizes.control),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: selected ? theme.colors.secondary : null,
        borderRadius: BorderRadius.circular(Sizes.radius),
      ),
      child: content,
    );
    if (selectable) return FTappable(onPress: onToggle, child: box);
    if (!landed) return box;
    // Just in: it stops breathing (core/sending) and a soft tint behind it
    // fades out, so the eye finds what was added; no mark to read
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 1, end: 0),
      duration: const Duration(milliseconds: 1200),
      curve: Curves.easeOut,
      builder: (context, t, child) => DecoratedBox(
        decoration: BoxDecoration(
          color: theme.colors.primary.withValues(alpha: 0.08 * t),
          borderRadius: BorderRadius.circular(Sizes.radius),
        ),
        child: child,
      ),
      child: box,
    );
  }

  static String _qty(double qty) =>
      qty == qty.roundToDouble() ? qty.toStringAsFixed(0) : qty.toString();
}

class _VoidTombstone extends StatelessWidget {
  final TicketDetail ticket;

  const _VoidTombstone({required this.ticket});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final reason = ticket.voidReason;
    final voidedAt = ticket.voidedAt;
    final who = [
      if (ticket.voidedBy != null) ticket.voidedBy!,
      if (voidedAt != null) formatDateTime(context, voidedAt),
    ].join(' · ');

    return _Rows(
      header: Row(
        children: [
          Icon(FIcons.ban, size: Sizes.icon, color: theme.colors.destructive),
          const SizedBox(width: 8),
          Text(l10n.voidedBadge,
              style: theme.type.heading.copyWith(color: theme.colors.destructive)),
        ],
      ),
      rows: [
        if (reason != null && reason.isNotEmpty) (l10n.reason, reason),
        if (who.isNotEmpty) (l10n.voidedBy, who),
      ],
    );
  }
}

/// A bordered block: an optional header row, then label/value rows with a
/// hairline between them — the till's way of listing facts about a bill
class _Rows extends StatelessWidget {
  final Widget? header;
  final List<(String, String)> rows;

  const _Rows({this.header, required this.rows});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    const pad = EdgeInsets.symmetric(horizontal: 12, vertical: 8);
    final children = <Widget>[
      if (header != null) Padding(padding: pad, child: header),
      for (final (label, value) in rows)
        Padding(
          padding: pad,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(label, style: theme.type.body.copyWith(color: theme.colors.mutedForeground)),
              const SizedBox(width: 16),
              Expanded(
                child: Text(value,
                    textAlign: TextAlign.end,
                    style: theme.type.body.copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
              ),
            ],
          ),
        ),
    ];
    return Container(
      decoration: BoxDecoration(
        border: Border.all(color: theme.colors.border),
        borderRadius: BorderRadius.circular(Sizes.radius),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var i = 0; i < children.length; i++) ...[
            if (i > 0) Container(height: 1, color: theme.colors.border),
            children[i],
          ],
        ],
      ),
    );
  }
}

/// One payment on a settled bill: its tender and amount, whose tab an
/// Account payment went on, the way to change a mistyped tender, and, once
/// changed, what it was and who changed it
class _PaymentCard extends StatelessWidget {
  final PaymentView payment;
  final VoidCallback? onChangeTender;

  const _PaymentCard({required this.payment, this.onChangeTender});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    const tabular = [FontFeature.tabularFigures()];
    final muted = theme.type.caption.copyWith(color: theme.colors.mutedForeground, fontFeatures: tabular);
    final from = payment.tenderChangedFrom;
    final changedAt = payment.tenderChangedAt;
    String when(DateTime at) {
      final local = at.toLocal();
      final now = DateTime.now();
      final today = local.year == now.year && local.month == now.month && local.day == now.day;
      return today ? formatTime(context, at) : formatDateTimeShort(context, at);
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        border: Border.all(color: theme.colors.border),
        borderRadius: BorderRadius.circular(Sizes.radius),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(tenderIcon(payment.tender), size: Sizes.iconSmall, color: theme.colors.mutedForeground),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  [
                    tenderLabel(l10n, payment.tender),
                    if (payment.tender == PaymentTender.account && (payment.customerName ?? '').isNotEmpty)
                      payment.customerName!,
                  ].join(' · '),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.type.body.copyWith(fontWeight: FontWeight.w500),
                ),
              ),
              if (onChangeTender != null) ...[
                SizedBox(
                  height: Sizes.controlSmall,
                  child: FButton(
                    variant: FButtonVariant.ghost,
                    mainAxisSize: MainAxisSize.min,
                    onPress: onChangeTender,
                    child: Text(l10n.changeTenderAction,
                        style: theme.type.buttonSmall.copyWith(color: theme.colors.mutedForeground)),
                  ),
                ),
                const SizedBox(width: 8),
              ],
              Text(money(context, payment.amount),
                  style: theme.type.heading.copyWith(fontFeatures: tabular)),
            ],
          ),
          if (from != null) ...[
            const SizedBox(height: 2),
            Text(
              l10n.tenderChangedFrom(
                tenderLabel(l10n, from),
                payment.tenderChangedBy ?? '',
                changedAt == null ? '' : when(changedAt),
              ),
              style: muted,
            ),
          ],
        ],
      ),
    );
  }
}

/// Credit notes: money that went back, each with its reason
class _RefundCard extends StatelessWidget {
  final RefundView refund;

  const _RefundCard({required this.refund});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final refundedAt = refund.refundedAt;
    final meta = [
      refund.tender == PaymentTender.account ? l10n.account : l10n.cash,
      if (refund.customerName != null) refund.customerName!,
      refund.refundedBy,
      if (refundedAt != null) formatDateTime(context, refundedAt),
    ].join(' · ');

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        border: Border.all(color: theme.colors.border),
        borderRadius: BorderRadius.circular(Sizes.radius),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Expanded(
                child: Text(l10n.creditNote(refund.number),
                    style: theme.type.body.copyWith(fontWeight: FontWeight.w500)),
              ),
              Text('−${money(context, refund.amount)}',
                  style: theme.type.body.copyWith(
                    fontWeight: FontWeight.w600,
                    color: theme.colors.destructive,
                    fontFeatures: const [FontFeature.tabularFigures()],
                  )),
            ],
          ),
          const SizedBox(height: 2),
          Text(refund.reason, style: theme.type.detail),
          const SizedBox(height: 2),
          Text(meta,
              style: theme.type.caption.copyWith(
                color: theme.colors.mutedForeground,
                fontFeatures: const [FontFeature.tabularFigures()],
              )),
        ],
      ),
    );
  }
}

/// The bar across every bill's foot, room or table alike: the money at the
/// start, and at the end what is done with the bill — Settle; while lines
/// are picked, whose they are or where they go (two buttons of one width);
/// once paid, Print and an owner's Refund. The
/// actions give way before the total does.
class TicketActionBar extends StatelessWidget {
  final TicketDetail ticket;
  // The running session whose time will join the total when it ends
  final Stay? activeSession;
  final bool selecting;
  final int selectedCount;
  final bool busy;
  final bool canRefund;

  /// What guests paid from their phones: the till takes the rest
  final double paidOnline;

  /// The bill's total with any lines still on their way; the ticket's own otherwise
  final double total;

  /// Lines charged here are still on their way: the settle says so and waits
  final bool confirming;
  final VoidCallback? onSettle;
  final VoidCallback onPrint;
  final VoidCallback onRefund;
  final VoidCallback onAssign;
  final VoidCallback onMove;

  const TicketActionBar({
    super.key,
    required this.ticket,
    required this.activeSession,
    required this.selecting,
    required this.selectedCount,
    required this.busy,
    required this.canRefund,
    this.paidOnline = 0,
    required this.total,
    this.confirming = false,
    required this.onSettle,
    required this.onPrint,
    required this.onRefund,
    required this.onAssign,
    required this.onMove,
  });

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    const tabular = [FontFeature.tabularFigures()];
    final muted = theme.type.detail.copyWith(color: theme.colors.mutedForeground);

    // The bill's parts (menu money, discount, service, VAT, what went back)
    // are one tap away; the panel carries the total
    final hasParts =
        ticket.discount > 0 || ticket.serviceCharge > 0 || ticket.vat > 0 || ticket.refundedTotal > 0;
    final none = selectedCount == 0 || busy;

    // A phone cannot hold the total beside buttons this wide: there the
    // actions go under it and share the bar's width (pos_web's `max-sm:`)
    final compact = context.isCompact;

    Widget action(String label,
        {VoidCallback? onPress,
        FButtonVariant? variant,
        IconData? icon,
        Widget? prefix,
        Color? color,
        bool main = false,
        double? width}) {
      final leading = prefix ?? (icon == null ? null : Icon(icon, size: Sizes.icon, color: color));
      if (compact) {
        return SizedBox(
          height: Sizes.controlLarge,
          child: FButton(
            variant: variant,
            onPress: onPress,
            prefix: leading,
            // Half a phone is a little short of the longer Arabic labels: the
            // words shrink to their button rather than run over or lose their end
            child: Flexible(
              child: FittedBox(
                fit: BoxFit.scaleDown,
                child: Text(label, maxLines: 1, style: theme.type.button.copyWith(color: color)),
              ),
            ),
          ),
        );
      }
      return ConstrainedBox(
        // Side by side in the bar, every action the main action's height;
        // the main one wide enough to be the obvious one
        // (two that are one choice's two answers are given one width instead)
        constraints: width != null
            ? BoxConstraints.tightFor(width: width, height: Sizes.controlLarge)
            : BoxConstraints.tightFor(height: Sizes.controlLarge).copyWith(minWidth: main ? 240 : 160),
        child: FButton(
          variant: variant,
          mainAxisSize: MainAxisSize.min,
          onPress: onPress,
          prefix: leading,
          child: Text(label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: (main ? theme.type.mainAction : theme.type.button).copyWith(color: color)),
        ),
      );
    }

    final actions = ticket.isVoided
        ? const <Widget>[]
        : ticket.isSettled
            ? [
                action(l10n.print, onPress: onPrint, icon: FIcons.printer, main: true),
                // Owner-only, like void: money goes back, so an owner says so.
                // Gone once the whole receipt has been credited.
                if (canRefund)
                  action(l10n.refundTicket,
                      onPress: onRefund,
                      variant: FButtonVariant.outline,
                      icon: FIcons.undo2,
                      color: theme.colors.destructive),
              ]
            : selecting
                ? [
                    action(l10n.assignCustomer,
                        onPress: none ? null : onAssign,
                        variant: FButtonVariant.outline,
                        icon: FIcons.userPlus,
                        width: 220),
                    action(l10n.moveItems,
                        onPress: none ? null : onMove, icon: FIcons.arrowRightLeft, width: 220),
                  ]
                : [
                    confirming
                        ? action(
                            l10n.confirming,
                            main: true,
                            prefix: SizedBox.square(
                              dimension: Sizes.iconSmall,
                              child: CircularProgressIndicator(strokeWidth: 2, color: theme.colors.mutedForeground),
                            ),
                          )
                        : action(l10n.settleAction, onPress: onSettle, main: true),
                  ];

    final figures = <Widget>[
          Row(
            children: [
              // While lines are picked, how many, where the actions for them are
              Flexible(
                child: Text(selecting ? l10n.selectedLinesCount(selectedCount) : l10n.total,
                    maxLines: 1, overflow: TextOverflow.ellipsis, style: muted),
              ),
              if (hasParts)
                SizedBox(
                  height: Sizes.controlSmall,
                  child: FButton(
                    variant: FButtonVariant.ghost,
                    mainAxisSize: MainAxisSize.min,
                    onPress: () => showBreakdownDialog(context, ticket),
                    child: Text(l10n.breakdown, style: muted),
                  ),
                ),
            ],
          ),
          // One line whatever the amount: it shrinks rather than wraps
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: AlignmentDirectional.centerStart,
            child: Text(money(context, total),
                maxLines: 1,
                style: theme.type.figure),
          ),
          if (ticket.discount > 0)
            Text(
              '${l10n.discount} −${money(context, ticket.discount)}'
              '${ticket.discountRate != null ? ' (${rateText(ticket.discountRate)}%)' : ''}',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: theme.type.caption
                  .copyWith(color: AppColors.successColor, fontWeight: FontWeight.w500, fontFeatures: tabular),
            ),
          if (paidOnline > 0 && ticket.isOpen)
            Text(
              '${l10n.remaining} ${money(context, (ticket.total - paidOnline) < 0 ? 0 : ticket.total - paidOnline)}',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: theme.type.caption.copyWith(fontWeight: FontWeight.w600, fontFeatures: tabular),
            ),
          if (activeSession != null)
            Row(
              children: [
                Flexible(
                  child: Text('+ ${l10n.timeSoFar} ≈ ',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.type.caption.copyWith(color: theme.colors.mutedForeground)),
                ),
                TimeSoFar(
                  session: activeSession!,
                  style: theme.type.caption.copyWith(color: theme.colors.mutedForeground, fontFeatures: tabular),
                ),
              ],
            ),
    ];

    Widget across(List<Widget> children) => Row(
          children: [
            for (final (index, child) in children.indexed) ...[
              if (index > 0) const SizedBox(width: Sizes.gapSm),
              Expanded(child: child),
            ],
          ],
        );

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: Sizes.gapLg, vertical: Sizes.gap),
      decoration: BoxDecoration(border: Border(top: BorderSide(color: theme.colors.border))),
      child: compact
          ? Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ...figures,
                if (actions.isNotEmpty) const SizedBox(height: Sizes.gapSm),
                // Three do not fit across: the first takes a row of its own
                // and the main action stays at the end, under the thumb
                if (actions.length > 2) ...[
                  across([actions.first]),
                  const SizedBox(height: Sizes.gapSm),
                  across(actions.sublist(1)),
                ] else if (actions.isNotEmpty)
                  across(actions),
              ],
            )
          : Row(
              children: [
                // The total takes what is left and shrinks; the actions keep their
                // size at the bar's end (shared out with the total, they drifted
                // into the middle)
                Expanded(
                  child:
                      Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: figures),
                ),
                for (final child in actions) ...[
                  const SizedBox(width: Sizes.gapSm),
                  child,
                ],
              ],
            ),
    );
  }
}

/// An ended session's time where its clock stood, stopped at the whole
/// stay: when it ended under it, and the split by rate once more than one
/// was played. No money: the time is a line on the bill now
class _EndedTime extends StatelessWidget {
  final Stay session;

  const _EndedTime({required this.session});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final end = session.endedAt ?? DateTime.now();
    final used = session.usedOptions(end);
    const tabular = [FontFeature.tabularFigures()];
    final muted = theme.type.body.copyWith(color: theme.colors.mutedForeground, fontFeatures: tabular);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(formatClock(session.elapsedSeconds(end)),
            style: theme.type.figure),
        Text(
          session.endedAt == null ? l10n.sessionEnded : '${l10n.sessionEnded} · ${formatTime(context, session.endedAt!)}',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: muted,
        ),
        if (used.length > 1)
          Text(
            used.map((o) => '${o.name.localized(context)} ${formatClock(session.optionSeconds(o.code, end))}').join(' · '),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: theme.type.detail.copyWith(color: theme.colors.mutedForeground, fontFeatures: tabular),
          ),
      ],
    );
  }
}

/// A shimmer stand-in for the room card while the session loads, so opening
/// a room ticket shows the card's shape at once instead of a blank gap.
class _SessionCardSkeleton extends StatelessWidget {
  const _SessionCardSkeleton();

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    return Shimmer.fromColors(
      baseColor: theme.colors.muted,
      highlightColor: theme.colors.background,
      child: Container(
        height: 180,
        decoration: BoxDecoration(color: theme.colors.muted, borderRadius: BorderRadius.circular(Sizes.radiusCard)),
      ),
    );
  }
}

class _Skeleton extends StatelessWidget {
  const _Skeleton();

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: const BoxConstraints(),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Shimmer.fromColors(
            baseColor: theme.colors.muted,
            highlightColor: theme.colors.background,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 256,
                  height: 48,
                  decoration: BoxDecoration(color: theme.colors.muted, borderRadius: BorderRadius.circular(Sizes.radius)),
                ),
                const SizedBox(height: 12),
                Container(
                  height: 256,
                  decoration: BoxDecoration(color: theme.colors.muted, borderRadius: BorderRadius.circular(Sizes.radiusCard)),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _NotFound extends StatelessWidget {
  final AppLocalizations l10n;
  final String backTo;

  const _NotFound({required this.l10n, required this.backTo});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 96),
      child: Column(
        children: [
          Text(l10n.ticketNotFound, style: theme.type.body.copyWith(color: theme.colors.mutedForeground)),
          const SizedBox(height: 16),
          SizedBox(
            height: Sizes.control,
            child: FButton(
              mainAxisSize: MainAxisSize.min,
              onPress: () => context.go(backTo),
              child: Text(backTo == '/' ? l10n.backToFloor : l10n.goBack, style: theme.type.button),
            ),
          ),
        ],
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import 'package:shimmer/shimmer.dart';
import 'package:uuid/uuid.dart';
import '../../../core/auth/auth_service.dart';
import '../../../core/models/dates.dart';
import '../../../core/models/localized_text.dart';
import '../../../core/models/money.dart';
import '../../../core/network/api_errors.dart';
import '../../../core/printing/print_service.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/text_styles.dart';
import '../../../core/widgets/confirm_dialog.dart';
import '../../../core/widgets/heading.dart';
import '../../../core/widgets/pos_toast.dart';
import '../../../l10n/app_localizations.dart';
import '../../floor/widgets/bill_card.dart' show ticketTypeLabel;
import '../../orders/models/order.dart';
import '../../orders/providers/pending_orders_provider.dart';
import '../../orders/services/order_service.dart';
import '../../orders/widgets/pending_orders.dart';
import '../../rooms/models/room.dart';
import '../../rooms/providers/rooms_provider.dart';
import '../../rooms/session_actions.dart';
import '../../rooms/status.dart';
import '../../rooms/widgets/session_bar.dart';
import '../../rooms/widgets/session_members.dart';
import '../../rooms/widgets/time_so_far.dart';
import '../../sale/models/sale_line.dart';
import '../../sale/widgets/customer_dialog.dart';
import '../../tickets/models/enums.dart';
import '../../tickets/models/move_lines.dart';
import '../../tickets/models/ticket_detail.dart';
import '../../tickets/providers/tickets_provider.dart';
import '../../tickets/services/tickets_service.dart';
import '../dialogs/discard_dialog.dart';
import '../dialogs/move_target_dialog.dart';
import '../dialogs/refund_dialog.dart';
import '../dialogs/settle_dialog.dart';
import '../dialogs/void_dialog.dart';
import '../lines.dart';

const _maxWidth = 768.0;
const _actionBarHeight = 96.0;

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

  @override
  void initState() {
    super.initState();
    _subscription = ref.listenManual(ticketProvider(widget.ticketId), _onTicket, fireImmediately: true);
  }

  @override
  void dispose() {
    _subscription?.close();
    super.dispose();
  }

  void _onTicket(AsyncValue<TicketDetail>? previous, AsyncValue<TicketDetail> next) {
    // Gone: an empty room ticket auto-discarded when its session ended, or
    // any ticket deleted out from under the screen. A 404 is the only honest
    // signal that the bill no longer exists — hand the cashier back.
    if (next.error is TicketNotFound) {
      _leave();
      return;
    }
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
    RoomSession? activeSession,
    List<SessionMember> members = const [],
  }) async {
    final l10n = AppLocalizations.of(context)!;
    // A running session cannot be settled past — its time is not on the
    // bill yet, so the only way forward is to end it
    if (activeSession != null) {
      final end = await showConfirmDialog(
        context,
        title: l10n.settleWithSessionTitle,
        description: l10n.settleWithSessionHint,
        cancelLabel: l10n.goBack,
        actionLabel: l10n.endSessionButton,
        destructive: true,
      );
      if (end && mounted) await SessionActions(ref, context).endSession(activeSession.id);
      return;
    }
    // An order still waiting can be settled past (it may be stale) — but
    // not by accident: confirmed later, it would land on a closed bill
    if (waiting.isNotEmpty) {
      final l10n = AppLocalizations.of(context)!;
      final anyway = await showConfirmDialog(
        context,
        title: l10n.settleWithPendingTitle,
        description: l10n.settleWithPendingHint,
        cancelLabel: l10n.goBack,
        actionLabel: l10n.settleAnyway,
        destructive: true,
      );
      if (!anyway || !mounted) return;
    }
    // The dialog refreshes the floor and this ticket itself on success
    await showSettleDialog(context, ticket, members: members);
  }

  // Same rule for Void, server-enforced too: time that has not landed yet
  // is money, and a void would write it off unseen
  Future<void> _voidGuarded(RoomSession? activeSession) async {
    if (activeSession == null) return _void();
    final l10n = AppLocalizations.of(context)!;
    final end = await showConfirmDialog(
      context,
      title: l10n.voidWithSessionTitle,
      description: l10n.voidWithSessionHint,
      cancelLabel: l10n.goBack,
      actionLabel: l10n.endSessionButton,
      destructive: true,
    );
    if (end && mounted) await SessionActions(ref, context).endSession(activeSession.id);
  }

  Future<void> _discard() async {
    final discarded = await showDiscardDialog(context, widget.ticketId);
    if (discarded && mounted) context.go('/');
  }

  Future<void> _void() async {
    final voided = await showVoidDialog(context, widget.ticketId);
    if (voided && mounted) context.go('/');
  }

  Future<void> _refund(TicketDetail ticket) async {
    await showRefundDialog(context, ticket);
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

  // Where the lines go: an open bill, a new tab or table, or a fresh ticket
  // for the same place (the split) when nothing else is named
  Future<void> _move(TicketDetail ticket) async {
    final movable = ticket.lines.where((l) => l.source != 'SessionTime').length;
    final target = await showMoveTargetDialog(
      context,
      ticket: ticket,
      count: _selected.length,
      allSelected: _selected.length >= movable,
    );
    if (target == null || !mounted) return;
    final l10n = AppLocalizations.of(context)!;
    setState(() => _busy = true);
    try {
      final landedOn = await ref.read(ticketsRepositoryProvider).moveLines(
            ticket.id,
            MoveLinesRequest(lineIds: _selected.toList(), target: target),
            // A retry on café Wi-Fi must not become a second command
            requestId: const Uuid().v4(),
          );
      ref.invalidate(ticketProvider(ticket.id));
      ref.read(openTicketsProvider.notifier).refresh();
      if (!mounted) return;
      setState(() {
        _selecting = false;
        _selected.clear();
      });
      showPosToast(context, PosToastType.success, l10n.linesMoved);
      context.go('/ticket/$landedOn');
    } catch (e) {
      if (!mounted) return;
      showPosToast(context, PosToastType.error, describeError(e, l10n));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  // Selected lines → who gets them. A whole order goes through Ordering: the
  // customer owns the order and its points, so naming (or re-naming) it
  // moves the points with it. Anything less is a Sales-side snapshot on
  // just those lines — the bill grouping, the receipt, an Account tender —
  // and the points stay where they are.
  Future<void> _assign(TicketDetail ticket) async {
    final byOrder = <int, List<TicketLineView>>{};
    for (final line in ticket.lines) {
      final orderId = line.orderId;
      if (orderId == null) continue;
      (byOrder[orderId] ??= []).add(line);
    }
    final orderIds = <int>[];
    final lineIds = <int>[];
    for (final entry in byOrder.entries) {
      final chosen = entry.value.where((l) => _selected.contains(l.id)).toList();
      if (chosen.isEmpty) continue;
      if (chosen.length == entry.value.length) {
        orderIds.add(entry.key);
      } else {
        lineIds.addAll(chosen.map((l) => l.id));
      }
    }
    // Manual and session-time lines have no order behind them
    if (orderIds.isEmpty && lineIds.isEmpty) return;

    // The room's people first when this is a room's bill; and somebody with
    // an account named on its lines is in the room — onto the roster, so
    // their share of the time has a tab at settle
    final session = ticket.sessionId == null ? null : ref.read(sessionProvider(ticket.sessionId!)).value;
    final roster = session?.roster ?? const <({String id, String name})>[];
    final SaleCustomer? customer = await showCustomerDialog(context, quickPicks: roster);
    if (customer == null || !mounted) return;
    final accountId = customer.id;
    if (session != null && accountId != null && accountId.isNotEmpty && !roster.any((m) => m.id == accountId)) {
      SessionActions(ref, context).addMember(session.id, accountId, customer.name);
    }
    final l10n = AppLocalizations.of(context)!;
    setState(() => _busy = true);
    try {
      final orders = ref.read(orderRepositoryProvider);
      // A fresh id per call: the server deduplicates a retried request, and
      // a later assignment is a new one
      await Future.wait([
        for (final orderId in orderIds)
          orders.assignOrderCustomer(orderId,
              customerUserId: customer.id, customerName: customer.name, requestId: const Uuid().v4()),
      ]);
      // Part of an order (or several): the snapshot on just those lines
      if (lineIds.isNotEmpty) {
        await ref.read(ticketsRepositoryProvider).assignLinesCustomer(
              ticket.id,
              lineIds: lineIds,
              customerId: customer.id,
              customerName: customer.name,
              requestId: const Uuid().v4(),
            );
      }
      ref.invalidate(ticketProvider(ticket.id));
      if (!mounted) return;
      setState(() {
        _selecting = false;
        _selected.clear();
      });
      showPosToast(context, PosToastType.success, l10n.customerAssigned,
          description: lineIds.isNotEmpty ? l10n.pointsFollowWholeOrder : null);
    } catch (e) {
      if (!mounted) return;
      // A 400 carries the domain's own words (cancelled, already somebody's)
      final detail = describeError(e, l10n);
      showPosToast(context, PosToastType.error, l10n.failedToAssignCustomer,
          description: detail == l10n.somethingWentWrong ? null : detail);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final async = ref.watch(ticketProvider(widget.ticketId));
    // Voiding and refunding are Owner-only (the server enforces the same rule)
    final isOwner = ref.watch(authServiceProvider.select((s) => s.isOwner));

    // Redirecting to the floor — don't flash the stale bill on the way out
    if (async.error is TicketNotFound || _leaving) return const SizedBox.shrink();

    // A refresh keeps the last bill on screen; only the first load is blank
    final ticket = async.value;
    if (ticket == null) {
      return async.isLoading ? const _Skeleton() : _NotFound(l10n: l10n, backTo: widget.backTo);
    }

    final lines = ticket.lines;
    // App orders for this table or session that have not been accepted yet —
    // they are not on the bill until someone taps Confirm
    final waiting = ticket.isOpen
        ? pendingForTicket(ref.watch(pendingOrdersProvider).value ?? const [], sessionId: ticket.sessionId, tableId: ticket.tableId)
        : const <Order>[];
    // A room ticket's time only lands when its session ends, so the screen
    // shows the running clock and guards the settle until then. The session
    // is read by id, not off the active list: once it has ended the bill is
    // still open, and the people in the room are still its account holders
    final session = ticket.isOpen && ticket.sessionId != null ? ref.watch(sessionProvider(ticket.sessionId!)).value : null;
    final activeSession = session != null && session.isActive ? session : null;
    // Ended, bill still open: the time has landed and the roster stays
    // editable so every share can find its tab
    final endedSession = session != null && !session.isActive && !session.isReserved ? session : null;
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
    final canDiscard = lines.isEmpty && (ticket.type != TicketType.room || ticket.sessionEndedAt != null);
    final canVoid = !canDiscard && isOwner;

    return Stack(
      children: [
        Align(
          alignment: Alignment.topCenter,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: _maxWidth),
            child: SingleChildScrollView(
              padding: EdgeInsets.fromLTRB(16, 16, 16, ticket.isVoided ? 16 : _actionBarHeight + 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _Header(
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
                  ),
                  const FDivider(),
                  if (activeSession != null) ...[
                    SessionBar(session: activeSession),
                    const SizedBox(height: 16),
                  ],
                  if (endedSession != null) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: theme.colors.background,
                        border: Border.all(color: theme.colors.border),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Row(
                            children: [
                              Icon(FIcons.users, size: 16, color: theme.colors.mutedForeground),
                              const SizedBox(width: 8),
                              Text(l10n.inTheRoom, style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground)),
                            ],
                          ),
                          const SizedBox(height: 12),
                          SessionMembers(session: endedSession),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],
                  // Confirmed here, they land on this bill — which is why the
                  // guard stops a settle while any are still waiting
                  if (waiting.isNotEmpty) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.amber500.withValues(alpha: 0.1),
                        border: Border.all(color: AppColors.amber500.withValues(alpha: 0.5)),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Row(
                            children: [
                              Icon(FIcons.clock, size: 20, color: AppColors.amber(theme.colors.brightness)),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(l10n.ticketPendingOrders(waiting.length),
                                    style: theme.typography.base.copyWith(fontWeight: FontWeight.w600)),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          PendingOrders(orders: waiting),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],
                  // The time is not a line until the session ends; until
                  // then the bill shows it as the row it will become, so the
                  // running cost is read where the rest of the bill is
                  if (activeSession != null)
                    Container(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      decoration: BoxDecoration(border: Border(bottom: BorderSide(color: theme.colors.border))),
                      child: Row(
                        children: [
                          Icon(FIcons.timer, size: 20, color: theme.colors.mutedForeground),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(l10n.roomTimeRunning,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: theme.typography.base.copyWith(color: theme.colors.mutedForeground)),
                          ),
                          Text('≈ ', style: theme.typography.base.copyWith(color: theme.colors.mutedForeground)),
                          TimeSoFar(
                            session: activeSession,
                            style: theme.typography.base
                                .copyWith(color: theme.colors.mutedForeground, fontFeatures: const [FontFeature.tabularFigures()]),
                          ),
                        ],
                      ),
                    ),
                  if (lines.isEmpty)
                    // Nothing to say while a session runs: the time row above is the bill so far
                    if (activeSession == null)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 64),
                        child: Text(l10n.emptyTicket,
                            textAlign: TextAlign.center,
                            style: theme.typography.base.copyWith(color: theme.colors.mutedForeground)),
                      )
                    else
                      const SizedBox.shrink()
                  else if (!shared)
                    _LineList(lines: shown(lines), selecting: selecting, selected: _selected, onToggle: _toggleLine)
                  else
                    // Shared bill: one heading per person, each with its own
                    // subtotal, so the cashier can read (and split) who owes
                    // what. Lines nobody was named for stay together under
                    // the table's own heading.
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        for (final (index, group) in groups.indexed) ...[
                          if (index > 0) const SizedBox(height: 16),
                          _GroupHeading(
                            name: group.name ?? (group.unattributed ? location : l10n.guest),
                            total: group.total,
                          ),
                          _LineList(
                            lines: shown(group.lines),
                            selecting: selecting,
                            selected: _selected,
                            onToggle: _toggleLine,
                          ),
                        ],
                      ],
                    ),
                  if (ticket.isVoided) ...[
                    const SizedBox(height: 16),
                    _VoidTombstone(ticket: ticket),
                  ],
                  if (ticket.refunds.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    Heading(l10n.refundsTitle),
                    for (final refund in ticket.refunds) ...[
                      const SizedBox(height: 8),
                      _RefundCard(refund: refund),
                    ],
                  ],
                ],
              ),
            ),
          ),
        ),
        // A voided ticket keeps its lines for the record but loses every
        // action — what remains is the audit trail
        if (!ticket.isVoided)
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: _ActionBar(
              ticket: ticket,
              activeSession: activeSession,
              selecting: selecting,
              selectedCount: _selected.length,
              busy: _busy,
              canRefund: isOwner && ticket.refundedTotal < ticket.total,
              onSettle: lines.isEmpty
                  ? null
                  : () => _settle(ticket, waiting: waiting, activeSession: activeSession, members: session?.members ?? const []),
              onPrint: () => _print(ticket),
              onRefund: () => _refund(ticket),
              onAssign: () => _assign(ticket),
              onMove: () => _move(ticket),
            ),
          ),
      ],
    );
  }
}

class _Header extends StatelessWidget {
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

  const _Header({
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
  });

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final destructiveLabel = theme.typography.base.forButton.copyWith(color: theme.colors.destructive);

    return Row(
      children: [
        SizedBox.square(
          dimension: 48,
          child: FButton.icon(
            variant: FButtonVariant.ghost,
            onPress: () => context.go(backTo),
            child: Icon(FIcons.arrowLeft, size: 24),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text.rich(
            TextSpan(
              text: title,
              style: theme.typography.xl.copyWith(fontWeight: FontWeight.w700),
              children: [
                TextSpan(
                  text: '  #${ticket.id}',
                  style: theme.typography.base.copyWith(
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
        const SizedBox(width: 8),
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
          SizedBox(
            height: 48,
            child: FButton(
              mainAxisSize: MainAxisSize.min,
              onPress: () => context.go('/sale?ticket=${ticket.id}'),
              prefix: const Icon(FIcons.shoppingCart, size: 20),
              child: Text(l10n.addItems, style: theme.typography.base.forButton),
            ),
          ),
          const SizedBox(width: 4),
          SizedBox(
            height: 48,
            child: FButton(
              variant: selecting ? FButtonVariant.secondary : FButtonVariant.outline,
              mainAxisSize: MainAxisSize.min,
              onPress: canSelect ? onToggleSelecting : null,
              prefix: const Icon(FIcons.listChecks, size: 20),
              child: Text(l10n.selectLines, style: theme.typography.base.forButton),
            ),
          ),
          // Both ways out live up here, deliberately far from the Settle
          // button in the bottom bar, so neither can be fat-fingered
          if (canDiscard) ...[
            const SizedBox(width: 4),
            SizedBox(
              height: 48,
              child: FButton(
                variant: FButtonVariant.outline,
                mainAxisSize: MainAxisSize.min,
                onPress: onDiscard,
                prefix: Icon(FIcons.trash2, size: 20, color: theme.colors.destructive),
                child: Text(l10n.discardTicket, style: destructiveLabel),
              ),
            ),
          ] else if (canVoid) ...[
            const SizedBox(width: 4),
            SizedBox(
              height: 48,
              child: FButton(
                variant: FButtonVariant.outline,
                mainAxisSize: MainAxisSize.min,
                onPress: onVoid,
                prefix: Icon(FIcons.ban, size: 20, color: theme.colors.destructive),
                child: Text(l10n.voidTicket, style: destructiveLabel),
              ),
            ),
          ],
        ],
      ],
    );
  }
}

class _GroupHeading extends StatelessWidget {
  final String name;
  final double total;

  const _GroupHeading({required this.name, required this.total});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: theme.colors.muted.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          Icon(FIcons.user, size: 16, color: theme.colors.foreground),
          const SizedBox(width: 8),
          Expanded(
            child: Text(name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: theme.typography.base.copyWith(fontWeight: FontWeight.w600)),
          ),
          const SizedBox(width: 8),
          Text(money(context, total),
              style: theme.typography.base.copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
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

  const _LineList({required this.lines, required this.selecting, required this.selected, required this.onToggle});

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
            // Session time belongs to the session: it is never offered for a move
            selectable: selecting && line.source != 'SessionTime',
            selected: selected.contains(line.id),
            onToggle: () => onToggle(line.id),
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

  const _LineRow({required this.line, required this.selectable, required this.selected, required this.onToggle});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final negative = line.total < 0;
    final emerald = AppColors.emerald(theme.colors.brightness);
    final muted = theme.typography.sm.copyWith(color: theme.colors.mutedForeground);
    final details = line.details;

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
            child: selected ? Icon(FIcons.check, size: 16, color: theme.colors.primaryForeground) : null,
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
                style: theme.typography.base.copyWith(
                  fontWeight: FontWeight.w500,
                  color: negative ? emerald : null,
                ),
              ),
              if (details != null && details.isNotEmpty)
                Text(details, maxLines: 1, overflow: TextOverflow.ellipsis, style: muted),
              Text(
                line.discount > 0
                    ? '${_qty(line.qty)} × ${money(context, line.unitPrice)} − ${money(context, line.discount)} (${l10n.discount})'
                    : '${_qty(line.qty)} × ${money(context, line.unitPrice)}',
                style: muted.copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
              ),
            ],
          ),
        ),
        const SizedBox(width: 12),
        Text(
          money(context, line.total),
          style: theme.typography.lg.copyWith(
            fontWeight: FontWeight.w600,
            color: negative ? emerald : null,
            fontFeatures: const [FontFeature.tabularFigures()],
          ),
        ),
      ],
    );

    final box = Container(
      constraints: const BoxConstraints(minHeight: 48),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: selected ? theme.colors.secondary : null,
        borderRadius: BorderRadius.circular(10),
      ),
      child: content,
    );
    return selectable ? FTappable(onPress: onToggle, child: box) : box;
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
    final meta = [
      if (ticket.voidedBy != null) '${l10n.voidedBy}: ${ticket.voidedBy}',
      if (voidedAt != null) formatDateTime(context, voidedAt),
    ].join(' · ');

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: theme.colors.destructive.withValues(alpha: 0.05),
        border: Border.all(color: theme.colors.destructive.withValues(alpha: 0.3)),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(FIcons.ban, size: 20, color: theme.colors.destructive),
              const SizedBox(width: 8),
              Text(l10n.voidedBadge,
                  style: theme.typography.base.copyWith(fontWeight: FontWeight.w600, color: theme.colors.destructive)),
            ],
          ),
          if (reason != null && reason.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(reason, style: theme.typography.base),
          ],
          if (meta.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(meta,
                style: theme.typography.sm.copyWith(
                  color: theme.colors.mutedForeground,
                  fontFeatures: const [FontFeature.tabularFigures()],
                )),
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
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: theme.colors.destructive.withValues(alpha: 0.05),
        border: Border.all(color: theme.colors.destructive.withValues(alpha: 0.3)),
        borderRadius: BorderRadius.circular(14),
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
                    style: theme.typography.base.copyWith(fontWeight: FontWeight.w600)),
              ),
              Text('−${money(context, refund.amount)}',
                  style: theme.typography.base.copyWith(
                    fontWeight: FontWeight.w600,
                    color: theme.colors.destructive,
                    fontFeatures: const [FontFeature.tabularFigures()],
                  )),
            ],
          ),
          const SizedBox(height: 4),
          Text(refund.reason, style: theme.typography.base),
          const SizedBox(height: 4),
          Text(meta, style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground)),
        ],
      ),
    );
  }
}

/// Sticky action bar: the running total is always in reach, and so is the
/// primary action — Settle, Move while selecting, Print once the bill is
/// paid, and an owner's Refund beside it
class _ActionBar extends StatelessWidget {
  final TicketDetail ticket;
  // The running session whose time will join the total when it ends
  final RoomSession? activeSession;
  final bool selecting;
  final int selectedCount;
  final bool busy;
  final bool canRefund;
  final VoidCallback? onSettle;
  final VoidCallback onPrint;
  final VoidCallback onRefund;
  final VoidCallback onAssign;
  final VoidCallback onMove;

  const _ActionBar({
    required this.ticket,
    required this.activeSession,
    required this.selecting,
    required this.selectedCount,
    required this.busy,
    required this.canRefund,
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

    // The bill's parts, when the branch adds any: menu money, service, VAT
    // — shown out of the price or added on top
    final breakdown = ticket.serviceCharge > 0 || ticket.vat > 0
        ? [
            '${l10n.subtotal} ${money(context, ticket.subtotal)}',
            if (ticket.serviceCharge > 0)
              '${l10n.serviceCharge(rateText(ticket.serviceChargeRate))} ${money(context, ticket.serviceCharge)}',
            if (ticket.vat > 0)
              '${ticket.vatIncluded ? l10n.vatIncluded(rateText(ticket.vatRate)) : l10n.vat(rateText(ticket.vatRate))} ${money(context, ticket.vat)}',
          ].join(' · ')
        : null;

    Widget big(String label,
            {VoidCallback? onPress, FButtonVariant? variant, IconData? icon, Color? color, double padding = 16}) =>
        SizedBox(
          height: 56,
          child: FButton(
            variant: variant,
            mainAxisSize: MainAxisSize.min,
            onPress: onPress,
            prefix: icon == null ? null : Icon(icon, size: 20, color: color),
            child: Padding(
              padding: EdgeInsets.symmetric(horizontal: padding),
              child: Text(label, style: theme.typography.lg.forButton.copyWith(color: color)),
            ),
          ),
        );

    final actions = ticket.isSettled
        ? [
            // Owner-only, like void: money goes back, so an owner says so.
            // Gone once the whole receipt has been credited.
            if (canRefund) ...[
              big(l10n.refundTicket,
                  onPress: onRefund,
                  variant: FButtonVariant.outline,
                  icon: FIcons.undo2,
                  color: theme.colors.destructive,
                  padding: 8),
              const SizedBox(width: 8),
            ],
            big(l10n.print, onPress: onPrint, icon: FIcons.printer, padding: 8),
          ]
        : selecting
            ? [
                big(l10n.assignCustomer,
                    onPress: selectedCount == 0 || busy ? null : onAssign,
                    variant: FButtonVariant.outline,
                    icon: FIcons.userPlus,
                    padding: 8),
                const SizedBox(width: 8),
                big(l10n.moveLinesAction(selectedCount), onPress: selectedCount == 0 || busy ? null : onMove, padding: 12),
              ]
            : [big(l10n.settleAction, onPress: onSettle)];

    return Container(
      height: _actionBarHeight,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        color: theme.colors.background.withValues(alpha: 0.95),
        border: Border(top: BorderSide(color: theme.colors.border)),
      ),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: _maxWidth - 32),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(l10n.total, style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground)),
                    Text(money(context, ticket.total),
                        style: theme.typography.xl2.copyWith(fontWeight: FontWeight.w700, fontFeatures: tabular)),
                    if (breakdown != null)
                      Text(breakdown,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.typography.xs.copyWith(color: theme.colors.mutedForeground, fontFeatures: tabular)),
                    if (ticket.refundedTotal > 0)
                      Text('${l10n.refundedSoFar}: −${money(context, ticket.refundedTotal)}',
                          style: theme.typography.xs.copyWith(color: theme.colors.destructive, fontFeatures: tabular)),
                    if (activeSession != null)
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text('+ ${l10n.timeSoFar} ≈ ',
                              style: theme.typography.xs.copyWith(color: theme.colors.mutedForeground)),
                          TimeSoFar(
                            session: activeSession!,
                            style: theme.typography.xs.copyWith(color: theme.colors.mutedForeground, fontFeatures: tabular),
                          ),
                        ],
                      ),
                  ],
                ),
              ),
              const SizedBox(width: 16),
              ...actions,
            ],
          ),
        ),
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
        constraints: const BoxConstraints(maxWidth: _maxWidth),
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
                  decoration: BoxDecoration(color: theme.colors.muted, borderRadius: BorderRadius.circular(8)),
                ),
                const SizedBox(height: 12),
                Container(
                  height: 256,
                  decoration: BoxDecoration(color: theme.colors.muted, borderRadius: BorderRadius.circular(14)),
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
          Text(l10n.ticketNotFound, style: theme.typography.lg.copyWith(color: theme.colors.mutedForeground)),
          const SizedBox(height: 16),
          SizedBox(
            height: 48,
            child: FButton(
              mainAxisSize: MainAxisSize.min,
              onPress: () => context.go(backTo),
              child: Text(backTo == '/' ? l10n.backToFloor : l10n.goBack, style: theme.typography.base.forButton),
            ),
          ),
        ],
      ),
    );
  }
}

import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:uuid/uuid.dart';
import '../../../core/brand/brand_provider.dart';
import '../../../core/motion/motion.dart';
import '../../../core/models/localized_text.dart';
import '../../../core/models/money.dart';
import '../../../core/offline/offline_queue.dart';
import '../../../core/offline/offline_sale.dart';
import '../../../core/providers/branch_provider.dart';
import '../../../core/printing/print_service.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/text_styles.dart';
import '../../../core/widgets/numeric_keypad.dart';
import '../../../core/widgets/pos_toast.dart';
import '../../../l10n/app_localizations.dart';
import '../../customers/providers/customer_providers.dart';
import '../../floor/just_settled.dart';
import '../../receipt/receipt_sheet.dart';
import '../../tickets/models/enums.dart';
import '../../tickets/models/settle.dart';
import '../../places/models/place.dart';
import '../../tickets/models/ticket_detail.dart';
import '../../tickets/providers/tickets_provider.dart';
import '../../tickets/services/tickets_service.dart';
import '../tenders.dart';
import '../widgets/tender_grid.dart';

/// Someone on this bill with an account, and what their share comes to.
class _AccountHolder {
  final String id;
  // Filled in from a line when the roster only had the id
  String name;
  double subtotal;
  _AccountHolder({required this.id, required this.name, required this.subtotal});
}

class SettleOutcome {
  /// 0 for a sale kept on the till — its number comes when it is replayed
  final int receiptNumber;

  /// What the till printed instead, while offline
  final String? provisionalReceiptNumber;
  final double change;
  final List<SettlePayment> payments;
  const SettleOutcome({required this.receiptNumber, this.provisionalReceiptNumber, required this.change, required this.payments});
}

/// Take one or more payments against the ticket total, then settle. The
/// keypad is the only way to type amounts (no OS keyboard on the till).
/// When cash exceeds the remainder, the change due is shown live; the
/// server recomputes it authoritatively on settle.
///
/// With `offline`, the ticket is the pad's own pricing of the sale and the
/// money goes into the offline queue instead of to Sales: cash, card and
/// InstaPay only (an account needs the server), a provisional receipt
/// number on the print, and the real settle when the network is back.
///
/// `members` are the people in the room, for a room ticket: each is a tab
/// the bill can go on, whether or not they ordered anything themselves.
///
/// `onlinePaid` is what guests already paid from their phones (pay at
/// table): the server adds those as Online tenders at settle by itself, so
/// the till only takes what is left.
Future<SettleOutcome?> showSettleDialog(
  BuildContext context,
  TicketDetail ticket, {
  OfflineSaleDraft? offline,
  List<StayMember> members = const [],
  double onlinePaid = 0,
}) {
  return showFDialog<SettleOutcome>(
    context: context,
    useRootNavigator: true,
    builder: (context, style, animation) => FDialog.raw(
      style: style,
      animation: animation,
      constraints: const BoxConstraints(maxWidth: 672),
      builder: (context, _) => _SettleDialog(ticket: ticket, offline: offline, members: members, onlinePaid: onlinePaid),
    ),
  );
}

class _SettleDialog extends ConsumerStatefulWidget {
  final TicketDetail ticket;
  final OfflineSaleDraft? offline;
  final List<StayMember> members;
  final double onlinePaid;
  const _SettleDialog({required this.ticket, this.offline, this.members = const [], this.onlinePaid = 0});

  @override
  ConsumerState<_SettleDialog> createState() => _SettleDialogState();
}

class _SettleDialogState extends ConsumerState<_SettleDialog> {
  final List<SettlePayment> _payments = [];
  _AccountHolder? _accountHolder;

  // Lines this dialog named, by line id: the ticket it was given is a
  // snapshot, so the holders' shares and the unnamed list follow from here
  final Map<int, _AccountHolder> _named = {};
  bool _naming = false;
  PaymentTender _tender = PaymentTender.cash;
  String _amountStr = '';
  bool _settling = false;
  SettleOutcome? _result;
  // The settle button's shape: in flight, ticked, the receipt chip
  MorphPhase _phase = MorphPhase.idle;
  String? _doneLabel;
  // One idempotency key per dialog: a retried settle is the same settle
  final String _requestId = const Uuid().v4();

  double get _total => widget.ticket.total;
  // What the till takes: the total less what guests paid online
  double get _due => _round2(math.max(0, _total - widget.onlinePaid));
  double get _paid => _payments.fold(0, (sum, p) => sum + p.amount);
  double get _remaining => _round2(math.max(0, _due - _paid));
  double get _entered => double.tryParse(_amountStr.isEmpty ? '0' : _amountStr) ?? 0;
  double get _changeDue => _round2(math.max(0, _paid + _entered - _due));

  // Account joins when someone on the bill has one — and the tenant runs tabs
  List<PaymentTender> get _tenders => _holders.isNotEmpty && widget.offline == null && ref.read(featuresProvider).tabs
      ? [...baseTenders, PaymentTender.account]
      : baseTenders;

  // One account holder needs no choosing
  _AccountHolder? get _chosenHolder => _accountHolder ?? (_holders.length == 1 ? _holders.first : null);

  @override
  void initState() {
    super.initState();
    // Prefill the exact remainder — the one-cash-payment happy path is:
    // open, add payment, settle
    _amountStr = _remaining > 0 ? _fmt(_remaining) : '';
  }

  // Everyone this bill can go on, with their share. The people in the
  // room come first: a group splits the time between them however they
  // agree, and someone who ordered nothing still owes their part. Then
  // whoever has lines, with what those come to. A shared table can put
  // Ahmed's items on his tab and Sara's on hers, so the tab is chosen per
  // payment rather than fixed to the ticket.
  List<_AccountHolder> get _holders {
    final holders = <String, _AccountHolder>{};
    for (final member in widget.members) {
      if (member.customerId.isEmpty) continue;
      holders[member.customerId] = _AccountHolder(id: member.customerId, name: member.customerName ?? '', subtotal: 0);
    }
    for (final line in widget.ticket.lines) {
      final named = _named[line.id];
      final id = named?.id ?? line.customerId;
      final name = named?.name ?? line.customerName;
      // The room's time is nobody's share: the group splits it as they say
      if (id == null || id.isEmpty || line.source == 'SessionTime') continue;
      final holder = holders[id];
      if (holder != null) {
        holder.subtotal += line.total;
        if (holder.name.isEmpty && (name ?? '').isNotEmpty) holder.name = name!;
      } else {
        holders[id] = _AccountHolder(id: id, name: name ?? '', subtotal: line.total);
      }
    }
    return holders.values.toList();
  }

  // A round the till named nobody for. The room's time is nobody's and
  // never asked about; a loyalty line is money off, not a round.
  List<TicketLineView> get _unnamed => [
        for (final line in widget.ticket.lines)
          if ((line.customerId ?? '').isEmpty &&
              (line.customerName ?? '').isEmpty &&
              line.source != 'SessionTime' &&
              line.total > 0 &&
              !_named.containsKey(line.id))
            line,
      ];

  // The same call as naming lines on the ticket screen; the screen behind
  // refetches, this dialog remembers
  Future<void> _nameLine(TicketLineView line, _AccountHolder holder) async {
    if (_naming) return;
    setState(() => _naming = true);
    try {
      await ref.read(ticketsRepositoryProvider).assignLinesCustomer(
            widget.ticket.id,
            lineIds: [line.id],
            customerId: holder.id,
            customerName: holder.name,
            requestId: const Uuid().v4(),
          );
      ref.invalidate(ticketProvider(widget.ticket.id));
      if (mounted) setState(() => _named[line.id] = holder);
    } catch (e) {
      if (mounted) showPosToast(context, PosToastType.error, e.toString());
    } finally {
      if (mounted) setState(() => _naming = false);
    }
  }

  // Cash opens the drawer even though the receipt no longer prints by
  // itself — the cashier needs to make change. Quiet if there is no printer
  // (the drawer kicks through it) or it cannot be reached.
  Future<void> _openDrawerForCash(List<SettlePayment> payments) async {
    final service = ref.read(printServiceProvider);
    if (!service.isConfigured) return;
    if (!payments.any((p) => p.tender == PaymentTender.cash)) return;
    try {
      await service.kickDrawer();
    } catch (_) {}
  }

  Future<void> _print(SettleOutcome outcome, {bool auto = false}) async {
    final l10n = AppLocalizations.of(context)!;
    try {
      await ref
          .read(printServiceProvider)
          .printReceipt(
            widget.ticket,
            l10n: l10n,
            locale: Localizations.localeOf(context),
            paymentsOverride: [for (final p in outcome.payments) ReceiptPayment(tender: p.tender, amount: p.amount)],
            receiptNumberOverride: outcome.receiptNumber == 0 ? null : outcome.receiptNumber,
            provisionalReceiptNumber: outcome.provisionalReceiptNumber,
            kickDrawer: auto && outcome.payments.any((p) => p.tender == PaymentTender.cash),
          );
      if (mounted && !auto) showPosToast(context, PosToastType.success, l10n.printed);
    } catch (e) {
      if (mounted) showPosToast(context, PosToastType.error, describePrintError(e, l10n));
    }
  }

  // The money is taken; the sale waits on the till for the network. The
  // drawer opens for cash exactly as it would online; the receipt, with a
  // number of the till's own, is a tap away on Print rather than automatic.
  Future<void> _settleOffline(OfflineSaleDraft draft) async {
    setState(() {
      _settling = true;
      _phase = MorphPhase.busy;
    });
    try {
      final number = await nextProvisionalReceiptNumber();
      final payments = List.of(_payments);
      final sale = OfflineSale(
        id: draft.requestId,
        settleRequestId: const Uuid().v4(),
        placedAt: draft.placedAt,
        branchId: ref.read(selectedBranchIdProvider),
        provisionalReceiptNumber: number,
        lines: draft.lines,
        note: draft.note,
        customer: draft.customer,
        payments: payments,
        subtotal: widget.ticket.subtotal,
        vat: widget.ticket.vat,
        total: widget.ticket.total,
        change: _round2(math.max(0, _paid - _total)),
      );
      await ref.read(offlineQueueProvider.notifier).enqueue(sale);
      if (!mounted) return;
      final outcome = SettleOutcome(receiptNumber: 0, provisionalReceiptNumber: number, change: sale.change, payments: payments);
      // Drawer for cash; the provisional receipt is on screen and one tap
      // away on Print, but does not come out on its own.
      _openDrawerForCash(payments);
      await _land(outcome, AppLocalizations.of(context)!.provisionalReceipt(number));
    } catch (_) {
      if (mounted) _shakeBack();
      rethrow;
    } finally {
      if (mounted) setState(() => _settling = false);
    }
  }

  // The button tells the story before the settled view takes over: a tick,
  // then the receipt number as a chip. The drawer has already opened.
  Future<void> _land(SettleOutcome outcome, String receipt) async {
    setState(() {
      _phase = MorphPhase.success;
      _doneLabel = receipt;
    });
    await Future<void>.delayed(const Duration(milliseconds: 420));
    if (!mounted) return;
    setState(() => _phase = MorphPhase.done);
    await Future<void>.delayed(const Duration(milliseconds: 650));
    if (!mounted) return;
    setState(() => _result = outcome);
  }

  // A refusal: one small shake and the button is a button again
  void _shakeBack() {
    setState(() => _phase = MorphPhase.error);
    Future<void>.delayed(Motion.slow, () {
      if (mounted && _phase == MorphPhase.error) setState(() => _phase = MorphPhase.idle);
    });
  }

  bool get _canSettle => (_payments.isNotEmpty || widget.onlinePaid > 0) && _remaining <= 0 && !_settling;

  static String _fmt(double v) {
    final s = v.toStringAsFixed(2);
    return s.endsWith('.00') ? s.substring(0, s.length - 3) : s;
  }

  // A person's own items, capped at what is still owed. Never the
  // remainder: someone who ordered nothing owes only the part of the time
  // the group says, and that is typed.
  String _shareOf(_AccountHolder? holder) =>
      holder != null && holder.subtotal > 0 ? _fmt(holder.subtotal < _remaining ? holder.subtotal : _remaining) : '';

  void _chooseHolder(_AccountHolder holder) {
    setState(() {
      _accountHolder = holder;
      _amountStr = _shareOf(holder);
    });
  }

  // Cash, card and InstaPay start from what is still owed; a tab starts
  // from the chosen person's items
  void _pickTender(PaymentTender tender) {
    setState(() {
      _tender = tender;
      _amountStr = tender == PaymentTender.account ? _shareOf(_chosenHolder) : (_remaining > 0 ? _fmt(_remaining) : '');
    });
  }

  void _addPayment() {
    final entered = _entered;
    if (entered <= 0) return;
    // An account payment has to name the tab it charges
    if (_tender == PaymentTender.account && _chosenHolder == null) return;
    // Cash may exceed the remainder (change is given back); card, InstaPay
    // and account cannot — clamp them to what is actually owed
    final amount = _tender == PaymentTender.cash ? entered : (entered < _remaining ? entered : _remaining);
    if (amount <= 0) return;
    final holder = _tender == PaymentTender.account ? _chosenHolder : null;
    setState(() {
      _payments.add(SettlePayment(tender: _tender, amount: amount, customerId: holder?.id, customerName: holder?.name));
      _accountHolder = null;
      // Prefill whatever is still owed for the next payment — never for a
      // tab: what goes on account is typed, share by share
      _amountStr = _tender == PaymentTender.account ? '' : (_remaining > 0 ? _fmt(_remaining) : '');
    });
  }

  Future<void> _settle() async {
    final draft = widget.offline;
    if (draft != null) return _settleOffline(draft);
    setState(() {
      _settling = true;
      _phase = MorphPhase.busy;
    });
    try {
      final result = await ref
          .read(ticketsRepositoryProvider)
          .settle(widget.ticket.id, SettleRequest(payments: List.of(_payments)), requestId: _requestId);
      ref.read(openTicketsProvider.notifier).refresh();
      ref.invalidate(ticketProvider(widget.ticket.id));
      // Whatever went on a tab changed what its holder owes
      for (final p in _payments) {
        if (p.customerId case final id? when id.isNotEmpty) invalidateCustomerFrom(ref, id);
      }
      if (!mounted) return;
      // The receipt lists what guests paid online beside the till's tenders
      final outcome = SettleOutcome(receiptNumber: result.receiptNumber, change: result.change, payments: [
        ..._payments,
        if (widget.onlinePaid > 0) SettlePayment(tender: PaymentTender.online, amount: widget.onlinePaid),
      ]);
      // The floor folds this bill away when it is next shown
      ref.read(justSettledProvider.notifier).settled(widget.ticket);
      // No paper by default — many single-item orders never need one. Cash
      // still opens the drawer; the receipt waits for the Print button.
      _openDrawerForCash(outcome.payments);
      await _land(outcome, AppLocalizations.of(context)!.receiptNumber(result.receiptNumber));
    } catch (e) {
      if (!mounted) return;
      final l10n = AppLocalizations.of(context)!;
      _shakeBack();
      showPosToast(context, PosToastType.error, e is SalesException ? e.message : l10n.failedToSettle);
    } finally {
      if (mounted) setState(() => _settling = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final result = _result;
    // The form gives way to the settled view with a fade and the dialog
    // resizing, not a cut
    return AnimatedSize(
      duration: Motion.slow,
      curve: Motion.enter,
      alignment: Alignment.topCenter,
      child: AnimatedSwitcher(
        duration: Motion.base,
        switchInCurve: Motion.enter,
        switchOutCurve: Motion.exit,
        child: result != null
            ? KeyedSubtree(key: const ValueKey('settled'), child: _SettledView(result: result, onPrint: () => _print(result)))
            : KeyedSubtree(key: const ValueKey('form'), child: _form(context)),
      ),
    );
  }

  Widget _form(BuildContext context) {

    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final brightness = Theme.of(context).brightness;
    final tabular = const [FontFeature.tabularFigures()];

    // Cap the height and scroll: on a shorter tablet the keypad, holders and
    // payment list together run past the dialog, and the confirm button was
    // overflowing off the bottom.
    return ConstrainedBox(
      constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.9),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Header: what is being settled and how much
            Container(
              padding: const EdgeInsetsDirectional.fromSTEB(20, 12, 20, 12),
              decoration: BoxDecoration(
                border: Border(bottom: BorderSide(color: theme.colors.border)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: [
                  Text(l10n.settleTitle, style: theme.typography.lg.copyWith(fontWeight: FontWeight.w600)),
                  const Spacer(),
                  Text(
                    money(context, _total),
                    style: theme.typography.xl.copyWith(fontWeight: FontWeight.w700, fontFeatures: tabular),
                  ),
                ],
              ),
            ),
            // Guests paid part from their phones: the server adds it, the
            // till takes the rest
            if (widget.onlinePaid > 0)
              Container(
                padding: const EdgeInsetsDirectional.fromSTEB(20, 8, 20, 8),
                decoration: BoxDecoration(border: Border(bottom: BorderSide(color: theme.colors.border))),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        Text(l10n.paidOnline, style: theme.typography.base.copyWith(color: theme.colors.mutedForeground)),
                        const Spacer(),
                        Text('−${money(context, widget.onlinePaid)}',
                            style: theme.typography.base.copyWith(
                                fontWeight: FontWeight.w600, color: AppColors.emerald(brightness), fontFeatures: tabular)),
                      ],
                    ),
                    Text(l10n.settleRemainingOnly, style: theme.typography.xs.copyWith(color: theme.colors.mutedForeground)),
                  ],
                ),
              ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // How much and how: tender, amount, keypad
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        TenderGrid(tenders: _tenders, selected: _tender, onSelect: _pickTender),
                        // Whose tab. Always in view, even when there is only one
                        // person to choose: a charge must never land on a tab
                        // nobody saw.
                        if (_tender == PaymentTender.account && _holders.isNotEmpty) ...[
                          const SizedBox(height: 12),
                          Text(l10n.whoseAccount, style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground)),
                          const SizedBox(height: 8),
                          for (final holder in _holders) ...[
                            _HolderButton(
                              holder: holder,
                              chosen: _chosenHolder?.id == holder.id,
                              showBalance: widget.offline == null,
                              onChoose: () => _chooseHolder(holder),
                            ),
                            const SizedBox(height: 8),
                          ],
                        ],
                        const SizedBox(height: 12),
                        // The amount being typed, always LTR
                        Directionality(
                          textDirection: TextDirection.ltr,
                          child: Container(
                            height: 56,
                            alignment: Alignment.centerRight,
                            padding: const EdgeInsets.symmetric(horizontal: 16),
                            decoration: BoxDecoration(color: theme.colors.muted, borderRadius: BorderRadius.circular(10)),
                            child: Text(
                              _amountStr.isEmpty ? '0' : _amountStr,
                              style: theme.typography.xl3.copyWith(fontWeight: FontWeight.w700, fontFeatures: tabular),
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),
                        NumericKeypad(value: _amountStr, onChange: (v) => setState(() => _amountStr = v)),
                        const SizedBox(height: 12),
                        SizedBox(
                          height: 48,
                          child: FButton(
                            variant: FButtonVariant.secondary,
                            onPress: _entered > 0 ? _addPayment : null,
                            child: Text(l10n.addPayment, style: theme.typography.base.forButton),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 16),
                  // What has been taken and what is left
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // A round the till named nobody for, on a bill with
                        // more than one tab: whose is it? A tap names it;
                        // ignoring it is fine, the bill settles either way.
                        if (widget.offline == null && _holders.length > 1 && _unnamed.isNotEmpty) ...[
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              border: Border.all(color: theme.colors.border),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Text(l10n.whoseRounds, style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground)),
                                for (final line in _unnamed) ...[
                                  const SizedBox(height: 8),
                                  Text(
                                    '${line.description?.localized(context) ?? ''} · ${money(context, line.total)}',
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: theme.typography.sm,
                                  ),
                                  const SizedBox(height: 4),
                                  Wrap(
                                    spacing: 8,
                                    runSpacing: 8,
                                    children: [
                                      for (final holder in _holders)
                                        FButton(
                                          variant: FButtonVariant.outline,
                                          onPress: _naming ? null : () => _nameLine(line, holder),
                                          child: Text(holder.name.isEmpty ? l10n.guest : holder.name),
                                        ),
                                    ],
                                  ),
                                ],
                              ],
                            ),
                          ),
                          const SizedBox(height: 12),
                        ],
                        if (_payments.isEmpty)
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 24),
                            child: Text(
                              l10n.noPaymentsYet,
                              textAlign: TextAlign.center,
                              style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground),
                            ),
                          )
                        else
                          // A payment slides in from the reading edge; one
                          // taken off folds away and the others close up
                          Presence(
                            exitDuration: Motion.base,
                            enter: (context, key, child) => SlideInItem(distance: 16, child: child),
                            exit: (context, key, child, exit) => AnimatedBuilder(
                              animation: exit,
                              child: child,
                              builder: (context, child) => Opacity(
                                opacity: 1 - Motion.exit.transform(exit.value),
                                child: Transform.scale(scale: 1 - 0.06 * exit.value, child: child),
                              ),
                            ),
                            builder: (context, children) => ReflowScope(
                              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: children),
                            ),
                            children: [
                          for (final (index, payment) in _payments.indexed)
                            Padding(
                            key: ObjectKey(payment),
                            padding: const EdgeInsets.only(bottom: 8),
                            child: Container(
                              padding: const EdgeInsetsDirectional.fromSTEB(12, 4, 4, 4),
                              decoration: BoxDecoration(
                                color: theme.colors.secondary.withValues(alpha: 0.5),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Row(
                                children: [
                                  // Takes the leading space and ellipsizes a
                                  // long account label ("على الحساب · Name")
                                  // so it never pushes the amount onto a new
                                  // line.
                                  Expanded(
                                    child: Align(
                                      alignment: AlignmentDirectional.centerStart,
                                      child: FBadge(
                                        variant: FBadgeVariant.secondary,
                                        child: Text(
                                          payment.customerName != null
                                              ? '${tenderLabel(l10n, payment.tender)} · ${payment.customerName}'
                                              : tenderLabel(l10n, payment.tender),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Text(
                                    money(context, payment.amount),
                                    maxLines: 1,
                                    softWrap: false,
                                    style: theme.typography.base.copyWith(fontWeight: FontWeight.w600, fontFeatures: tabular),
                                  ),
                                  const SizedBox(width: 4),
                                  SizedBox.square(
                                    dimension: 40,
                                    child: FButton.icon(
                                      variant: FButtonVariant.ghost,
                                      onPress: () => setState(() {
                                        _payments.removeAt(index);
                                        _amountStr = _remaining > 0 ? _fmt(_remaining) : '';
                                      }),
                                      child: const Icon(FIcons.x, size: 16),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            ),
                            ],
                          ),
                        const SizedBox(height: 8),
                        _TotalsRow(
                          label: l10n.remaining,
                          value: money(context, _remaining),
                          amount: _remaining,
                          color: _remaining > 0 ? theme.colors.destructive : AppColors.emerald(brightness),
                        ),
                        AnimatedSize(
                          duration: Motion.base,
                          curve: Motion.enter,
                          child: _changeDue > 0
                              ? _TotalsRow(
                                  label: l10n.changeDue,
                                  value: money(context, _changeDue),
                                  amount: _changeDue,
                                  color: AppColors.emerald(brightness))
                              : const SizedBox(width: double.infinity),
                        ),
                        const SizedBox(height: 12),
                        // Outline until the money is all there, solid the
                        // moment it can settle; then it becomes the settle
                        // itself: spinner, tick, receipt number
                        MorphButton(
                          phase: _phase,
                          solid: _canSettle || _phase != MorphPhase.idle,
                          // Online payments alone may cover the bill: nothing to take here then
                          onPressed: _canSettle ? _settle : null,
                          doneLabel: _doneLabel,
                          doneIcon: FIcons.receipt,
                          color: theme.colors.primary,
                          onColor: theme.colors.primaryForeground,
                          successColor: AppColors.emerald(brightness),
                          labelStyle: theme.typography.lg.forButton,
                          semanticsLabel: l10n.confirmSettle,
                          label: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Flexible(child: Text(l10n.confirmSettle, overflow: TextOverflow.ellipsis)),
                              Text(' · ${money(context, _due)}'),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// One tab the bill can go on: the person, what they already owe (so the
/// cashier is never adding to a tab blind), and their share of this bill.
class _HolderButton extends ConsumerWidget {
  final _AccountHolder holder;
  final bool chosen;
  final bool showBalance;
  final VoidCallback onChoose;

  const _HolderButton({required this.holder, required this.chosen, required this.showBalance, required this.onChoose});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    const tabular = [FontFeature.tabularFigures()];
    final tab = showBalance ? ref.watch(tabAccountProvider(holder.id)) : null;
    final owed = tab?.value?.balance ?? 0;
    final owedText = tab?.when(
      loading: () => '…',
      error: (_, _) => null,
      data: (account) => account == null ? l10n.noTab : l10n.owesAmount(money(context, owed > 0 ? owed : 0)),
    );
    final small = theme.typography.sm.forButton.copyWith(fontFeatures: tabular);

    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 44),
      child: FButton(
        variant: chosen ? null : FButtonVariant.outline,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        onPress: onChoose,
        suffix: Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          mainAxisSize: MainAxisSize.min,
          children: [
            if (owedText != null) Text(owedText, style: small.copyWith(color: !chosen && owed > 0 ? theme.colors.destructive : null)),
            if (holder.subtotal > 0) Text(l10n.thisBill(money(context, holder.subtotal)), style: small),
          ],
        ),
        child: Text(
          holder.name.isNotEmpty ? holder.name : l10n.guest,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: theme.typography.base.forButton,
        ),
      ),
    );
  }
}

class _TotalsRow extends StatelessWidget {
  final String label;
  final String value;
  final double amount;
  final Color color;

  const _TotalsRow({required this.label, required this.value, required this.amount, required this.color});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          Text(label, style: theme.typography.lg.copyWith(color: theme.colors.mutedForeground)),
          const Spacer(),
          // Rolls as tenders come and go; the colour eases red to green
          TweenAnimationBuilder<Color?>(
            tween: ColorTween(end: color),
            duration: Motion.base,
            builder: (context, ink, _) => RollingNumber(
              value,
              value: amount,
              style: theme.typography.lg.copyWith(fontWeight: FontWeight.w700, color: ink),
            ),
          ),
        ],
      ),
    );
  }
}

/// The settled view: receipt number, change due, and a way out or to paper.
class _SettledView extends StatelessWidget {
  final SettleOutcome result;
  final VoidCallback onPrint;
  const _SettledView({required this.result, required this.onPrint});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    const tabular = [FontFeature.tabularFigures()];
    final accountAmount = result.payments.where((p) => p.tender == PaymentTender.account).fold<double>(0, (sum, p) => sum + p.amount);

    Widget box(String label, String value, TextStyle valueStyle) => Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: theme.colors.secondary, borderRadius: BorderRadius.circular(14)),
      child: Column(
        children: [
          Text(label, style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground)),
          Text(value, style: valueStyle),
        ],
      ),
    );

    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 448),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Icon(FIcons.circleCheck, size: 56, color: AppColors.emerald500),
            const SizedBox(height: 12),
            Text(
              l10n.ticketSettled,
              textAlign: TextAlign.center,
              style: theme.typography.xl2.copyWith(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 12),
            Text(
              result.provisionalReceiptNumber != null
                  ? l10n.provisionalReceipt(result.provisionalReceiptNumber!)
                  : l10n.receiptNumber(result.receiptNumber),
              textAlign: TextAlign.center,
              style: theme.typography.xl3.copyWith(fontWeight: FontWeight.w700, fontFeatures: tabular),
            ),
            if (result.provisionalReceiptNumber != null) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.amber500.withValues(alpha: 0.1),
                  border: Border.all(color: AppColors.amber500.withValues(alpha: 0.5)),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Column(
                  children: [
                    Text(l10n.savedOffline, style: theme.typography.base.copyWith(fontWeight: FontWeight.w600)),
                  ],
                ),
              ),
            ],
            if (result.change > 0) ...[
              const SizedBox(height: 12),
              box(
                l10n.changeDue,
                money(context, result.change),
                theme.typography.xl4.copyWith(fontWeight: FontWeight.w700, fontFeatures: tabular),
              ),
            ],
            if (accountAmount > 0) ...[
              const SizedBox(height: 12),
              box(
                l10n.onCustomerTab,
                money(context, accountAmount),
                theme.typography.xl3.copyWith(fontWeight: FontWeight.w700, fontFeatures: tabular),
              ),
            ],
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: SizedBox(
                    height: 56,
                    child: FButton(
                      variant: FButtonVariant.outline,
                      onPress: () => Navigator.of(context, rootNavigator: true).pop(result),
                      child: Text(l10n.done, style: theme.typography.base.forButton),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: SizedBox(
                    height: 56,
                    child: FButton(
                      onPress: onPrint,
                      prefix: const Icon(FIcons.printer, size: 20),
                      child: Text(l10n.print, style: theme.typography.base.forButton),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Two decimals, like pos_web's `+(x).toFixed(2)`
double _round2(num value) => (value * 100).roundToDouble() / 100;

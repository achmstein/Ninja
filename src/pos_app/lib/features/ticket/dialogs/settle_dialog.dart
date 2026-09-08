import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:uuid/uuid.dart';
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
import '../../receipt/receipt_sheet.dart';
import '../../tickets/models/enums.dart';
import '../../tickets/models/settle.dart';
import '../../rooms/models/room.dart';
import '../../tickets/models/ticket_detail.dart';
import '../../tickets/providers/tickets_provider.dart';
import '../../tickets/services/tickets_service.dart';
import '../tenders.dart';

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
Future<SettleOutcome?> showSettleDialog(
  BuildContext context,
  TicketDetail ticket, {
  OfflineSaleDraft? offline,
  List<SessionMember> members = const [],
}) {
  return showFDialog<SettleOutcome>(
    context: context,
    useRootNavigator: true,
    builder: (context, style, animation) => FDialog.raw(
      style: style,
      animation: animation,
      constraints: const BoxConstraints(maxWidth: 672),
      builder: (context, _) => _SettleDialog(ticket: ticket, offline: offline, members: members),
    ),
  );
}

class _SettleDialog extends ConsumerStatefulWidget {
  final TicketDetail ticket;
  final OfflineSaleDraft? offline;
  final List<SessionMember> members;
  const _SettleDialog({required this.ticket, this.offline, this.members = const []});

  @override
  ConsumerState<_SettleDialog> createState() => _SettleDialogState();
}

class _SettleDialogState extends ConsumerState<_SettleDialog> {
  final List<SettlePayment> _payments = [];
  late final List<_AccountHolder> _holders;
  _AccountHolder? _accountHolder;
  PaymentTender _tender = PaymentTender.cash;
  String _amountStr = '';
  bool _settling = false;
  SettleOutcome? _result;
  // One idempotency key per dialog: a retried settle is the same settle
  final String _requestId = const Uuid().v4();

  double get _total => widget.ticket.total;
  double get _paid => _payments.fold(0, (sum, p) => sum + p.amount);
  double get _remaining => _round2(math.max(0, _total - _paid));
  double get _entered => double.tryParse(_amountStr.isEmpty ? '0' : _amountStr) ?? 0;
  double get _changeDue => _round2(math.max(0, _paid + _entered - _total));

  List<PaymentTender> get _tenders =>
      _holders.isNotEmpty && widget.offline == null ? [...baseTenders, PaymentTender.account] : baseTenders;

  // One account holder needs no choosing
  _AccountHolder? get _chosenHolder =>
      _accountHolder ?? (_holders.length == 1 ? _holders.first : null);

  @override
  void initState() {
    super.initState();
    // Everyone this bill can go on, with their share. The people in the
    // room come first: a group splits the time between them however they
    // agree, and someone who ordered nothing still owes their part. Then
    // whoever has lines, with what those come to. A shared table can put
    // Ahmed's items on his tab and Sara's on hers, so the tab is chosen per
    // payment rather than fixed to the ticket.
    final holders = <String, _AccountHolder>{};
    for (final member in widget.members) {
      if (member.customerId.isEmpty) continue;
      holders[member.customerId] = _AccountHolder(id: member.customerId, name: member.customerName ?? '', subtotal: 0);
    }
    for (final line in widget.ticket.lines) {
      final id = line.customerId;
      // The room's time is nobody's share: the group splits it as they say
      if (id == null || id.isEmpty || line.source == 'SessionTime') continue;
      final holder = holders[id];
      if (holder != null) {
        holder.subtotal += line.total;
        if (holder.name.isEmpty && (line.customerName ?? '').isNotEmpty) holder.name = line.customerName!;
      } else {
        holders[id] = _AccountHolder(id: id, name: line.customerName ?? '', subtotal: line.total);
      }
    }
    _holders = holders.values.toList();
    // Prefill the exact remainder — the one-cash-payment happy path is:
    // open, add payment, settle
    _amountStr = _remaining > 0 ? _fmt(_remaining) : '';
  }

  Future<void> _print(SettleOutcome outcome, {bool auto = false}) async {
    final l10n = AppLocalizations.of(context)!;
    try {
      await ref.read(printServiceProvider).printReceipt(
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
  // receipt prints now, with a number of the till's own, and the drawer
  // opens for cash exactly as it would online.
  Future<void> _settleOffline(OfflineSaleDraft draft) async {
    setState(() => _settling = true);
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
      setState(() => _result = outcome);
      if (ref.read(printServiceProvider).isConfigured) _print(outcome, auto: true);
    } finally {
      if (mounted) setState(() => _settling = false);
    }
  }

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
      _payments.add(SettlePayment(
        tender: _tender,
        amount: amount,
        customerId: holder?.id,
        customerName: holder?.name,
      ));
      _accountHolder = null;
      // Prefill whatever is still owed for the next payment — never for a
      // tab: what goes on account is typed, share by share
      _amountStr = _tender == PaymentTender.account ? '' : (_remaining > 0 ? _fmt(_remaining) : '');
    });
  }

  Future<void> _settle() async {
    final draft = widget.offline;
    if (draft != null) return _settleOffline(draft);
    setState(() => _settling = true);
    try {
      final result = await ref
          .read(ticketsRepositoryProvider)
          .settle(widget.ticket.id, SettleRequest(payments: List.of(_payments)), requestId: _requestId);
      ref.read(openTicketsProvider.notifier).refresh();
      ref.invalidate(ticketProvider(widget.ticket.id));
      if (!mounted) return;
      final outcome = SettleOutcome(receiptNumber: result.receiptNumber, change: result.change, payments: List.of(_payments));
      setState(() => _result = outcome);
      // The receipt comes out by itself, and cash opens the drawer. A till
      // with no printer stays quiet; one that cannot reach it says so.
      if (ref.read(printServiceProvider).isConfigured) _print(outcome, auto: true);
    } catch (e) {
      if (!mounted) return;
      final l10n = AppLocalizations.of(context)!;
      showPosToast(context, PosToastType.error, e is SalesException ? e.message : l10n.failedToSettle);
    } finally {
      if (mounted) setState(() => _settling = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final result = _result;
    if (result != null) return _SettledView(result: result, onPrint: () => _print(result));

    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final brightness = Theme.of(context).brightness;
    final tabular = const [FontFeature.tabularFigures()];

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Header: what is being settled and how much
        Container(
          padding: const EdgeInsetsDirectional.fromSTEB(20, 12, 20, 12),
          decoration: BoxDecoration(border: Border(bottom: BorderSide(color: theme.colors.border))),
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
                    _TenderGrid(
                      tenders: _tenders,
                      selected: _tender,
                      onSelect: _pickTender,
                    ),
                    // Whose tab. Always in view, even when there is only one
                    // person to choose: a charge must never land on a tab
                    // nobody saw.
                    if (_tender == PaymentTender.account && _holders.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      Text(l10n.whoseAccount, style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground)),
                      const SizedBox(height: 8),
                      for (final holder in _holders) ...[
                        SizedBox(
                          height: 44,
                          child: FButton(
                            variant: _chosenHolder?.id == holder.id ? null : FButtonVariant.outline,
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            onPress: () => _chooseHolder(holder),
                            suffix: holder.subtotal > 0
                                ? Text(money(context, holder.subtotal), style: theme.typography.base.forButton.copyWith(fontFeatures: tabular))
                                : null,
                            child: Text(holder.name.isNotEmpty ? holder.name : l10n.guest,
                                maxLines: 1, overflow: TextOverflow.ellipsis, style: theme.typography.base.forButton),
                          ),
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
                        decoration: BoxDecoration(
                          color: theme.colors.muted,
                          borderRadius: BorderRadius.circular(10),
                        ),
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
                      for (final (index, payment) in _payments.indexed) ...[
                        Container(
                          padding: const EdgeInsetsDirectional.fromSTEB(12, 4, 4, 4),
                          decoration: BoxDecoration(
                            color: theme.colors.secondary.withValues(alpha: 0.5),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Row(
                            children: [
                              FBadge(
                                variant: FBadgeVariant.secondary,
                                child: Text(
                                  payment.customerName != null
                                      ? '${tenderLabel(l10n, payment.tender)} · ${payment.customerName}'
                                      : tenderLabel(l10n, payment.tender),
                                ),
                              ),
                              const Spacer(),
                              Text(
                                money(context, payment.amount),
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
                        const SizedBox(height: 8),
                      ],
                    const SizedBox(height: 8),
                    _TotalsRow(
                      label: l10n.remaining,
                      value: money(context, _remaining),
                      color: _remaining > 0 ? theme.colors.destructive : AppColors.emerald(brightness),
                    ),
                    if (_changeDue > 0)
                      _TotalsRow(
                        label: l10n.changeDue,
                        value: money(context, _changeDue),
                        color: AppColors.emerald(brightness),
                      ),
                    const SizedBox(height: 12),
                    SizedBox(
                      height: 56,
                      child: FButton(
                        onPress: _payments.isNotEmpty && _remaining <= 0 && !_settling ? _settle : null,
                        child: Text(l10n.confirmSettle, style: theme.typography.lg.forButton),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _TenderGrid extends StatelessWidget {
  final List<PaymentTender> tenders;
  final PaymentTender selected;
  final ValueChanged<PaymentTender> onSelect;

  const _TenderGrid({required this.tenders, required this.selected, required this.onSelect});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final columns = tenders.length == 4 ? 2 : 3;
    final rows = <List<PaymentTender>>[];
    for (var i = 0; i < tenders.length; i += columns) {
      rows.add(tenders.sublist(i, i + columns > tenders.length ? tenders.length : i + columns));
    }
    return Column(
      children: [
        for (final (rowIndex, row) in rows.indexed) ...[
          if (rowIndex > 0) const SizedBox(height: 8),
          Row(
            children: [
              for (final (index, tender) in row.indexed) ...[
                if (index > 0) const SizedBox(width: 8),
                Expanded(
                  child: SizedBox(
                    height: 44,
                    child: FButton(
                      variant: tender == selected ? null : FButtonVariant.outline,
                      onPress: () => onSelect(tender),
                      child: Text(tenderLabel(l10n, tender), style: theme.typography.base.forButton),
                    ),
                  ),
                ),
              ],
              // Keep a short last row aligned with the grid
              for (var i = row.length; i < columns; i++) ...[
                const SizedBox(width: 8),
                const Expanded(child: SizedBox()),
              ],
            ],
          ),
        ],
      ],
    );
  }
}

class _TotalsRow extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _TotalsRow({required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          Text(label, style: theme.typography.lg.copyWith(color: theme.colors.mutedForeground)),
          const Spacer(),
          Text(
            value,
            style: theme.typography.lg.copyWith(
              fontWeight: FontWeight.w700,
              color: color,
              fontFeatures: const [FontFeature.tabularFigures()],
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
    final accountAmount = result.payments
        .where((p) => p.tender == PaymentTender.account)
        .fold<double>(0, (sum, p) => sum + p.amount);

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
            Text(l10n.ticketSettled, textAlign: TextAlign.center, style: theme.typography.xl2.copyWith(fontWeight: FontWeight.w600)),
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
                    const SizedBox(height: 2),
                    Text(l10n.savedOfflineHint, textAlign: TextAlign.center, style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground)),
                  ],
                ),
              ),
            ],
            if (result.change > 0) ...[
              const SizedBox(height: 12),
              box(l10n.changeDue, money(context, result.change),
                  theme.typography.xl4.copyWith(fontWeight: FontWeight.w700, fontFeatures: tabular)),
            ],
            if (accountAmount > 0) ...[
              const SizedBox(height: 12),
              box(l10n.onCustomerTab, money(context, accountAmount),
                  theme.typography.xl3.copyWith(fontWeight: FontWeight.w700, fontFeatures: tabular)),
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

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/models/localized_text.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import 'package:uuid/uuid.dart';
import '../../../core/auth/auth_service.dart';
import '../../../core/brand/brand_provider.dart';
import '../../../core/models/dates.dart';
import '../../../core/models/money.dart';
import '../../../core/network/api_errors.dart';
import '../../../core/printing/print_service.dart';
import '../../../core/theme/type_roles.dart';
import '../../../core/widgets/count_column.dart';
import '../../../core/widgets/pos_toast.dart';
import '../../../core/widgets/skeleton.dart';
import '../../../l10n/app_localizations.dart';
import '../../shifts/providers/shifts_provider.dart';
import '../../ticket/dialogs/change_tender_dialog.dart';
import '../../ticket/refund_math.dart';
import '../../ticket/tenders.dart';
import '../../tickets/models/enums.dart';
import '../../tickets/models/refund.dart';
import '../../tickets/models/ticket_detail.dart';
import '../../tickets/providers/tickets_provider.dart';
import '../../tickets/services/tickets_service.dart';

/// One closed bill, worked on where it is picked: beside the receipts list.
/// What was on it, what it came to, how it was paid and what went back since,
/// across the whole width it is given. And what is done to a closed bill is
/// done here: it is printed again, the way it was paid is put right, and an
/// owner gives money back, the same pane turning to the refund and back. The
/// bill's own page was three steps away for each. The web till's
/// ReceiptPreview is the same.
class ReceiptPane extends ConsumerStatefulWidget {
  final int ticketId;

  /// The row's own title: the place, or the name on the bill
  final String title;

  /// Called once a refund is made, so the list can say what went back
  final VoidCallback? onChanged;

  const ReceiptPane({super.key, required this.ticketId, required this.title, this.onChanged});

  @override
  ConsumerState<ReceiptPane> createState() => _ReceiptPaneState();
}

class _ReceiptPaneState extends ConsumerState<ReceiptPane> {
  // The pane is the receipt, or the refund being made against it
  bool _refunding = false;
  final Map<int, double> _picked = {};
  final _reason = TextEditingController();
  PaymentTender _tender = PaymentTender.cash;
  String? _holderId;
  bool _pending = false;
  bool _printing = false;
  // One per refund being made: a retry on a poor line is the same refund
  String _requestId = const Uuid().v4();

  @override
  void initState() {
    super.initState();
    _reason.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  void _leave() => setState(() {
        _refunding = false;
        _picked.clear();
        _reason.clear();
        _tender = PaymentTender.cash;
        _holderId = null;
        _requestId = const Uuid().v4();
      });

  Future<void> _print(TicketDetail ticket) async {
    final l10n = AppLocalizations.of(context)!;
    setState(() => _printing = true);
    try {
      await ref.read(printServiceProvider).printReceipt(ticket, l10n: l10n, locale: Localizations.localeOf(context));
      if (mounted) showPosToast(context, PosToastType.success, l10n.printed);
    } catch (e) {
      if (mounted) showPosToast(context, PosToastType.error, describePrintError(e, l10n));
    } finally {
      if (mounted) setState(() => _printing = false);
    }
  }

  Future<void> _submit(TicketDetail ticket, List<RefundEntry> entries, RefundHolder? holder) async {
    final l10n = AppLocalizations.of(context)!;
    final onAccount = _tender == PaymentTender.account;
    setState(() => _pending = true);
    try {
      final result = await ref.read(ticketsRepositoryProvider).refund(
            ticket.id,
            RefundRequest(
              lines: [
                for (final entry in entries)
                  if ((_picked[entry.line.id] ?? 0) > 0)
                    RefundLineRequest(lineId: entry.line.id, qty: _picked[entry.line.id]!),
              ],
              reason: _reason.text.trim(),
              tender: onAccount ? PaymentTender.account : PaymentTender.cash,
              customerId: onAccount ? holder?.id : null,
              customerName: onAccount ? holder?.name : null,
            ),
            requestId: _requestId,
          );
      ref.invalidate(ticketProvider(ticket.id));
      ref.read(openTicketsProvider.notifier).refresh();
      ref.read(currentShiftProvider.notifier).refresh();
      widget.onChanged?.call();
      if (!mounted) return;
      showPosToast(context, PosToastType.success, l10n.ticketRefunded(money(context, result.amount), result.number));
      setState(() => _pending = false);
      _leave();
    } catch (e) {
      if (!mounted) return;
      setState(() => _pending = false);
      showPosToast(context, PosToastType.error, describeError(e, l10n));
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final ticket = ref.watch(ticketProvider(widget.ticketId));
    final rule = BorderSide(color: theme.colors.border);

    return ticket.when(
      skipLoadingOnReload: true,
      skipLoadingOnRefresh: true,
      loading: () => Skeleton(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (var i = 0; i < 6; i++) ...[
                skeletonBar(context, widthFactor: i.isEven ? 0.6 : 0.4, height: 16),
                const SizedBox(height: 16),
              ],
            ],
          ),
        ),
      ),
      error: (e, _) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(describeError(e, l10n),
              textAlign: TextAlign.center, style: theme.type.body.copyWith(color: theme.colors.mutedForeground)),
        ),
      ),
      data: (ticket) => _receipt(context, ticket, rule),
    );
  }

  Widget _receipt(BuildContext context, TicketDetail ticket, BorderSide rule) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    const tabular = [FontFeature.tabularFigures()];
    final muted = theme.type.detail.copyWith(color: theme.colors.mutedForeground);
    final isOwner = ref.watch(authServiceProvider.select((s) => s.isOwner));
    final number = ticket.receiptNumber;
    final entries = refundEntries(ticket);
    final holders = refundHolders(ticket);
    final holder = holders.where((h) => h.id == _holderId).firstOrNull ?? holders.firstOrNull;
    final preview = refundPreview(ticket, entries, _picked);
    // Owner-only, like a void: money goes back, so an owner says so. Gone once the whole receipt has been credited
    final canRefund = isOwner && !ticket.isVoided && number != null && ticket.refundedTotal < ticket.total;
    final ready =
        preview > 0 && _reason.text.trim().isNotEmpty && (_tender == PaymentTender.cash || holder != null) && !_pending;

    final meta = [
      if (ticket.settledAt != null) formatDateTime(context, ticket.settledAt!),
      if ((ticket.settledBy ?? '').isNotEmpty) '${l10n.closedBy} ${ticket.settledBy}',
    ].join(' · ');

    // As tall as the list's head beside it (8 + 48 + 8), so the two rules under them meet in one line
    final head = Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(border: Border(bottom: rule)),
      child: Row(
        children: [
          Expanded(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                Text(
                  _refunding
                      ? l10n.refundTitle(number ?? 0)
                      : (number == null ? l10n.receipts : l10n.receiptNumber(number)),
                  maxLines: 1,
                  style: theme.type.title.copyWith(fontFeatures: tabular),
                ),
                const SizedBox(width: 8),
                Flexible(
                  child: Text(widget.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.type.title.copyWith(fontWeight: FontWeight.w400, color: theme.colors.mutedForeground)),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          if (_refunding)
            SizedBox.square(
              dimension: Sizes.control,
              child: Semantics(
                label: l10n.cancel,
                child: FButton.icon(
                  variant: FButtonVariant.ghost,
                  onPress: _pending ? null : _leave,
                  child: const Icon(FIcons.x, size: Sizes.iconNav),
                ),
              ),
            )
          else ...[
            Flexible(child: Text(meta, maxLines: 1, overflow: TextOverflow.ellipsis, style: muted.copyWith(fontFeatures: tabular))),
            // The head keeps its height with no button in it
            const SizedBox(height: Sizes.control),
          ],
        ],
      ),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        head,
        // Across the whole width the pane is given: a receipt held to a column left the rest of a wide screen empty
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: _refunding
                  ? _refundBody(context, ticket, entries, holders, holder, preview)
                  : _readBody(context, ticket, rule),
            ),
          ),
        ),
        // The foot, as on the order: what can be done, in the same place on every receipt
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(border: Border(top: rule)),
          child: Row(
            children: _refunding
                ? [
                    SizedBox(
                      width: 128,
                      height: Sizes.controlLarge,
                      child: FButton(
                        variant: FButtonVariant.outline,
                        onPress: _pending ? null : _leave,
                        child: Text(l10n.goBack, style: theme.type.button),
                      ),
                    ),
                    const Spacer(),
                    SizedBox(
                      width: 300,
                      height: Sizes.controlLarge,
                      child: FButton(
                        variant: FButtonVariant.destructive,
                        onPress: ready ? () => _submit(ticket, entries, holder) : null,
                        prefix: _pending
                            ? const SizedBox.square(dimension: Sizes.icon, child: CircularProgressIndicator(strokeWidth: 2))
                            : null,
                        child: Expanded(
                          child: Row(
                            children: [
                              Expanded(
                                child: Text(l10n.refundTicket,
                                    maxLines: 1, overflow: TextOverflow.ellipsis, style: theme.type.mainAction),
                              ),
                              Text(money(context, preview), style: theme.type.mainAction.copyWith(fontFeatures: tabular)),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ]
                : [
                    if (!ticket.isVoided)
                      SizedBox(
                        width: 160,
                        height: Sizes.control,
                        child: FButton(
                          variant: FButtonVariant.outline,
                          onPress: _printing ? null : () => _print(ticket),
                          prefix: const Icon(FIcons.printer, size: Sizes.icon),
                          child: Text(l10n.print, style: theme.type.button),
                        ),
                      ),
                    const Spacer(),
                    if (canRefund)
                      SizedBox(
                        width: 160,
                        height: Sizes.control,
                        child: FButton(
                          variant: FButtonVariant.outline,
                          onPress: () => setState(() => _refunding = true),
                          prefix: Icon(FIcons.undo2, size: Sizes.icon, color: theme.colors.destructive),
                          child: Text(l10n.refundTicket, style: theme.type.button.copyWith(color: theme.colors.destructive)),
                        ),
                      ),
                  ],
          ),
        ),
      ],
    );
  }

  static String _qty(double qty) => qty == qty.roundToDouble() ? qty.toStringAsFixed(0) : qty.toString();

  /// A quiet name over a part of the receipt
  Widget _label(String text) => Padding(padding: const EdgeInsets.only(top: 16, bottom: 4), child: TypeLabel(text));

  List<Widget> _readBody(BuildContext context, TicketDetail ticket, BorderSide rule) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    const tabular = [FontFeature.tabularFigures()];
    final muted = theme.type.detail.copyWith(color: theme.colors.mutedForeground);
    final divider = Container(height: 1, color: theme.colors.border);
    final back = refundedQtyByLine(ticket);
    final countStyle = theme.type.body.copyWith(color: theme.colors.mutedForeground, fontFeatures: tabular);
    // One column for the whole list, as wide as its widest count, with a gap after it
    final countWidth =
        countColumnWidth(context, [for (final line in ticket.lines) '${_qty(line.qty)}×'], countStyle, min: 32) + 8;
    final hasBreakdown = ticket.discount > 0 || ticket.serviceCharge > 0 || ticket.vat > 0;
    final paid = ticket.payments.fold<double>(0, (sum, p) => sum + p.amount);
    final change = paid - ticket.total > 0 ? paid - ticket.total : 0.0;

    Widget sum(String label, String value, {TextStyle? style}) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 2),
          child: Row(
            children: [
              Expanded(child: Text(label, style: style ?? muted)),
              Text(value, style: (style ?? muted).copyWith(fontFeatures: tabular)),
            ],
          ),
        );

    return [
      for (final (index, line) in ticket.lines.indexed) ...[
        if (index > 0) divider,
        Builder(builder: (context) {
          final taken = back[line.id] ?? 0;
          final allBack = taken >= line.qty;
          final details = line.details?.localized(context) ?? '';
          return ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 56),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Row(
                children: [
                  Opacity(
                    opacity: allBack ? 0.5 : 1,
                    child: SizedBox(
                        width: countWidth,
                        child: Text('${_qty(line.qty)}×', maxLines: 1, softWrap: false, style: countStyle)),
                  ),
                  Expanded(
                    child: Opacity(
                      opacity: allBack ? 0.5 : 1,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(line.description?.localized(context) ?? '',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: theme.type.body.copyWith(fontWeight: FontWeight.w500)),
                          if (details.isNotEmpty) Text(details, maxLines: 1, overflow: TextOverflow.ellipsis, style: muted),
                          if ((line.customerName ?? '').isNotEmpty)
                            Text(line.customerName!, maxLines: 1, overflow: TextOverflow.ellipsis, style: muted),
                        ],
                      ),
                    ),
                  ),
                  if (taken > 0) ...[
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 1),
                      decoration: BoxDecoration(
                        color: theme.colors.destructive.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text('${l10n.refundedSoFar} ${_qty(taken)}',
                          style: theme.type.caption.copyWith(
                              fontWeight: FontWeight.w600, color: theme.colors.destructive, fontFeatures: tabular)),
                    ),
                  ],
                  const SizedBox(width: 12),
                  Opacity(
                    opacity: allBack ? 0.5 : 1,
                    child: Text(money(context, line.total),
                        style: theme.type.body.copyWith(fontWeight: FontWeight.w500, fontFeatures: tabular)),
                  ),
                ],
              ),
            ),
          );
        }),
      ],
      divider,
      const SizedBox(height: 12),
      if (hasBreakdown) ...[
        sum(l10n.subtotal, money(context, ticket.subtotal)),
        if (ticket.discount > 0) sum(l10n.discount, '−${money(context, ticket.discount)}'),
        if (ticket.serviceCharge > 0) sum(l10n.serviceCharge(rateText(ticket.serviceChargeRate)), money(context, ticket.serviceCharge)),
        if (ticket.vat > 0 && !ticket.vatIncluded) sum(l10n.vat(rateText(ticket.vatRate)), money(context, ticket.vat)),
      ],
      Row(
        crossAxisAlignment: CrossAxisAlignment.baseline,
        textBaseline: TextBaseline.alphabetic,
        children: [
          Expanded(child: Text(l10n.total, style: theme.type.body)),
          Text(money(context, ticket.total), style: theme.type.figure),
        ],
      ),
      if (ticket.vat > 0 && ticket.vatIncluded) sum(l10n.vatIncluded(rateText(ticket.vatRate)), money(context, ticket.vat)),
      if (ticket.refundedTotal > 0)
        sum(l10n.refundedSoFar, '−${money(context, ticket.refundedTotal)}',
            style: theme.type.body.copyWith(fontWeight: FontWeight.w500, color: theme.colors.destructive)),

      // How it was paid; a Cash, Card or InstaPay payment recorded under the wrong one can be put
      // right, until a refund leans on it
      if (ticket.payments.isNotEmpty) ...[
        _label(l10n.payments),
        divider,
        for (final payment in ticket.payments) ...[
          ConstrainedBox(
            constraints: const BoxConstraints(minHeight: Sizes.control),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                            [tenderLabel(l10n, payment.tender), if ((payment.customerName ?? '').isNotEmpty) payment.customerName!]
                                .join(' · '),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: theme.type.body.copyWith(fontWeight: FontWeight.w500)),
                        if (payment.tenderChangedFrom != null)
                          Text(
                              l10n.tenderChangedFrom(
                                tenderLabel(l10n, payment.tenderChangedFrom!),
                                payment.tenderChangedBy ?? '',
                                payment.tenderChangedAt == null ? '' : formatDateTimeShort(context, payment.tenderChangedAt!),
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: theme.type.caption.copyWith(color: theme.colors.mutedForeground)),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Text(money(context, payment.amount),
                      style: theme.type.body.copyWith(fontWeight: FontWeight.w600, fontFeatures: tabular)),
                  if (!ticket.isVoided && ticket.refunds.isEmpty && payment.canChangeTender) ...[
                    const SizedBox(width: 12),
                    SizedBox(
                      height: Sizes.controlSmall,
                      child: FButton(
                        variant: FButtonVariant.outline,
                        mainAxisSize: MainAxisSize.min,
                        onPress: () => showChangeTenderDialog(context, ticket, payment),
                        child: Text(l10n.changeTenderAction, style: theme.type.buttonSmall),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
          divider,
        ],
        if (change > 0) sum(l10n.changeDue, money(context, change)),
      ],

      // Credit notes: money that went back, each with its reason
      if (ticket.refunds.isNotEmpty) ...[
        _label(l10n.refundsTitle),
        divider,
        for (final refund in ticket.refunds) ...[
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(l10n.creditNote(refund.number),
                          style: theme.type.body.copyWith(fontWeight: FontWeight.w500, fontFeatures: tabular)),
                    ),
                    Text('−${money(context, refund.amount)}',
                        style: theme.type.body.copyWith(
                            fontWeight: FontWeight.w600, color: theme.colors.destructive, fontFeatures: tabular)),
                  ],
                ),
                if (refund.reason.isNotEmpty) Text(refund.reason, style: theme.type.detail),
                Text(
                    [
                      refund.tender == PaymentTender.account ? l10n.account : l10n.cash,
                      if ((refund.customerName ?? '').isNotEmpty) refund.customerName!,
                      if (refund.refundedBy.isNotEmpty) refund.refundedBy,
                      if (refund.refundedAt != null) formatDateTimeShort(context, refund.refundedAt!),
                    ].join(' · '),
                    style: theme.type.caption.copyWith(color: theme.colors.mutedForeground, fontFeatures: tabular)),
              ],
            ),
          ),
          divider,
        ],
      ],
    ];
  }

  List<Widget> _refundBody(BuildContext context, TicketDetail ticket, List<RefundEntry> entries,
      List<RefundHolder> holders, RefundHolder? holder, double preview) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    const tabular = [FontFeature.tabularFigures()];
    final muted = theme.type.detail.copyWith(color: theme.colors.mutedForeground);
    final divider = Container(height: 1, color: theme.colors.border);
    // Back to a tab only where the business runs tabs, or a tab paid this bill (it can still be paid back)
    final offerAccount = ref.watch(featuresProvider.select((f) => f.tabs)) || holders.isNotEmpty;
    final all = everythingPicked(entries, _picked);
    final quick = [l10n.refundReasonWrongOrder, l10n.refundReasonUnhappy, l10n.refundReasonUnavailable];

    Widget choice(String text, {required bool picked, required VoidCallback? onPress, IconData? icon}) => SizedBox(
          height: Sizes.control,
          child: FButton(
            variant: picked ? null : FButtonVariant.outline,
            mainAxisSize: MainAxisSize.min,
            onPress: onPress,
            prefix: icon == null ? null : Icon(icon, size: Sizes.icon),
            child: Text(text, maxLines: 1, style: theme.type.button),
          ),
        );

    return [
      ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 56),
        child: Row(
          children: [
            Expanded(
              child: Text(l10n.refundHint(money(context, refundRemainder(ticket))),
                  style: theme.type.body.copyWith(color: theme.colors.mutedForeground)),
            ),
            SizedBox(
              height: Sizes.controlSmall,
              child: FButton(
                variant: FButtonVariant.outline,
                mainAxisSize: MainAxisSize.min,
                onPress: all || entries.isEmpty
                    ? null
                    : () => setState(() {
                          for (final entry in entries) {
                            _picked[entry.line.id] = entry.left;
                          }
                        }),
                child: Text(l10n.refundEverything, style: theme.type.buttonSmall),
              ),
            ),
          ],
        ),
      ),
      divider,
      if (entries.isEmpty)
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 40),
          child: Text(l10n.nothingLeftToRefund, textAlign: TextAlign.center, style: muted),
        )
      else
        for (final entry in entries) ...[
          ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 64),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(entry.line.description?.localized(context) ?? '',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: theme.type.body.copyWith(fontWeight: FontWeight.w500)),
                        Text('${l10n.leftToRefund(entry.left.round())} · ${money(context, entry.line.unitPrice)}',
                            style: muted.copyWith(fontFeatures: tabular)),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  SizedBox.square(
                    dimension: Sizes.controlSmall,
                    child: FButton.icon(
                      variant: FButtonVariant.outline,
                      onPress: (_picked[entry.line.id] ?? 0) <= 0
                          ? null
                          : () => setState(() => _picked[entry.line.id] =
                              ((_picked[entry.line.id] ?? 0) - refundStep(entry)).clamp(0, entry.left).toDouble()),
                      child: const Icon(FIcons.minus, size: Sizes.iconSmall),
                    ),
                  ),
                  SizedBox(
                    width: 44,
                    child: Text(_qty(_picked[entry.line.id] ?? 0),
                        textAlign: TextAlign.center, style: theme.type.heading.copyWith(fontFeatures: tabular)),
                  ),
                  SizedBox.square(
                    dimension: Sizes.controlSmall,
                    child: FButton.icon(
                      variant: FButtonVariant.outline,
                      onPress: (_picked[entry.line.id] ?? 0) >= entry.left
                          ? null
                          : () => setState(() => _picked[entry.line.id] =
                              ((_picked[entry.line.id] ?? 0) + refundStep(entry)).clamp(0, entry.left).toDouble()),
                      child: const Icon(FIcons.plus, size: Sizes.iconSmall),
                    ),
                  ),
                ],
              ),
            ),
          ),
          divider,
        ],

      // Why: mandatory, it is the audit trail. The usual ones are a tap; any other is typed
      _label(l10n.reason),
      Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          for (final why in quick)
            choice(why, picked: _reason.text == why, onPress: () => _reason.text = why),
        ],
      ),
      const SizedBox(height: 8),
      FTextField(
        control: FTextFieldControl.managed(controller: _reason),
        hint: l10n.refundReasonOther,
        maxLines: 1,
      ),

      // Where the money goes back: the drawer, or a tab that paid
      _label(l10n.refundGoesTo),
      Row(
        children: [
          Expanded(
            child: choice(l10n.cash,
                icon: FIcons.banknote,
                picked: _tender == PaymentTender.cash,
                onPress: () => setState(() => _tender = PaymentTender.cash)),
          ),
          if (offerAccount) ...[
            const SizedBox(width: 8),
            Expanded(
              child: choice(l10n.account,
                  icon: FIcons.user,
                  picked: _tender == PaymentTender.account,
                  onPress: holders.isEmpty ? null : () => setState(() => _tender = PaymentTender.account)),
            ),
          ],
        ],
      ),
      if (_tender == PaymentTender.account && holders.length > 1) ...[
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final h in holders)
              choice(h.name.isEmpty ? h.id : h.name,
                  picked: holder?.id == h.id, onPress: () => setState(() => _holderId = h.id)),
          ],
        ),
      ],
    ];
  }
}

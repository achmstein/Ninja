import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/models/localized_text.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import 'package:uuid/uuid.dart';
import '../../../core/auth/auth_service.dart';
import '../../../core/brand/brand_provider.dart';
import '../../../core/models/dates.dart';
import '../../../core/models/friendly_day.dart';
import '../../../core/models/money.dart';
import '../../../core/network/api_errors.dart';
import '../../../core/printing/print_service.dart';
import '../../../core/services/branch_names.dart';
import '../../../core/theme/type_roles.dart';
import '../../../core/utils/bidi.dart';
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
/// Its head says whose it is and, quietly, its number, when it closed and who
/// closed it. Under the head one band holds the money: what it came to, once,
/// and how it was paid, the way it was paid being a button that puts it right
/// (Cash pressed, InstaPay sent). Then what was on it, and what went back
/// since. Nothing is said twice: no second total, no list of payments
/// repeating the amount. And what is done to a closed bill is done here: it
/// is printed again, and an owner gives money back, the same pane turning to
/// the refund and back. The web till's ReceiptPreview is the same.
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

    final takenBy = (ticket.takenBy ?? '').isNotEmpty && ticket.takenAtBranchId != null
        ? l10n.takenByAt(
            ticket.takenBy!, branchNameOf(ref.watch(allBranchesProvider).value, ticket.takenAtBranchId, context))
        : null;
    final meta = [
      number == null ? l10n.ticketNumber(ticket.id) : l10n.receiptNumber(number),
      if (ticket.settledAt != null) _when(context, ticket.settledAt!),
      if ((ticket.settledBy ?? '').isNotEmpty) bidiIsolate(ticket.settledBy!),
      ?takenBy,
    ].join(' · ');

    // As tall as the list's head beside it (8 + 48 + 8) while the name fits one line, so the two rules under them meet
    final head = Container(
      constraints: const BoxConstraints(minHeight: Sizes.header + 1),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(border: Border(bottom: rule)),
      child: Row(
        children: _refunding
            ? [
                Expanded(
                  child: Text(l10n.refundTitle(number ?? 0),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.type.title.copyWith(fontFeatures: tabular)),
                ),
                const SizedBox(width: 12),
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
                ),
              ]
            : [
                Expanded(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Whose it is, whole: a long name wraps, it is never cut
                      Text(billTitleText(widget.title), style: theme.type.title),
                      Text(meta, style: muted.copyWith(fontFeatures: tabular)),
                    ],
                  ),
                ),
              ],
      ),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        head,
        if (!_refunding) _band(context, ticket, rule),
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
                            Text(bidiIsolate(line.customerName!), maxLines: 1, overflow: TextOverflow.ellipsis, style: muted),
                          if (line.discount > 0) Text('${l10n.discount} −${money(context, line.discount)}', style: muted),
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
      // How the total was made up, only when a discount, service or VAT is in it: the total itself is in the band above
      if (hasBreakdown || (ticket.vat > 0 && ticket.vatIncluded)) const SizedBox(height: 12),
      if (hasBreakdown) ...[
        sum(l10n.subtotal, money(context, ticket.subtotal)),
        if (ticket.discount > 0) sum(l10n.discount, '−${money(context, ticket.discount)}'),
        if (ticket.serviceCharge > 0) sum(l10n.serviceCharge(rateText(ticket.serviceChargeRate)), money(context, ticket.serviceCharge)),
        if (ticket.vat > 0 && !ticket.vatIncluded) sum(l10n.vat(rateText(ticket.vatRate)), money(context, ticket.vat)),
      ],
      if (ticket.vat > 0 && ticket.vatIncluded) sum(l10n.vatIncluded(rateText(ticket.vatRate)), money(context, ticket.vat)),

      // Credit notes: money that went back, each with its reason, behind a red rule
      for (final refund in ticket.refunds)
        Container(
          margin: const EdgeInsets.only(top: 16),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: theme.colors.destructive.withValues(alpha: 0.05),
            border: BorderDirectional(start: BorderSide(color: theme.colors.destructive, width: 3)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Text(
                        [l10n.creditNote(refund.number), if (refund.reason.isNotEmpty) bidiIsolate(refund.reason)].join(' · '),
                        style: theme.type.body.copyWith(fontWeight: FontWeight.w500, fontFeatures: tabular)),
                  ),
                  const SizedBox(width: 16),
                  Text('−${money(context, refund.amount)}',
                      style: theme.type.body.copyWith(
                          fontWeight: FontWeight.w600, color: theme.colors.destructive, fontFeatures: tabular)),
                ],
              ),
              Text(
                  [
                    refund.tender == PaymentTender.account ? l10n.account : l10n.cash,
                    if ((refund.customerName ?? '').isNotEmpty) bidiIsolate(refund.customerName!),
                    if (refund.refundedBy.isNotEmpty) bidiIsolate(refund.refundedBy),
                    if (refund.refundedAt != null) _when(context, refund.refundedAt!),
                  ].join(' · '),
                  style: theme.type.caption.copyWith(color: theme.colors.mutedForeground, fontFeatures: tabular)),
            ],
          ),
        ),
    ];
  }

  /// The day in words and the time: "Today 1:25 AM", never a full date on every line
  static String _when(BuildContext context, DateTime at) => '${friendlyDay(context, at)} ${formatTime(context, at)}';

  /// The money, once: what it came to, and how it was paid. One payment says
  /// only its way; several say who and how much each
  Widget _band(BuildContext context, TicketDetail ticket, BorderSide rule) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    const tabular = [FontFeature.tabularFigures()];
    final muted = theme.type.detail.copyWith(color: theme.colors.mutedForeground);
    final payments = ticket.payments;
    final single = payments.length == 1;
    final paid = payments.fold<double>(0, (sum, p) => sum + p.amount);
    final change = paid - ticket.total > 0 ? paid - ticket.total : 0.0;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: theme.colors.muted.withValues(alpha: 0.4),
        border: Border(bottom: rule),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                TypeLabel(l10n.total),
                Text(money(context, ticket.total), style: theme.type.figure),
                if (ticket.refundedTotal > 0)
                  Text('${l10n.refundedSoFar} −${money(context, ticket.refundedTotal)}',
                      style: theme.type.detail.copyWith(
                          fontWeight: FontWeight.w600, color: theme.colors.destructive, fontFeatures: tabular)),
              ],
            ),
          ),
          if (payments.isNotEmpty) ...[
            const SizedBox(width: 16),
            ConstrainedBox(
              constraints: const BoxConstraints(minWidth: 256, maxWidth: 360),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  for (final (index, payment) in payments.indexed) ...[
                    if (index > 0) const SizedBox(height: 6),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Flexible(
                          child: Text(single ? l10n.paidTag : bidiIsolate(payment.customerName ?? ''),
                              maxLines: 1, overflow: TextOverflow.ellipsis, style: muted),
                        ),
                        const SizedBox(width: 12),
                        if (!single) ...[
                          Text(money(context, payment.amount),
                              style: theme.type.body.copyWith(fontWeight: FontWeight.w600, fontFeatures: tabular)),
                          const SizedBox(width: 12),
                        ],
                        // A cash, card or InstaPay payment can be put right, until money has gone back against the bill
                        if (!ticket.isVoided && ticket.refunds.isEmpty && payment.canChangeTender)
                          SizedBox(
                            height: 44,
                            child: Semantics(
                              label: '${tenderLabel(l10n, payment.tender)}: ${l10n.changeTenderAction}',
                              excludeSemantics: true,
                              child: FButton(
                                variant: FButtonVariant.outline,
                                mainAxisSize: MainAxisSize.min,
                                onPress: () => showChangeTenderDialog(context, ticket, payment),
                                suffix: Icon(FIcons.chevronDown, size: Sizes.iconSmall, color: theme.colors.mutedForeground),
                                child: Text(tenderLabel(l10n, payment.tender),
                                    style: theme.type.button.copyWith(fontWeight: FontWeight.w600)),
                              ),
                            ),
                          )
                        else
                          Text(tenderLabel(l10n, payment.tender),
                              style: theme.type.body.copyWith(fontWeight: FontWeight.w600)),
                      ],
                    ),
                    // Who changed it and when is the back office's to read; here, only that it was changed
                    if (payment.tenderChangedFrom != null)
                      Text(l10n.tenderWas(tenderLabel(l10n, payment.tenderChangedFrom!)),
                          style: theme.type.caption.copyWith(color: theme.colors.mutedForeground)),
                  ],
                  if (change > 0) ...[
                    const SizedBox(height: 6),
                    Text('${l10n.changeDue} ${money(context, change)}', style: muted.copyWith(fontFeatures: tabular)),
                  ],
                ],
              ),
            ),
          ],
        ],
      ),
    );
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
        // Picked as lines are picked on an order: a tap ticks the row, and all that is left of it
        // comes back. A row with more than one shows its count once ticked, to give back fewer
        for (final entry in entries) ...[
          Builder(builder: (context) {
            final count = _picked[entry.line.id] ?? 0;
            final picked = count > 0;
            final several = entry.left > 1 || entry.left != entry.left.roundToDouble();
            void set(double value) => setState(() => _picked[entry.line.id] = value.clamp(0, entry.left).toDouble());
            return Container(
              constraints: const BoxConstraints(minHeight: 64),
              color: picked ? theme.colors.secondary : null,
              child: Row(
                children: [
                  Expanded(
                    child: Semantics(
                      checked: picked,
                      child: FTappable(
                        onPress: _pending ? null : () => set(picked ? 0 : entry.left),
                        child: Padding(
                          padding: const EdgeInsets.all(8),
                          child: Row(
                            children: [
                              Container(
                                width: 24,
                                height: 24,
                                decoration: BoxDecoration(
                                  color: picked ? theme.colors.primary : null,
                                  borderRadius: BorderRadius.circular(6),
                                  border: Border.all(
                                    color: picked
                                        ? theme.colors.primary
                                        : theme.colors.mutedForeground.withValues(alpha: 0.5),
                                  ),
                                ),
                                child: picked
                                    ? Icon(FIcons.check, size: Sizes.iconSmall, color: theme.colors.primaryForeground)
                                    : null,
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Text(entry.line.description?.localized(context) ?? '',
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: theme.type.body.copyWith(fontWeight: FontWeight.w500)),
                                    Text(
                                        '${l10n.leftToRefund(entry.left.round())} · ${money(context, entry.line.unitPrice)}',
                                        style: muted.copyWith(fontFeatures: tabular)),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                  if (picked && several) ...[
                    SizedBox.square(
                      dimension: 44,
                      child: FButton.icon(
                        variant: FButtonVariant.outline,
                        onPress: _pending ? null : () => set(count - refundStep(entry)),
                        child: const Icon(FIcons.minus, size: Sizes.iconSmall),
                      ),
                    ),
                    SizedBox(
                      width: 44,
                      child: Text(_qty(count),
                          textAlign: TextAlign.center, style: theme.type.body.copyWith(fontWeight: FontWeight.w600, fontFeatures: tabular)),
                    ),
                    SizedBox.square(
                      dimension: 44,
                      child: FButton.icon(
                        variant: FButtonVariant.outline,
                        onPress: _pending || count >= entry.left ? null : () => set(count + refundStep(entry)),
                        child: const Icon(FIcons.plus, size: Sizes.iconSmall),
                      ),
                    ),
                    const SizedBox(width: 8),
                  ],
                ],
              ),
            );
          }),
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

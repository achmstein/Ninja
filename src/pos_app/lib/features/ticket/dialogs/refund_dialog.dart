import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:uuid/uuid.dart';
import '../../../core/models/localized_text.dart';
import '../../../core/models/money.dart';
import '../../../core/network/api_errors.dart';
import '../../../core/theme/text_styles.dart';
import '../../../core/widgets/pos_toast.dart';
import '../../../core/widgets/pos_dialog.dart';
import '../../../l10n/app_localizations.dart';
import '../../shifts/providers/shifts_provider.dart';
import '../../tickets/models/enums.dart';
import '../../tickets/models/refund.dart';
import '../../tickets/models/ticket_detail.dart';
import '../../tickets/providers/tickets_provider.dart';
import '../../tickets/services/tickets_service.dart';

/// Owner-only: issues a credit note against a settled ticket. Lines are
/// picked by quantity — what is left of each after earlier credit notes —
/// and each gives back what the customer paid for it, service and VAT
/// included; the preview mirrors the server's arithmetic, the server's
/// answer is the one printed. Cash comes out of the drawer; a tab that paid
/// can be credited instead. The reason is mandatory: it is the audit trail.
Future<RefundResult?> showRefundDialog(BuildContext context, TicketDetail ticket) {
  return showPosDialog<RefundResult>(
    context,
    builder: (context) => _RefundDialog(ticket: ticket),
  );
}

class _Holder {
  final String id;
  final String name;
  const _Holder(this.id, this.name);
}

class _Entry {
  final TicketLineView line;
  final double left;
  const _Entry(this.line, this.left);
}

class _RefundDialog extends ConsumerStatefulWidget {
  final TicketDetail ticket;
  const _RefundDialog({required this.ticket});

  @override
  ConsumerState<_RefundDialog> createState() => _RefundDialogState();
}

class _RefundDialogState extends ConsumerState<_RefundDialog> {
  final Map<int, double> _picked = {};
  final _reason = TextEditingController();
  PaymentTender _tender = PaymentTender.cash;
  String? _holderId;
  bool _pending = false;
  final String _requestId = const Uuid().v4();

  late final List<_Entry> _entries;
  late final List<_Holder> _holders;

  TicketDetail get ticket => widget.ticket;

  @override
  void initState() {
    super.initState();
    _reason.addListener(() => setState(() {}));
    // What earlier credit notes already took, per line
    final refundedQty = <int, double>{};
    for (final refund in ticket.refunds) {
      for (final line in refund.lines) {
        refundedQty[line.ticketLineId] = (refundedQty[line.ticketLineId] ?? 0) + line.qty;
      }
    }
    // Discount lines cannot come back on their own; everything else can, up
    // to what is left of it
    _entries = [
      for (final line in ticket.lines)
        if (line.total > 0)
          if (line.qty - (refundedQty[line.id] ?? 0) > 0) _Entry(line, line.qty - (refundedQty[line.id] ?? 0)),
    ];
    // Tabs that paid this ticket are the only ones a refund can go back onto
    final holders = <_Holder>[];
    for (final payment in ticket.payments) {
      final id = payment.customerId;
      if (payment.tender == PaymentTender.account && id != null && id.isNotEmpty && !holders.any((h) => h.id == id)) {
        holders.add(_Holder(id, payment.customerName ?? ''));
      }
    }
    _holders = holders;
  }

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  double get _remainder => (ticket.total - ticket.refundedTotal).clamp(0, double.infinity);

  bool get _everythingPicked => _entries.isNotEmpty && _entries.every((e) => (_picked[e.line.id] ?? 0) >= e.left);

  /// The server's arithmetic: each line gives back what was paid for it,
  /// service and VAT included; the whole bill gives back the remainder
  double get _preview {
    if (_everythingPicked) return _remainder;
    final paidPerMenuPound = ticket.subtotal > 0 ? ticket.total / ticket.subtotal : 1.0;
    var sum = 0.0;
    for (final entry in _entries) {
      final picked = _picked[entry.line.id] ?? 0;
      if (picked <= 0) continue;
      final menu = entry.line.total * picked / entry.line.qty;
      sum += (menu * paidPerMenuPound * 100).round() / 100;
    }
    return sum;
  }

  _Holder? get _holder => _holders.where((h) => h.id == _holderId).firstOrNull ?? _holders.firstOrNull;

  bool get _canRefund =>
      _preview > 0 && _reason.text.trim().isNotEmpty && (_tender == PaymentTender.cash || _holder != null) && !_pending;

  void _setQty(_Entry entry, double next) =>
      setState(() => _picked[entry.line.id] = next.clamp(0, entry.left));

  Future<void> _submit() async {
    if (!_canRefund) return;
    final l10n = AppLocalizations.of(context)!;
    final onAccount = _tender == PaymentTender.account;
    setState(() => _pending = true);
    try {
      final result = await ref.read(ticketsRepositoryProvider).refund(
            ticket.id,
            RefundRequest(
              lines: [
                for (final entry in _entries)
                  if ((_picked[entry.line.id] ?? 0) > 0) RefundLineRequest(lineId: entry.line.id, qty: _picked[entry.line.id]!),
              ],
              reason: _reason.text.trim(),
              tender: onAccount ? PaymentTender.account : PaymentTender.cash,
              customerId: onAccount ? _holder?.id : null,
              customerName: onAccount ? _holder?.name : null,
            ),
            requestId: _requestId,
          );
      ref.invalidate(ticketProvider(ticket.id));
      ref.read(openTicketsProvider.notifier).refresh();
      ref.read(currentShiftProvider.notifier).refresh();
      if (!mounted) return;
      showPosToast(context, PosToastType.success, l10n.ticketRefunded(money(context, result.amount), result.number));
      Navigator.of(context, rootNavigator: true).pop(result);
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
    const tabular = [FontFeature.tabularFigures()];
    final muted = theme.typography.sm.copyWith(color: theme.colors.mutedForeground);

    return ConstrainedBox(
      constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.95),
      child: DialogScroll(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(l10n.refundTitle(ticket.receiptNumber ?? 0), style: theme.typography.xl.copyWith(fontWeight: FontWeight.w600)),
            const SizedBox(height: 4),
            Text(l10n.refundHint(money(context, _remainder)),
                style: theme.typography.base.copyWith(color: theme.colors.mutedForeground)),
            const SizedBox(height: 16),
            if (_entries.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 24),
                child: Text(l10n.nothingLeftToRefund, textAlign: TextAlign.center, style: muted),
              )
            else ...[
              for (final (index, entry) in _entries.indexed) ...[
                if (index > 0) const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    border: Border.all(color: theme.colors.border),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(entry.line.description?.localized(context) ?? '',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: theme.typography.base.copyWith(fontWeight: FontWeight.w500)),
                            Text('${l10n.leftToRefund(entry.left.round())} · ${money(context, entry.line.unitPrice)}',
                                style: muted.copyWith(fontFeatures: tabular)),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      SizedBox.square(
                        dimension: 44,
                        child: FButton.icon(
                          variant: FButtonVariant.outline,
                          onPress: (_picked[entry.line.id] ?? 0) <= 0 ? null : () => _setQty(entry, (_picked[entry.line.id] ?? 0) - 1),
                          child: const Icon(FIcons.minus, size: 16),
                        ),
                      ),
                      SizedBox(
                        width: 36,
                        child: Text('${(_picked[entry.line.id] ?? 0).round()}',
                            textAlign: TextAlign.center,
                            style: theme.typography.lg.copyWith(fontWeight: FontWeight.w600, fontFeatures: tabular)),
                      ),
                      SizedBox.square(
                        dimension: 44,
                        child: FButton.icon(
                          variant: FButtonVariant.outline,
                          onPress: (_picked[entry.line.id] ?? 0) >= entry.left ? null : () => _setQty(entry, (_picked[entry.line.id] ?? 0) + 1),
                          child: const Icon(FIcons.plus, size: 16),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 8),
              Align(
                alignment: AlignmentDirectional.centerEnd,
                child: SizedBox(
                  height: 44,
                  child: FButton(
                    variant: FButtonVariant.ghost,
                    mainAxisSize: MainAxisSize.min,
                    onPress: _everythingPicked
                        ? null
                        : () => setState(() {
                              for (final entry in _entries) {
                                _picked[entry.line.id] = entry.left;
                              }
                            }),
                    child: Text(l10n.refundEverything, style: theme.typography.base.forButton),
                  ),
                ),
              ),
            ],
            const SizedBox(height: 16),
            FTextField(
              control: FTextFieldControl.managed(controller: _reason),
              label: Text(l10n.reason),
              maxLines: 1,
            ),
            const SizedBox(height: 16),
            // Where the money goes back: the drawer, or a tab that paid
            Row(
              children: [
                Expanded(
                  child: SizedBox(
                    height: 48,
                    child: FButton(
                      variant: _tender == PaymentTender.cash ? null : FButtonVariant.outline,
                      onPress: () => setState(() => _tender = PaymentTender.cash),
                      prefix: const Icon(FIcons.banknote, size: 20),
                      child: Text(l10n.cash, style: theme.typography.base.forButton),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: SizedBox(
                    height: 48,
                    child: FButton(
                      variant: _tender == PaymentTender.account ? null : FButtonVariant.outline,
                      onPress: _holders.isEmpty ? null : () => setState(() => _tender = PaymentTender.account),
                      prefix: const Icon(FIcons.user, size: 20),
                      child: Text(l10n.account, style: theme.typography.base.forButton),
                    ),
                  ),
                ),
              ],
            ),
            if (_tender == PaymentTender.account && _holders.length > 1) ...[
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final h in _holders)
                    SizedBox(
                      height: 40,
                      child: FButton(
                        variant: _holder?.id == h.id ? null : FButtonVariant.outline,
                        mainAxisSize: MainAxisSize.min,
                        onPress: () => setState(() => _holderId = h.id),
                        child: Text(h.name.isEmpty ? h.id : h.name, style: theme.typography.sm.forButton),
                      ),
                    ),
                ],
              ),
            ],
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                SizedBox(
                  height: 48,
                  child: FButton(
                    variant: FButtonVariant.outline,
                    mainAxisSize: MainAxisSize.min,
                    onPress: _pending ? null : () => Navigator.of(context, rootNavigator: true).pop(),
                    child: Text(l10n.cancel, style: theme.typography.base.forButton),
                  ),
                ),
                const SizedBox(width: 8),
                SizedBox(
                  height: 48,
                  child: FButton(
                    variant: FButtonVariant.destructive,
                    mainAxisSize: MainAxisSize.min,
                    onPress: _canRefund ? _submit : null,
                    prefix: _pending ? const SizedBox.square(dimension: 20, child: CircularProgressIndicator(strokeWidth: 2)) : null,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                      child: Text(l10n.confirmRefund(money(context, _preview)), style: theme.typography.base.forButton),
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

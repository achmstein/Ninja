import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/models/localized_text.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import 'package:uuid/uuid.dart';
import '../../../core/models/money.dart';
import '../../../core/network/api_errors.dart';
import '../../../core/theme/type_roles.dart';
import '../../../core/widgets/pos_dialog.dart';
import '../../../core/widgets/pos_toast.dart';
import '../../../core/widgets/stock_disposition_choice.dart';
import '../../../l10n/app_localizations.dart';
import '../../orders/models/stock_disposition.dart';
import '../../tickets/models/ticket_detail.dart';
import '../../tickets/providers/tickets_provider.dart';
import '../../tickets/services/tickets_service.dart';
import '../cancelled_line.dart';

/// Owner-only, as a void is: items of an open bill the kitchen already has,
/// cancelled without voiding the bill. A picked line of more than one says
/// how many of it go (all of it to start with); the reason is mandatory, the
/// audit trail, the usual ones a tap and any other typed; and items from an
/// order say what became of the food: made, so waste, or not, so back to
/// stock. The action names what comes off the bill. Resolves to true once
/// cancelled. The web till's cancel dialog is the same.
Future<bool> showCancelLinesDialog(BuildContext context, TicketDetail ticket, Set<int> lineIds) async {
  final lines = [for (final line in ticket.lines) if (lineIds.contains(line.id) && line.cancellable) line];
  if (lines.isEmpty) return false;
  final cancelled = await showPosDialog<bool>(
    context,
    size: DialogSize.lg,
    builder: (context) => CancelLinesDialog(ticket: ticket, lines: lines),
  );
  return cancelled ?? false;
}

class CancelLinesDialog extends ConsumerStatefulWidget {
  final TicketDetail ticket;

  /// The picked lines, each with some of it left to cancel
  final List<TicketLineView> lines;

  const CancelLinesDialog({super.key, required this.ticket, required this.lines});

  @override
  ConsumerState<CancelLinesDialog> createState() => _CancelLinesDialogState();
}

class _CancelLinesDialogState extends ConsumerState<CancelLinesDialog> {
  final _reason = TextEditingController();
  final String _requestId = const Uuid().v4();
  bool _pending = false;

  /// How many of each line go; all of it until the stepper says otherwise
  late final Map<int, double> _counts = {for (final line in widget.lines) line.id: line.qty};

  /// Made, so waste, unless the cashier says it never was
  StockDisposition _disposition = StockDisposition.waste;

  /// Only an order's items took stock; items rung up by hand say nothing of it
  bool get _hasFood => widget.lines.any((line) => line.orderId != null);

  int get _items => _counts.values.fold<double>(0, (sum, n) => sum + n).round();

  /// What comes off the bill: each line's own price, its discount shared over its count
  double get _amount => widget.lines.fold(0, (sum, line) => sum + line.total / line.qty * (_counts[line.id] ?? 0));

  bool get _everything => cancelsEverything(widget.ticket.lines, _counts);

  bool get _canCancel => _reason.text.trim().isNotEmpty && _items > 0 && !_everything && !_pending;

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

  void _setCount(TicketLineView line, double next) => setState(() => _counts[line.id] = next.clamp(1, line.qty));

  void _pickReason(String reason) {
    _reason.value = TextEditingValue(text: reason, selection: TextSelection.collapsed(offset: reason.length));
  }

  Future<void> _cancel() async {
    if (!_canCancel) return;
    final l10n = AppLocalizations.of(context)!;
    setState(() => _pending = true);
    try {
      await ref.read(ticketsRepositoryProvider).cancelLines(
            widget.ticket.id,
            CancelLinesRequest(
              lines: [
                for (final line in widget.lines) CancelLineRequest(lineId: line.id, qty: _counts[line.id] ?? line.qty),
              ],
              reason: _reason.text.trim(),
              stockDisposition: _hasFood ? _disposition.wire : null,
            ),
            requestId: _requestId,
          );
      ref.invalidate(ticketProvider(widget.ticket.id));
      unawaited(ref.read(openTicketsProvider.notifier).refresh());
      if (!mounted) return;
      showPosToast(context, PosToastType.success, l10n.itemsCancelled);
      Navigator.of(context, rootNavigator: true).pop(true);
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
    final muted = theme.type.detail.copyWith(color: theme.colors.mutedForeground);
    final reasons = [
      l10n.cancelReasonChangedMind,
      l10n.cancelReasonMistake,
      l10n.cancelReasonRanOut,
      l10n.cancelReasonTooLong,
    ];
    final typed = _reason.text.trim();

    return ConstrainedBox(
      constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.95),
      child: DialogScroll(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(l10n.cancelItemsAction(_items), style: theme.type.title),
            const SizedBox(height: 4),
            Text(l10n.cancelItemsHint, style: theme.type.body.copyWith(color: theme.colors.mutedForeground)),
            const SizedBox(height: 16),
            // What goes: a line of more than one says how many of it
            Container(
              decoration: BoxDecoration(
                border: Border.all(color: theme.colors.border),
                borderRadius: BorderRadius.circular(Sizes.radiusCard),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (final (index, line) in widget.lines.indexed) ...[
                    if (index > 0) Container(height: 1, color: theme.colors.border),
                    _CancelRow(
                      line: line,
                      count: _counts[line.id] ?? line.qty,
                      onCount: _pending ? null : (next) => _setCount(line, next),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 16),
            // Why: mandatory, it is the audit trail. The usual ones are a tap; any other is typed
            TypeLabel(l10n.reason),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final why in reasons)
                  ConstrainedBox(
                    constraints: const BoxConstraints(minHeight: Sizes.controlSmall),
                    child: FButton(
                      variant: typed == why ? null : FButtonVariant.outline,
                      mainAxisSize: MainAxisSize.min,
                      onPress: _pending ? null : () => _pickReason(why),
                      child: Text(why, style: theme.type.buttonSmall),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            FTextField(
              control: FTextFieldControl.managed(controller: _reason),
              hint: l10n.cancelOtherReason,
              maxLines: 1,
              textInputAction: TextInputAction.done,
              onSubmit: (_) => _cancel(),
            ),
            if (_hasFood) ...[
              const SizedBox(height: 16),
              StockDispositionChoice(
                value: _disposition,
                onChanged: (v) => setState(() => _disposition = v),
                enabled: !_pending,
              ),
            ],
            // Everything left on the bill is the bill: that is a void, not this
            if (_everything) ...[
              const SizedBox(height: 12),
              Text(l10n.cancelEverythingHint, style: muted.copyWith(color: theme.colors.destructive)),
            ],
            const SizedBox(height: 16),
            // The action keeps its whole label, with the money in it, as a refund's does
            Builder(builder: (context) {
              final back = SizedBox(
                height: Sizes.control,
                child: FButton(
                  variant: FButtonVariant.outline,
                  mainAxisSize: MainAxisSize.min,
                  onPress: _pending ? null : () => Navigator.of(context, rootNavigator: true).pop(false),
                  child: Text(l10n.goBack, style: theme.type.button),
                ),
              );
              final cancel = SizedBox(
                height: Sizes.control,
                child: FButton(
                  variant: FButtonVariant.destructive,
                  onPress: _canCancel ? _cancel : null,
                  prefix: _pending
                      ? const SizedBox.square(dimension: Sizes.icon, child: CircularProgressIndicator(strokeWidth: 2))
                      : null,
                  child: Flexible(
                    child: Text(l10n.cancelItemsConfirm(_items, money(context, _amount)),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: theme.type.button.copyWith(fontFeatures: tabular)),
                  ),
                ),
              );
              if (MediaQuery.sizeOf(context).width < 640) return DialogActions(children: [back, cancel]);
              return Row(children: [back, const SizedBox(width: 8), Expanded(child: cancel)]);
            }),
          ],
        ),
      ),
    );
  }
}

/// One picked line: its name, how many of it go, and what that comes to
class _CancelRow extends StatelessWidget {
  final TicketLineView line;
  final double count;

  /// The stepper's tap; null while the cancel is on its way
  final ValueChanged<double>? onCount;

  const _CancelRow({required this.line, required this.count, required this.onCount});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    const tabular = [FontFeature.tabularFigures()];
    final details = line.details?.localized(context) ?? '';
    final onCount = this.onCount;
    return Container(
      constraints: const BoxConstraints(minHeight: Sizes.control),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(line.description?.localized(context) ?? '',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.type.body.copyWith(fontWeight: FontWeight.w500)),
                if (details.isNotEmpty)
                  Text(details,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.type.caption.copyWith(color: theme.colors.mutedForeground)),
              ],
            ),
          ),
          const SizedBox(width: 12),
          if (line.qty > 1) ...[
            Semantics(
              label: l10n.cancelOneLess,
              child: SizedBox.square(
                dimension: Sizes.controlSmall,
                child: FButton.icon(
                  variant: FButtonVariant.outline,
                  onPress: onCount == null || count <= 1 ? null : () => onCount(count - 1),
                  child: const Icon(FIcons.minus, size: Sizes.iconSmall),
                ),
              ),
            ),
            SizedBox(
              width: 64,
              child: Text(l10n.cancelCountOf(qtyText(count), qtyText(line.qty)),
                  textAlign: TextAlign.center,
                  maxLines: 1,
                  style: theme.type.detail.copyWith(fontWeight: FontWeight.w600, fontFeatures: tabular)),
            ),
            Semantics(
              label: l10n.cancelOneMore,
              child: SizedBox.square(
                dimension: Sizes.controlSmall,
                child: FButton.icon(
                  variant: FButtonVariant.outline,
                  onPress: onCount == null || count >= line.qty ? null : () => onCount(count + 1),
                  child: const Icon(FIcons.plus, size: Sizes.iconSmall),
                ),
              ),
            ),
          ] else
            Text('${qtyText(line.qty)}×',
                style: theme.type.detail.copyWith(color: theme.colors.mutedForeground, fontFeatures: tabular)),
          const SizedBox(width: 12),
          ConstrainedBox(
            constraints: const BoxConstraints(minWidth: 72),
            child: Text(money(context, line.total / line.qty * count),
                textAlign: TextAlign.end,
                style: theme.type.detail.copyWith(fontWeight: FontWeight.w500, fontFeatures: tabular)),
          ),
        ],
      ),
    );
  }
}

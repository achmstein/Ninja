import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/theme/text_styles.dart';
import '../../features/orders/models/stock_disposition.dart';
import '../../l10n/app_localizations.dart';
import 'pos_dialog.dart';

/// "Was the food made?" when the till cancels or voids an order that took its
/// ingredients: waste it, or back to stock. Two cards side by side (mirrored
/// in Arabic by the row itself), each a radio to a screen reader and to the
/// keyboard: Enter or Space picks the focused one.
class StockDispositionChoice extends StatelessWidget {
  final StockDisposition value;
  final ValueChanged<StockDisposition> onChanged;
  final bool enabled;

  const StockDispositionChoice({super.key, required this.value, required this.onChanged, this.enabled = true});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Semantics(
          header: true,
          child: Text(l10n.stockWasMade, style: theme.typography.sm.copyWith(fontWeight: FontWeight.w600)),
        ),
        const SizedBox(height: 8),
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                child: _Option(
                  icon: FIcons.trash2,
                  label: l10n.stockWaste,
                  hint: l10n.stockWasteHint,
                  selected: value == StockDisposition.waste,
                  onPick: enabled ? () => onChanged(StockDisposition.waste) : null,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _Option(
                  icon: FIcons.packageCheck,
                  label: l10n.stockRestock,
                  hint: l10n.stockRestockHint,
                  selected: value == StockDisposition.restock,
                  onPick: enabled ? () => onChanged(StockDisposition.restock) : null,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _Option extends StatelessWidget {
  final IconData icon;
  final String label;
  final String hint;
  final bool selected;
  final VoidCallback? onPick;

  const _Option({required this.icon, required this.label, required this.hint, required this.selected, required this.onPick});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final colors = theme.colors;
    return MergeSemantics(
      child: Semantics(
        inMutuallyExclusiveGroup: true,
        checked: selected,
        enabled: onPick != null,
        onTap: onPick,
        child: FocusableActionDetector(
          enabled: onPick != null,
          mouseCursor: onPick != null ? SystemMouseCursors.click : SystemMouseCursors.basic,
          actions: {ActivateIntent: CallbackAction<ActivateIntent>(onInvoke: (_) => onPick?.call())},
          child: Builder(
            builder: (context) {
              final focused = Focus.of(context).hasFocus;
              return GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: onPick,
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: selected ? colors.primary.withValues(alpha: 0.06) : null,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: selected || focused ? colors.primary : colors.border,
                      width: selected || focused ? 2 : 1,
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(selected ? FIcons.circleCheck : FIcons.circle, size: 18, color: selected ? colors.primary : colors.mutedForeground),
                          const SizedBox(width: 8),
                          Icon(icon, size: 18, color: colors.foreground),
                          const SizedBox(width: 6),
                          Expanded(child: Text(label, style: theme.typography.base.copyWith(fontWeight: FontWeight.w600))),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(hint, style: theme.typography.xs.copyWith(color: colors.mutedForeground)),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}

/// A cancel that lets a confirmed order's food go: the question, the choice,
/// and the action. Resolves to what the cashier confirmed, or null when they
/// stepped back.
Future<StockDisposition?> showStockDispositionDialog(
  BuildContext context, {
  required String title,
  required String actionLabel,
  required StockDisposition initial,
}) =>
    showPosDialog<StockDisposition>(
      context,
      builder: (_) => _StockDispositionDialog(title: title, actionLabel: actionLabel, initial: initial),
    );

class _StockDispositionDialog extends StatefulWidget {
  final String title;
  final String actionLabel;
  final StockDisposition initial;

  const _StockDispositionDialog({required this.title, required this.actionLabel, required this.initial});

  @override
  State<_StockDispositionDialog> createState() => _StockDispositionDialogState();
}

class _StockDispositionDialogState extends State<_StockDispositionDialog> {
  late StockDisposition _value = widget.initial;

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    return DialogScroll(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(widget.title, style: theme.typography.xl.copyWith(fontWeight: FontWeight.w600)),
          const SizedBox(height: 16),
          StockDispositionChoice(value: _value, onChanged: (v) => setState(() => _value = v)),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              SizedBox(
                height: 48,
                child: FButton(
                  variant: FButtonVariant.outline,
                  mainAxisSize: MainAxisSize.min,
                  onPress: () => Navigator.of(context, rootNavigator: true).pop(),
                  child: Text(l10n.cancel, style: theme.typography.base.forButton),
                ),
              ),
              const SizedBox(width: 8),
              SizedBox(
                height: 48,
                child: FButton(
                  variant: FButtonVariant.destructive,
                  mainAxisSize: MainAxisSize.min,
                  onPress: () => Navigator.of(context, rootNavigator: true).pop(_value),
                  child: Text(widget.actionLabel, style: theme.typography.base.forButton),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

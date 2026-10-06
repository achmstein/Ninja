import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/theme/app_theme.dart';
import 'package:ninja_app_core/theme/text_styles.dart';
import '../../../core/models/money.dart';
import '../../../core/utils/bidi.dart';
import '../../../core/widgets/pos_dialog.dart';
import '../../../l10n/app_localizations.dart';
import '../../shifts/widgets/amount_entry.dart';
import '../models/delivery_board.dart';
import '../models/delivery_order.dart';

/// A rider back at the till with the cash for their deliveries: every one
/// still owing is listed and ticked, the cashier counts the cash on the
/// keypad (it starts at what the ticked bills come to), and one tap takes it
/// all in. A delivery the rider is not settling now is unticked. When the
/// count is off, the difference is said and put on the delivery the cashier
/// picks. Resolves to each ticked delivery's amount, or null.
Future<Map<int, double>?> showRiderCashDialog(BuildContext context, {required RiderGroup rider}) =>
    showPosDialog<Map<int, double>>(context, maxWidth: 760, builder: (_) => RiderCashDialog(rider: rider));

class RiderCashDialog extends StatefulWidget {
  final RiderGroup rider;

  const RiderCashDialog({super.key, required this.rider});

  @override
  State<RiderCashDialog> createState() => _RiderCashDialogState();
}

class _RiderCashDialogState extends State<RiderCashDialog> {
  late final Set<int> _ticked = {for (final o in widget.rider.orders) o.orderNumber};
  late String _counted = _plain(_expected);

  /// The cashier typed a count: ticking no longer rewrites it
  bool _edited = false;
  int? _differenceOn;

  List<DeliveryOrder> get _tickedOrders => [for (final o in widget.rider.orders) if (_ticked.contains(o.orderNumber)) o];

  double get _expected => _tickedOrders.fold(0.0, (sum, o) => sum + o.total);

  /// What the keypad shows for an amount: no trailing ".00"
  static String _plain(double v) {
    final fixed = v.toStringAsFixed(2);
    return fixed.endsWith('.00') ? fixed.substring(0, fixed.length - 3) : fixed;
  }

  void _toggle(int orderNumber) => setState(() {
        if (!_ticked.remove(orderNumber)) _ticked.add(orderNumber);
        if (!_edited) _counted = _plain(_expected);
        if (_differenceOn != null && !_ticked.contains(_differenceOn)) _differenceOn = null;
      });

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final name = widget.rider.riderName ?? l10n.deliveryNoRider;
    final ticked = _tickedOrders;
    final expected = _expected;
    final counted = double.tryParse(_counted);
    final difference = counted == null ? null : counted - expected;
    final off = difference != null && difference.abs() >= 0.005;
    final amber = AppColors.amber(theme.colors.brightness);
    final (note, noteColor) = switch (difference) {
      null => (l10n.deliveryCashInvalid, theme.colors.destructive),
      final d when d.abs() < 0.005 => (l10n.deliveryCashExact, AppColors.emerald(theme.colors.brightness)),
      final d when d < 0 => (l10n.deliveryCashShort(money(context, -d)), amber),
      final d => (l10n.deliveryCashOver(money(context, d)), amber),
    };
    final differenceOn = _differenceOn ?? ticked.lastOrNull?.orderNumber;
    final canTake = ticked.isNotEmpty && counted != null && counted >= 0;

    final list = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final order in widget.rider.orders)
          _OrderRow(
            order: order,
            ticked: _ticked.contains(order.orderNumber),
            onTap: () => _toggle(order.orderNumber),
          ),
        if (ticked.isEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(l10n.riderCashNoneTicked, style: theme.typography.sm.copyWith(color: theme.colors.destructive)),
          ),
        // Off by something: which bill carries it (a short one stays open at the till)
        if (off && ticked.length > 1) ...[
          const SizedBox(height: 12),
          Text(l10n.riderCashDifferenceOn, style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground)),
          const SizedBox(height: 6),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final order in ticked)
                SizedBox(
                  height: 40,
                  child: FButton(
                    variant: order.orderNumber == differenceOn ? null : FButtonVariant.outline,
                    mainAxisSize: MainAxisSize.min,
                    onPress: () => setState(() => _differenceOn = order.orderNumber),
                    child: Text(bidiIsolate('#${order.orderNumber}'), style: theme.typography.sm.forButton),
                  ),
                ),
            ],
          ),
        ],
      ],
    );

    final count = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AmountEntry(
          label: l10n.deliveryCashCounted,
          value: _counted,
          onChange: (v) => setState(() {
            _counted = v;
            _edited = true;
          }),
        ),
        const SizedBox(height: 8),
        // Said in words, never colour alone
        Text(note, style: theme.typography.sm.copyWith(fontWeight: FontWeight.w600, color: noteColor)),
      ],
    );

    return DialogScroll(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(l10n.deliveryCashCountTitle(name), style: theme.typography.xl.copyWith(fontWeight: FontWeight.w700)),
          const SizedBox(height: 4),
          Text(
            '${l10n.riderOrders(ticked.length)} · ${l10n.riderCashExpected(money(context, expected))}',
            style: theme.typography.base.copyWith(color: theme.colors.mutedForeground),
          ),
          const SizedBox(height: 16),
          // The list beside the keypad where the dialog is wide; under it on a narrow screen
          LayoutBuilder(
            builder: (context, constraints) => constraints.maxWidth >= 600
                ? Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(child: list),
                      const SizedBox(width: 24),
                      SizedBox(width: 300, child: count),
                    ],
                  )
                : Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [list, const SizedBox(height: 16), count]),
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              Expanded(
                child: SizedBox(
                  height: 52,
                  child: FButton(
                    variant: FButtonVariant.outline,
                    onPress: () => Navigator.of(context, rootNavigator: true).pop(),
                    child: Text(l10n.cancel, style: theme.typography.base.forButton),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                flex: 2,
                child: SizedBox(
                  height: 52,
                  child: FButton(
                    onPress: !canTake
                        ? null
                        : () => Navigator.of(context, rootNavigator: true).pop(splitCounted(ticked, counted, differenceOn: differenceOn)),
                    prefix: const Icon(FIcons.banknote, size: 20),
                    child: Text(l10n.riderCashTakeIn(money(context, counted ?? 0)), style: theme.typography.base.forButton),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// One delivery the rider owes cash for: ticked or not, whose, and how much
class _OrderRow extends StatelessWidget {
  final DeliveryOrder order;
  final bool ticked;
  final VoidCallback onTap;

  const _OrderRow({required this.order, required this.ticked, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final name = (order.customerName ?? '').isEmpty ? l10n.guest : order.customerName!;
    return Semantics(
      checked: ticked,
      label: '${l10n.orderNumber(order.orderNumber)}, $name, ${money(context, order.total)}',
      excludeSemantics: true,
      child: FTappable(
        onPress: onTap,
        child: Container(
          constraints: const BoxConstraints(minHeight: 56),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          margin: const EdgeInsets.only(bottom: 6),
          decoration: BoxDecoration(
            color: ticked ? theme.colors.secondary : null,
            border: Border.all(color: ticked ? theme.colors.foreground.withValues(alpha: 0.3) : theme.colors.border),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              Icon(ticked ? FIcons.squareCheck : FIcons.square, size: 22, color: ticked ? theme.colors.foreground : theme.colors.mutedForeground),
              const SizedBox(width: 12),
              Text(bidiIsolate('#${order.orderNumber}'), style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground)),
              const SizedBox(width: 8),
              Expanded(
                child: Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: theme.typography.base.copyWith(fontWeight: FontWeight.w500)),
              ),
              const SizedBox(width: 8),
              Text(
                money(context, order.total),
                style: theme.typography.base.copyWith(fontWeight: FontWeight.w600, fontFeatures: const [FontFeature.tabularFigures()]),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

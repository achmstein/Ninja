import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import '../../../core/config/app_config.dart';
import '../../../core/models/money.dart';
import 'package:ninja_app_core/theme/app_theme.dart';
import '../../../core/utils/bidi.dart';
import '../../../l10n/app_localizations.dart';
import '../../orders/status.dart';
import '../models/delivery_order.dart';
import 'delivery_details.dart';
import 'delivery_dialog.dart';

/// The board's clock: "since" times redraw on it while the board is on screen
/// (autoDispose: it stops ticking when nothing watches it)
final deliveriesClockProvider = StreamProvider.autoDispose<DateTime>(
  (ref) => Stream<DateTime>.periodic(AppConfig.deliveriesClockTick, (_) => DateTime.now()),
);

/// One delivery on the board: who and what to collect; where; then how it
/// stands and since when. Each line holds one thing, so no language's longer
/// words push another out of the card. A button to assistive technology.
class DeliveryCard extends StatelessWidget {
  final DeliveryOrder order;
  final DateTime now;
  final VoidCallback onTap;

  /// A fixed width where cards sit side by side; null fills the column it is in
  final double? width;

  const DeliveryCard({super.key, required this.order, required this.now, required this.onTap, this.width});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final lane = order.lane;
    final name = (order.customerName ?? '').isEmpty ? l10n.guest : order.customerName!;
    final amber = AppColors.amber(theme.colors.brightness);
    final (border, icon, color) = switch (lane) {
      DeliveryLane.waiting => (AppColors.amber500.withValues(alpha: 0.7), FIcons.clock, amber),
      DeliveryLane.cashDue => (AppColors.emerald500.withValues(alpha: 0.7), FIcons.banknote, AppColors.emerald(theme.colors.brightness)),
      DeliveryLane.failed || DeliveryLane.returned => (AppColors.amber500.withValues(alpha: 0.7), FIcons.undo2, amber),
      _ => (theme.colors.border, order.isOut ? FIcons.bike : FIcons.circleDot, theme.colors.foreground),
    };
    final stage = stageText(l10n, order);
    final since = order.since;

    return Semantics(
      button: true,
      label: '${l10n.orderNumber(order.orderNumber)}, $name, $stage',
      excludeSemantics: true,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: Container(
            width: width,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              border: Border.all(color: border),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    // The name and its number as one line, with all the room up to the amount;
                    // a long name is cut there, never halfway across an empty row
                    Expanded(
                      child: Text.rich(
                        TextSpan(children: [
                          TextSpan(text: name, style: theme.typography.base.copyWith(fontWeight: FontWeight.w600)),
                          TextSpan(
                            text: '  ${bidiIsolate('#${order.orderNumber}')}',
                            style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground),
                          ),
                        ]),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(money(context, order.total),
                        style: theme.typography.sm.copyWith(fontWeight: FontWeight.w600, fontFeatures: const [FontFeature.tabularFigures()])),
                  ],
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Icon(FIcons.mapPin, size: 14, color: theme.colors.mutedForeground),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(addressLine(l10n, order.delivery),
                          maxLines: 1, overflow: TextOverflow.ellipsis, style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground)),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                // Where it has got to: a long rider name wraps under its first
                // line rather than being cut, and the icon keeps its size beside it
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(padding: const EdgeInsets.only(top: 2), child: Icon(icon, size: 14, color: color)),
                    const SizedBox(width: 4),
                    Expanded(child: Text(stage, style: theme.typography.sm.copyWith(fontWeight: FontWeight.w500, color: color))),
                    if (since != null) ...[
                      const SizedBox(width: 8),
                      Text(relativeTime(context, l10n, since, now), style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground)),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

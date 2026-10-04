import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import '../../../core/brand/brand_provider.dart';
import '../../../core/config/app_config.dart';
import '../../../core/models/money.dart';
import 'package:ninja_app_core/theme/app_theme.dart';
import '../../../core/utils/bidi.dart';
import '../../../l10n/app_localizations.dart';
import '../../orders/status.dart';
import '../models/delivery_order.dart';
import '../providers/deliveries_provider.dart';
import 'delivery_details.dart';
import 'delivery_dialog.dart';

/// The board's clock: "since" times redraw on it while the board is on screen
/// (autoDispose: it stops ticking when nothing watches it)
final deliveriesClockProvider = StreamProvider.autoDispose<DateTime>(
  (ref) => Stream<DateTime>.periodic(AppConfig.deliveriesClockTick, (_) => DateTime.now()),
);

/// The branch's deliveries on the floor, by where each one stands: waiting
/// for a rider, with a rider (and whether they have left), coming back or
/// back, delivered with the cash still out. A tap opens the delivery. Gone
/// when there is nothing out, and where the business does not deliver.
class DeliveriesStrip extends ConsumerWidget {
  const DeliveriesStrip({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    if (!ref.watch(featuresProvider.select((f) => f.delivery))) return const SizedBox.shrink();
    final deliveries = ref.watch(deliveriesProvider).value ?? const <DeliveryOrder>[];
    if (deliveries.isEmpty) return const SizedBox.shrink();
    final now = ref.watch(deliveriesClockProvider).value ?? DateTime.now();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Icon(FIcons.bike, size: 20, color: theme.colors.primary),
            const SizedBox(width: 8),
            Text(l10n.deliveries, style: theme.typography.lg.copyWith(fontWeight: FontWeight.w600)),
            const SizedBox(width: 8),
            FBadge(child: Text('${deliveries.length}', style: const TextStyle(fontFeatures: [FontFeature.tabularFigures()]))),
          ],
        ),
        const SizedBox(height: 8),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.only(bottom: 4),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (final (index, order) in deliveries.indexed) ...[
                if (index > 0) const SizedBox(width: 12),
                DeliveryCard(
                  key: ValueKey(order.orderNumber),
                  order: order,
                  now: now,
                  onTap: () => showDeliveryDialog(context, order.orderNumber),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 16),
      ],
    );
  }
}

/// One delivery on the board: who and what to collect; where; then how it
/// stands and since when. Each line holds one thing, so no language's longer
/// words push another out of the card. A button to assistive technology.
class DeliveryCard extends StatelessWidget {
  final DeliveryOrder order;
  final DateTime now;
  final VoidCallback onTap;

  const DeliveryCard({super.key, required this.order, required this.now, required this.onTap});

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
            width: 300,
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
                    Flexible(
                      child: Text(name,
                          maxLines: 1, overflow: TextOverflow.ellipsis, style: theme.typography.base.copyWith(fontWeight: FontWeight.w600)),
                    ),
                    const SizedBox(width: 6),
                    Text(bidiIsolate('#${order.orderNumber}'), style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground)),
                    const Spacer(),
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

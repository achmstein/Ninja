import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import '../../../core/brand/brand_provider.dart';
import '../../../core/models/money.dart';
import '../../../l10n/app_localizations.dart';
import '../models/delivery_board.dart';
import '../models/delivery_order.dart';
import '../providers/deliveries_provider.dart';
import '../screens/deliveries_board_screen.dart';

/// The deliveries on the floor in one row, however many there are: how many
/// in each lane (the ones waiting on the cashier tinted) and the cash still
/// out, a tap from the board where they are worked. Gone when there is
/// nothing out, and where the business does not deliver.
class DeliveriesSummary extends ConsumerWidget {
  const DeliveriesSummary({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    if (!ref.watch(featuresProvider.select((f) => f.delivery))) return const SizedBox.shrink();
    final deliveries = ref.watch(deliveriesProvider).value ?? const <DeliveryOrder>[];
    final lanes = byLane(deliveries);
    final total = lanes.values.fold(0, (sum, l) => sum + l.length);
    if (total == 0) return const SizedBox.shrink();
    final cash = lanes[BoardLane.cashDue]!.fold(0.0, (sum, o) => sum + o.total);

    Widget lane(BoardLane lane) {
      final count = lanes[lane]!.length;
      final tint = count > 0 ? lane.tint(theme.colors.brightness) : null;
      final color = tint ?? (count > 0 ? theme.colors.foreground : theme.colors.mutedForeground);
      return Container(
        height: 36,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(
          color: tint?.withValues(alpha: 0.12) ?? theme.colors.secondary,
          borderRadius: BorderRadius.circular(18),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(lane.icon, size: 16, color: color),
            const SizedBox(width: 6),
            Text(
              lane == BoardLane.cashDue && count > 0 ? '${lane.label(l10n)} $count · ${money(context, cash)}' : '${lane.label(l10n)} $count',
              style: theme.typography.sm.copyWith(fontWeight: FontWeight.w600, color: color, fontFeatures: const [FontFeature.tabularFigures()]),
            ),
          ],
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Semantics(
        button: true,
        label: '${l10n.deliveries}, $total',
        child: FTappable(
          onPress: () => context.go('/deliveries'),
          child: Container(
            padding: const EdgeInsetsDirectional.fromSTEB(14, 10, 8, 10),
            decoration: BoxDecoration(
              border: Border.all(color: theme.colors.border),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Row(
              children: [
                Icon(FIcons.bike, size: 20, color: theme.colors.primary),
                const SizedBox(width: 8),
                Text(l10n.deliveries, style: theme.typography.lg.copyWith(fontWeight: FontWeight.w600)),
                const SizedBox(width: 12),
                // The lanes scroll sideways on a narrow till rather than wrap the row
                Expanded(
                  child: SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        for (final (index, l) in BoardLane.values.indexed) ...[
                          if (index > 0) const SizedBox(width: 8),
                          lane(l),
                        ],
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Icon(FIcons.chevronRight, size: 20, color: theme.colors.mutedForeground),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

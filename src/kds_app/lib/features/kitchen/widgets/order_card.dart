import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import '../../../core/models/localized_text.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/text_styles.dart';
import '../../../l10n/app_localizations.dart';
import '../models/kitchen_order.dart';
import '../status.dart';

/// One order as a kitchen ticket, as kds_web's order-card and the way every
/// kitchen display lays one out:
///
/// - a header band tinted by how late the order is, carrying the clock as
///   the loudest thing on the card, the ticket number small (it is what the
///   till says, not what the kitchen shouts), a chip for where the order
///   goes, and the customer's name on its own line when there is someone
///   to call;
/// - the lines, big enough to read at arm's length, quantity in its own
///   column, modifiers under the product, special instructions in amber;
/// - the one tap that moves it along — Ready on the board, Bring back in
///   the history.
///
/// Nothing about money.
class OrderCard extends StatelessWidget {
  final KitchenOrder order;
  final DateTime now;

  /// This card's tap is in flight: its button is disabled, no other card's
  final bool acting;
  final VoidCallback? onReady;
  final VoidCallback? onBringBack;

  const OrderCard({
    super.key,
    required this.order,
    required this.now,
    required this.acting,
    this.onReady,
    this.onBringBack,
  });

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final brightness = theme.colors.brightness;
    final dark = brightness == Brightness.dark;
    final amber = AppColors.amber(brightness);
    const tabular = [FontFeature.tabularFigures()];

    final isReady = order.isReady;

    // The clock runs from confirmation; a ready order shows when it was
    // finished instead
    final tone = isReady ? CardTone.ready : orderUrgency(order.since, now).tone;
    final clock = isReady
        ? MaterialLocalizations.of(context).formatTimeOfDay(TimeOfDay.fromDateTime(order.readyAt!.toLocal()))
        : formatElapsed(order.since, now);

    // Where it goes: the room or table it was ordered from; failing that, the
    // counter it was rung up at, or the pickup shelf
    final room = order.roomName?.localized(context) ?? '';
    final table = order.tableName?.localized(context) ?? '';
    final place = room.isNotEmpty ? room : table;
    final channel = place.isNotEmpty
        ? place
        : order.isPos
            ? l10n.counter
            : l10n.pickup;
    final placeIcon = room.isNotEmpty
        ? FIcons.doorOpen
        : place.isNotEmpty
            ? FIcons.armchair
            : order.isPos
                ? FIcons.store
                : FIcons.shoppingBag;

    // Who it is for: the name to call out. A counter sale or a table order
    // without a name needs nobody called, so the line is left out; an app
    // pickup without a name is a guest.
    final customer = order.customerName ?? '';
    final who = customer.isNotEmpty
        ? customer
        : (order.isPos || place.isNotEmpty)
            ? ''
            : l10n.walkIn;

    // The band is the one place colour means something on the board: the
    // whole strip tints with the clock, so a late ticket is read across the
    // room and not from a thin border. The outline picks it up faintly.
    final (Color band, Color clockColor, Color? outline) = switch (tone) {
      CardTone.delayed => (
          theme.colors.destructive.withValues(alpha: dark ? 0.2 : 0.1),
          theme.colors.destructive,
          theme.colors.destructive.withValues(alpha: 0.4),
        ),
      CardTone.warning => (
          AppColors.amber500.withValues(alpha: dark ? 0.2 : 0.15),
          amber,
          AppColors.amber500.withValues(alpha: 0.4),
        ),
      CardTone.ready => (
          AppColors.emerald500.withValues(alpha: dark ? 0.2 : 0.15),
          AppColors.emerald(brightness),
          AppColors.emerald500.withValues(alpha: 0.4),
        ),
      CardTone.fresh => (
          theme.colors.muted.withValues(alpha: 0.5),
          theme.colors.foreground,
          null,
        ),
    };

    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: theme.colors.background,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: outline ?? theme.colors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            color: band,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Text(
                      '#${order.orderNumber}',
                      style: theme.typography.sm.copyWith(fontWeight: FontWeight.w500, color: theme.colors.mutedForeground, fontFeatures: tabular),
                    ),
                    const SizedBox(width: 8),
                    Flexible(child: _chip(theme, icon: placeIcon, label: channel)),
                    const SizedBox(width: 8),
                    const Spacer(),
                    Text(
                      clock,
                      style: theme.typography.xl.copyWith(fontWeight: FontWeight.w700, color: clockColor, fontFeatures: tabular, height: 1),
                    ),
                  ],
                ),
                if (who.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    who,
                    style: theme.typography.lg.copyWith(fontWeight: FontWeight.w600, height: 1.25),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ],
            ),
          ),
          Container(height: 1, color: theme.colors.border),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 4, 12, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (final (index, item) in order.items.indexed) ...[
                  if (index > 0) Container(height: 1, color: theme.colors.border),
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SizedBox(
                          width: 28,
                          child: Text('${item.units}×', style: theme.typography.base.copyWith(fontWeight: FontWeight.w700, fontFeatures: tabular)),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(item.productName.localized(context), style: theme.typography.base.copyWith(fontWeight: FontWeight.w600, height: 1.25)),
                              if (item.customizationsDescription != null) ...[
                                const SizedBox(height: 2),
                                Text(item.customizationsDescription!.localized(context), style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground, height: 1.35)),
                              ],
                              if (item.specialInstructions != null) ...[
                                const SizedBox(height: 2),
                                Text(item.specialInstructions!, style: theme.typography.sm.copyWith(fontWeight: FontWeight.w500, color: amber, height: 1.35)),
                              ],
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
                if (order.customerNote != null) ...[
                  const SizedBox(height: 4),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    decoration: BoxDecoration(
                      color: AppColors.amber500.withValues(alpha: 0.10),
                      border: Border.all(color: AppColors.amber500.withValues(alpha: 0.4)),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(FIcons.messageSquareText, size: 16, color: amber),
                        const SizedBox(width: 8),
                        Expanded(child: Text(order.customerNote!, style: theme.typography.sm.copyWith(fontWeight: FontWeight.w500, color: amber))),
                      ],
                    ),
                  ),
                ],
                if (onReady != null || onBringBack != null) ...[
                  const SizedBox(height: 8),
                  if (onBringBack != null)
                    _button(theme, variant: FButtonVariant.outline, icon: FIcons.undo2, label: l10n.bringBack, onPress: onBringBack!)
                  else
                    _button(theme, variant: null, icon: FIcons.check, label: l10n.ready, onPress: onReady!),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// The where-it-goes chip: an outline badge on the band, filled so it
  /// reads as a chip on the tint, at a size the kitchen can read
  Widget _chip(FThemeData theme, {required IconData icon, required String label}) {
    return FBadge.raw(
      variant: FBadgeVariant.outline,
      style: FBadgeStyleDelta.delta(decoration: BoxDecorationDelta.delta(color: theme.colors.background)),
      builder: (context, style) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: theme.colors.mutedForeground),
            const SizedBox(width: 4),
            Flexible(
              child: Text(label, style: theme.typography.sm.copyWith(fontWeight: FontWeight.w500, color: theme.colors.foreground), overflow: TextOverflow.ellipsis),
            ),
          ],
        ),
      ),
    );
  }

  /// A 48 dp button across the whole card — tapped with a wet finger
  Widget _button(FThemeData theme, {required FButtonVariant? variant, required IconData icon, required String label, required VoidCallback onPress}) {
    return SizedBox(
      height: 48,
      child: FButton(
        variant: variant,
        onPress: acting ? null : onPress,
        prefix: Icon(icon, size: 20),
        child: Text(label, style: theme.typography.base.forButton),
      ),
    );
  }
}

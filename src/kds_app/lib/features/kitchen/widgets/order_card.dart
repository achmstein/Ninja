import 'package:flutter/material.dart';
import '../../../core/utils/bidi.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/models/localized_text.dart';
import 'package:ninja_app_core/theme/app_theme.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import 'package:ninja_app_core/theme/text_styles.dart';
import '../../../l10n/app_localizations.dart';
import '../models/kitchen_order.dart';
import '../status.dart';
import 'item_line.dart';
import 'elapsed_ring.dart';

/// The delivery platforms whose own mark we show; anything else falls back to its name
const _platformLogos = {'Talabat': 'assets/images/talabat.png'};

/// One order as a kitchen ticket, as kds_web's order-card, in the till's own
/// manner: a flat ticket under a thin rule, text in sizes and weights,
/// colour only where it means something.
///
/// - a thin bar across the top and the clock's colour say how late it is;
/// - where it goes is the biggest line (the kitchen sends it there), with
///   the ticket's number and who to call quiet under it, and the clock
///   opposite;
/// - the lines, big enough to read at arm's length, the count in its own
///   column, options under the item, what the customer asked for in amber;
/// - the order's note behind an amber rule, and on the pass the stations it
///   is split between, in words;
/// - the one tap that moves it along: Ready on the board, Bring back in the
///   history.
///
/// An order cancelled at the till goes quiet (no fill, its lines struck
/// through and faded, a hatched bar) and says so once, in red; it does not
/// turn the whole ticket red. Nothing about money.
class OrderCard extends StatelessWidget {
  final KitchenOrder order;
  final DateTime now;

  /// This card's tap is in flight: its button is disabled, no other card's
  final bool acting;
  final VoidCallback? onReady;
  final VoidCallback? onBringBack;

  /// The pass: which stations the order is split between
  final bool showParts;

  const OrderCard({
    super.key,
    required this.order,
    required this.now,
    required this.acting,
    this.onReady,
    this.onBringBack,
    this.showParts = false,
  });

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final brightness = theme.colors.brightness;
    final amber = AppColors.amber(brightness);
    const tabular = [FontFeature.tabularFigures()];

    final isReady = order.isReady;
    // Its bill was voided at the till after the kitchen had it. The card
    // stays, saying so, until whoever was making it clears it: one that just
    // vanished went unnoticed, and the order went on being made
    final isCancelled = order.isCancelled;

    // The clock runs from confirmation; a ready order shows when it was
    // finished instead
    final tone = isCancelled
        ? CardTone.cancelled
        : isReady
            ? CardTone.ready
            : orderUrgency(order.since, now).tone;
    final clock = isReady
        ? MaterialLocalizations.of(context).formatTimeOfDay(TimeOfDay.fromDateTime(order.readyAt!.toLocal()))
        : formatElapsed(order.since, now);

    // Where it goes: the room or table it was ordered from; failing that, the
    // counter it was rung up at, or the pickup shelf
    final place = order.placeName?.localized(context) ?? '';
    final channel = place.isNotEmpty
        ? place
        : order.isPos
            ? l10n.counter
            : l10n.pickup;
    // Who it is for: the name to call out. A counter sale or a table order
    // without a name needs nobody called, so the line is left out; an app
    // pickup without a name is a guest.
    final customer = order.customerName ?? '';
    final who = customer.isNotEmpty
        ? customer
        : (order.isPos || place.isNotEmpty)
            ? ''
            : l10n.walkIn;

    // A delivery platform's order: its logo and the code the rider asks for,
    // big enough to match the bag to the rider across the pass, and how it leaves
    final platform = order.platform;
    final riderAt = platform?.riderPickupAt == null
        ? null
        : MaterialLocalizations.of(context).formatTimeOfDay(TimeOfDay.fromDateTime(platform!.riderPickupAt!.toLocal()));
    final handover = switch (platform?.expedition) {
      null => null,
      'Pickup' => l10n.platformCollect,
      'VendorDelivery' => l10n.platformOwnRider,
      _ => riderAt == null ? null : l10n.platformRiderAt(riderAt),
    };

    // One station is the whole order; the split is only worth showing past that
    final parts = showParts && order.parts.length > 1 ? order.parts : const <KitchenOrderPart>[];

    // How late it is shows in two places only: the bar across the top and the
    // clock's colour. The ticket itself stays plain, as everything on the till is
    final (Color bar, Color clockColor) = switch (tone) {
      CardTone.cancelled => (theme.colors.destructive, theme.colors.mutedForeground),
      CardTone.delayed => (theme.colors.destructive, theme.colors.destructive),
      CardTone.warning => (AppColors.amber500, amber),
      CardTone.ready => (AppColors.emerald500, AppColors.emerald(brightness)),
      CardTone.fresh => (theme.colors.mutedForeground.withValues(alpha: 0.4), theme.colors.foreground),
    };
    const inset = EdgeInsets.symmetric(horizontal: 16);
    final struck = isCancelled ? TextDecoration.lineThrough : null;
    final quiet = theme.typography.sm.copyWith(color: theme.colors.mutedForeground, height: 20 / 14);

    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: isCancelled ? null : theme.colors.background,
        borderRadius: BorderRadius.circular(Sizes.radiusCard),
        border: Border.all(color: theme.colors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // A cancelled ticket's bar is hatched: it is not late, it is off
          SizedBox(
            height: 5,
            child: isCancelled ? CustomPaint(painter: _Hatch(bar)) : ColoredBox(color: bar),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 10),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (platform != null)
                        _platformLine(theme, platform)
                      else
                        Text(
                          channel,
                          style: theme.typography.xl.copyWith(
                            fontSize: 22,
                            height: 28 / 22,
                            fontWeight: FontWeight.w700,
                            color: isCancelled ? theme.colors.mutedForeground : theme.colors.foreground,
                          ),
                        ),
                      Text(
                        who.isEmpty ? hashNumber(order.orderNumber) : '${hashNumber(order.orderNumber)} · $who',
                        style: quiet.copyWith(fontFeatures: tabular),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                // How far through its time, filling toward late; a finished or
                // cancelled order has no clock to run
                if (!isReady && !isCancelled) ...[
                  Padding(padding: const EdgeInsets.only(top: 4), child: ElapsedRing(since: order.since, now: now)),
                  const SizedBox(width: 8),
                ],
                Text(
                  clock,
                  style: theme.typography.xl.copyWith(
                      fontSize: 26, height: 28 / 26, fontWeight: FontWeight.w700, color: clockColor, fontFeatures: tabular),
                ),
              ],
            ),
          ),
          if (isCancelled)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
              child: Row(
                children: [
                  Icon(FIcons.x, size: Sizes.icon, color: theme.colors.destructive),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(l10n.orderCancelled,
                        style: theme.typography.lg.copyWith(fontWeight: FontWeight.w700, color: theme.colors.destructive, height: 24 / 18)),
                  ),
                ],
              ),
            ),
          if (handover != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
              child: Row(
                children: [
                  Icon(platform?.expedition == 'Pickup' ? FIcons.shoppingBag : FIcons.bike,
                      size: Sizes.iconSmall, color: theme.colors.mutedForeground),
                  const SizedBox(width: 6),
                  Expanded(child: Text(handover, style: theme.typography.sm.copyWith(fontSize: 15, fontWeight: FontWeight.w500))),
                ],
              ),
            ),
          if (platform?.cancelledAt != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
              child: Row(
                children: [
                  Icon(FIcons.triangleAlert, size: Sizes.iconSmall, color: theme.colors.destructive),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(l10n.platformCancelled,
                        style: theme.typography.sm.copyWith(fontSize: 15, fontWeight: FontWeight.w600, color: theme.colors.destructive)),
                  ),
                ],
              ),
            ),
          Container(height: 1, color: theme.colors.border),
          Opacity(
            opacity: isCancelled ? 0.55 : 1,
            child: Padding(
              padding: inset,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (final (index, item) in order.items.indexed) ...[
                    if (index > 0) Container(height: 1, color: theme.colors.border),
                    // A tap strikes the item through while it is being worked
                    ItemLine(
                      orderNumber: order.orderNumber,
                      index: index,
                      enabled: onReady != null && !isCancelled,
                      units: '${item.units}×',
                      unitsStyle: theme.typography.xl.copyWith(
                          fontSize: 20,
                          height: 26 / 20,
                          fontWeight: isCancelled ? FontWeight.w500 : FontWeight.w700,
                          decoration: struck,
                          fontFeatures: tabular),
                      name: item.productName.localized(context),
                      nameStyle: theme.typography.lg.copyWith(
                          fontSize: 19,
                          height: 26 / 19,
                          fontWeight: isCancelled ? FontWeight.w500 : FontWeight.w600,
                          decoration: struck,
                          color: theme.colors.foreground),
                      details: [
                        if (item.customizationsDescription != null)
                          Text(item.customizationsDescription!.localized(context),
                              style: theme.typography.sm.copyWith(fontSize: 15, height: 22 / 15, color: theme.colors.mutedForeground)),
                        if (item.specialInstructions != null)
                          Text(item.specialInstructions!,
                              style: theme.typography.sm.copyWith(fontSize: 15, height: 22 / 15, fontWeight: FontWeight.w600, color: amber)),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ),
          if (order.customerNote != null)
            // The order's note: plain words behind an amber rule, not a boxed alert
            Container(
              margin: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: theme.colors.muted.withValues(alpha: 0.6),
                border: const BorderDirectional(start: BorderSide(color: AppColors.amber500, width: 3)),
              ),
              child: Text(order.customerNote!,
                  style: theme.typography.sm.copyWith(fontSize: 15, height: 22 / 15, fontWeight: FontWeight.w500, color: theme.colors.foreground)),
            ),
          if (parts.isNotEmpty)
            // The stations it is split between, in words: the ones still making
            // it stand out, a done one is ticked, a printer's shows the printer
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
              child: Wrap(
                spacing: 6,
                runSpacing: 2,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  for (final (index, part) in parts.indexed)
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (index > 0) ...[Text('·', style: quiet), const SizedBox(width: 6)],
                        Flexible(
                          child: Text(
                            part.stationName.localized(context),
                            overflow: TextOverflow.ellipsis,
                            style: !part.isReady && part.showsOnScreen
                                ? quiet.copyWith(color: theme.colors.foreground, fontWeight: FontWeight.w600)
                                : quiet,
                          ),
                        ),
                        if (!part.showsOnScreen || part.isReady) ...[
                          const SizedBox(width: 4),
                          Icon(part.showsOnScreen ? FIcons.check : FIcons.printer, size: 14, color: theme.colors.mutedForeground),
                        ],
                      ],
                    ),
                ],
              ),
            ),
          if (onReady != null || onBringBack != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
              child: onBringBack != null
                  ? _button(theme, variant: FButtonVariant.outline, icon: FIcons.undo2, label: l10n.bringBack, onPress: onBringBack!)
                  : isCancelled
                      // The same call as Ready: it takes the ticket off this screen. Plain, as the ticket is: nothing left to shout
                      ? _button(theme, variant: FButtonVariant.outline, label: l10n.cancelledRemove, onPress: onReady!)
                      : _button(theme, variant: null, label: l10n.ready, onPress: onReady!),
            ),
        ],
      ),
    );
  }

  /// A delivery platform's order leads with its own logo and the code the
  /// rider asks for, as big as a place's name
  Widget _platformLine(FThemeData theme, KitchenPlatform platform) {
    final logo = _platformLogos[platform.name];
    return Row(
      children: [
        if (logo != null)
          Image.asset(logo, height: 20, semanticLabel: platform.name)
        else
          Text(platform.name, style: theme.typography.base.copyWith(fontWeight: FontWeight.w600)),
        const SizedBox(width: 8),
        Flexible(
          child: Directionality(
            textDirection: TextDirection.ltr,
            child: Text(
              platform.code,
              overflow: TextOverflow.ellipsis,
              style: theme.typography.xl.copyWith(
                fontSize: 22,
                height: 28 / 22,
                fontWeight: FontWeight.w700,
                color: theme.colors.foreground,
                fontFamily: 'monospace',
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
          ),
        ),
      ],
    );
  }

  /// The ticket's main action across its whole width, tapped with a wet finger
  Widget _button(FThemeData theme, {required FButtonVariant? variant, IconData? icon, required String label, required VoidCallback onPress}) {
    return SizedBox(
      height: Sizes.controlLarge,
      child: FButton(
        variant: variant,
        onPress: acting ? null : onPress,
        prefix: icon == null ? null : Icon(icon, size: Sizes.icon),
        child: Text(label, style: theme.typography.lg.forButton.copyWith(fontWeight: FontWeight.w600)),
      ),
    );
  }
}

/// Diagonal stripes across a cancelled ticket's bar
class _Hatch extends CustomPainter {
  final Color color;
  const _Hatch(this.color);

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = 5;
    canvas.clipRect(Offset.zero & size);
    for (var x = -size.height; x < size.width + size.height; x += 14) {
      canvas.drawLine(Offset(x, size.height), Offset(x + size.height, 0), paint);
    }
  }

  @override
  bool shouldRepaint(_Hatch old) => old.color != color;
}

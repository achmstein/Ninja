import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/theme/app_theme.dart';
import '../../../l10n/app_localizations.dart';
import '../models/delivery_order.dart';

/// The rider app's money and counts: tabular, so a figure does not shift as it changes
const tabular = [FontFeature.tabularFigures()];

/// What the customer or the cashier typed, in whichever script: read in its
/// own direction (a Latin "7 El Nasr St" keeps its number first on an Arabic
/// screen) while the line keeps the screen's alignment. A first-strong isolate.
String typed(String text) => '\u2068$text\u2069';

/// A screen's own list: padded for a phone and always scrollable, so a
/// pull refreshes it whatever it shows
class RiderList extends StatelessWidget {
  final List<Widget> children;

  const RiderList({super.key, required this.children});

  @override
  Widget build(BuildContext context) => ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
        physics: const AlwaysScrollableScrollPhysics(),
        children: children,
      );
}

/// Where a delivery stands, in a word and a colour (never the colour alone)
class StatusChip extends StatelessWidget {
  final String text;
  final Color color;

  const StatusChip({super.key, required this.text, required this.color});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    return Container(
      height: 28,
      padding: const EdgeInsetsDirectional.only(start: 10, end: 12),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(14)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
          const SizedBox(width: 6),
          Text(text, style: theme.typography.sm.copyWith(fontWeight: FontWeight.w600, color: color, height: 1.1)),
        ],
      ),
    );
  }
}

/// A figure of the day under its label, on a card: the cash with the rider, how many delivered
class StatTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  /// Tints the tile, for a figure the rider must act on (cash still to hand in)
  final Color? accent;
  final VoidCallback? onPress;

  const StatTile({super.key, required this.icon, required this.label, required this.value, this.accent, this.onPress});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final muted = theme.colors.mutedForeground;
    final tile = Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
      decoration: BoxDecoration(
        color: accent?.withValues(alpha: 0.08) ?? theme.colors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: accent?.withValues(alpha: 0.35) ?? theme.colors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 16, color: accent ?? muted),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.typography.xs.copyWith(fontWeight: FontWeight.w500, color: muted),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          // A long amount shrinks rather than wraps or clips
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: AlignmentDirectional.centerStart,
            child: Text(
              value,
              maxLines: 1,
              style: theme.typography.xl.copyWith(fontWeight: FontWeight.w700, fontFeatures: tabular, height: 1.2),
            ),
          ),
        ],
      ),
    );
    return onPress == null ? tile : FTappable(onPress: onPress, child: tile);
  }
}

/// A one-line note over the list: offline since when, and the like
class NoteBanner extends StatelessWidget {
  final IconData icon;
  final String text;

  const NoteBanner({super.key, required this.icon, required this.text});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(color: theme.colors.muted, borderRadius: BorderRadius.circular(12)),
        child: Row(
          children: [
            Icon(icon, size: 16, color: theme.colors.mutedForeground),
            const SizedBox(width: 8),
            Expanded(child: Text(text, style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground))),
          ],
        ),
      ),
    );
  }
}

/// A section's label, with how many are in it
class SectionTitle extends StatelessWidget {
  final String text;
  final int? count;

  const SectionTitle(this.text, {super.key, this.count});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    return Padding(
      padding: const EdgeInsets.only(top: 8, bottom: 10),
      child: Row(
        children: [
          Text(text, style: theme.typography.lg.copyWith(fontWeight: FontWeight.w700)),
          if (count != null) ...[
            const SizedBox(width: 8),
            Container(
              height: 24,
              constraints: const BoxConstraints(minWidth: 24),
              padding: const EdgeInsets.symmetric(horizontal: 8),
              alignment: Alignment.center,
              decoration: BoxDecoration(color: theme.colors.secondary, borderRadius: BorderRadius.circular(12)),
              child: Text(
                '$count',
                style: theme.typography.sm.copyWith(fontWeight: FontWeight.w600, fontFeatures: tabular, height: 1),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// A screen with nothing to list, or that could not load: an icon in a soft disc, a line, a hint, and what to do
class EmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? body;
  final Widget? action;

  const EmptyState({super.key, required this.icon, required this.title, this.body, this.action});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final muted = theme.colors.mutedForeground;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(color: theme.colors.muted, shape: BoxShape.circle),
            child: Icon(icon, size: 32, color: muted),
          ),
          const SizedBox(height: 16),
          Text(title, style: theme.typography.lg.copyWith(fontWeight: FontWeight.w600), textAlign: TextAlign.center),
          if (body != null) ...[
            const SizedBox(height: 6),
            Text(body!, style: theme.typography.sm.copyWith(color: muted), textAlign: TextAlign.center),
          ],
          if (action != null) ...[const SizedBox(height: 20), action!],
        ],
      ),
    );
  }
}

/// A delivery done: whom, when, how much, and whether its cash is still out
/// (or that the bag went back to the branch)
class DoneRow extends StatelessWidget {
  final DeliveryOrder order;
  final String Function(double) money;

  const DoneRow({super.key, required this.order, required this.money});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final at = order.deliveredAt ?? order.outAt;
    final time = at == null ? '' : MaterialLocalizations.of(context).formatTimeOfDay(TimeOfDay.fromDateTime(at.toLocal()));
    final muted = theme.colors.mutedForeground;
    final green = AppColors.emerald(theme.colors.brightness);
    final amber = AppColors.amber(theme.colors.brightness);
    final returned = order.stage == DeliveryStage.returned;
    final (status, statusColor) = returned
        ? (l10n.returnedToBranch, muted)
        : order.cashInHand
            ? (l10n.cashWithYou, amber)
            : (l10n.handedIn, green);
    return Container(
      constraints: const BoxConstraints(minHeight: 64),
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(border: Border(bottom: BorderSide(color: theme.colors.border))),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: (returned ? muted : green).withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: Icon(returned ? FIcons.undo2 : FIcons.check, size: 20, color: returned ? muted : green),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  order.customerName == null ? l10n.guest : typed(order.customerName!),
                  style: theme.typography.base.copyWith(fontWeight: FontWeight.w600),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  [l10n.orderNumber(order.orderNumber), if (time.isNotEmpty) time].join(' · '),
                  style: theme.typography.sm.copyWith(color: muted, fontFeatures: tabular),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              if (!returned)
                Text(money(order.total), style: theme.typography.base.copyWith(fontWeight: FontWeight.w700, fontFeatures: tabular)),
              const SizedBox(height: 2),
              Text(status, style: theme.typography.xs.copyWith(fontWeight: FontWeight.w600, color: statusColor)),
            ],
          ),
        ],
      ),
    );
  }
}

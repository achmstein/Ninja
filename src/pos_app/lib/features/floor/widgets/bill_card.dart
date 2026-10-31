import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/models/localized_text.dart';
import '../../../core/models/money.dart';
import '../../../core/utils/bidi.dart';
import 'package:ninja_app_core/theme/app_theme.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import '../../../l10n/app_localizations.dart';
import '../../tickets/models/enums.dart';
import '../../tickets/models/ticket_summary.dart';

IconData ticketTypeIcon(TicketType? type) => switch (type) {
      TicketType.room => FIcons.doorOpen,
      TicketType.table => FIcons.armchair,
      _ => FIcons.shoppingBag,
    };

String ticketTypeLabel(AppLocalizations l10n, TicketType? type) => switch (type) {
      TicketType.room => l10n.room,
      TicketType.table => l10n.table,
      _ => l10n.counter,
    };

/// The name a bill card shows: the place, else the bill's label, else its kind
String billCardLabel(BuildContext context, TicketSummary ticket) {
  final title = ticket.locationName?.localized(context);
  if (title != null && title.isNotEmpty) return title;
  return ticket.label?.isNotEmpty == true ? ticket.label! : ticketTypeLabel(AppLocalizations.of(context)!, ticket.type);
}

/// One card per open bill: the place, its total, the running clock for a
/// room, and a dot when an order is still waiting to be confirmed onto it.
class BillCard extends StatelessWidget {
  final TicketSummary ticket;

  /// Elapsed session time, when the bill's room is running
  final String? clock;
  final bool waiting;
  final VoidCallback onTap;

  /// Its row's height ([heightFor] across the row), so the cards in a row stand level, the total at the foot
  final double height;

  const BillCard({
    super.key,
    required this.ticket,
    required this.onTap,
    this.clock,
    this.waiting = false,
    this.height = minHeight,
  });

  /// pos_web's min-h-28: a one-line name, no clock
  static const minHeight = 112.0;

  /// What a card of [width] needs, as pos_web's card grows to it: the padding, the name on its one or two
  /// lines, the clock's line, the total's, and the gaps between them; never under [minHeight]. A row of
  /// cards stands as tall as the tallest of them, as pos_web's grid rows do
  static double heightFor(BuildContext context, TicketSummary ticket, {required double width, bool clock = false, bool waiting = false}) {
    final theme = context.theme;
    final scaler = MediaQuery.textScalerOf(context);
    double lines(String text, TextStyle style, double maxWidth, int maxLines) {
      final painter = TextPainter(
        text: TextSpan(text: text, style: style),
        maxLines: maxLines,
        textDirection: TextDirection.ltr,
        textScaler: scaler,
      )..layout(maxWidth: maxWidth < 1 ? 1 : maxWidth);
      final h = painter.height;
      painter.dispose();
      return h;
    }

    // The name beside its icon (16 and 8) and the waiting dot (8 and 10)
    final nameWidth = width - 24 - Sizes.iconSmall - 8 - (waiting ? 18 : 0);
    final name = lines(billCardLabel(context, ticket), _nameStyle(theme), nameWidth, 2);
    final clockLine = clock ? 8 + lines('00:00:00', _clockStyle(theme), width - 24, 1) : 0;
    final total = lines('0', _totalStyle(theme), width - 24, 1);
    final needed = 24 + name + clockLine + 8 + total;
    return needed < minHeight ? minHeight : needed.ceilToDouble();
  }

  static TextStyle _nameStyle(FThemeData theme) => theme.typography.base.copyWith(fontWeight: FontWeight.w600, height: 1.25);
  static TextStyle _clockStyle(FThemeData theme) =>
      theme.typography.sm.copyWith(color: theme.colors.mutedForeground, fontFeatures: const [FontFeature.tabularFigures()]);
  static TextStyle _totalStyle(FThemeData theme) =>
      theme.typography.lg.copyWith(fontWeight: FontWeight.w600, fontFeatures: const [FontFeature.tabularFigures()]);

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final label = billCardLabel(context, ticket);

    return FTappable(
      onPress: onTap,
      // Its row's height, from [heightFor], is what lets the total sit at the
      // bottom: inside a Wrap there is no other height to fill
      builder: (context, states, child) => Container(
        height: height,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: states.contains(FTappableVariant.pressed) || states.contains(FTappableVariant.hovered)
              ? theme.colors.secondary.withValues(alpha: 0.5)
              : theme.colors.background,
          border: Border.all(color: theme.colors.border),
          borderRadius: BorderRadius.circular(Sizes.radiusCard),
        ),
        child: child,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Icon(ticketTypeIcon(ticket.type), size: Sizes.iconSmall, color: theme.colors.mutedForeground),
              ),
              const SizedBox(width: 8),
              // Two lines for a name, laid out in the name's own script so
              // a long English name in an Arabic till is cut at its end,
              // not its start
              Expanded(
                child: Text(
                  label,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  textDirection: textDirectionFor(label),
                  textAlign: textAlignFor(context),
                  style: _nameStyle(theme),
                ),
              ),
              if (waiting) ...[
                const SizedBox(width: 8),
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Container(
                    width: 10,
                    height: 10,
                    decoration: const BoxDecoration(color: AppColors.amber500, shape: BoxShape.circle),
                  ),
                ),
              ],
            ],
          ),
          if (clock != null) ...[
            const SizedBox(height: 8),
            Text(clock!, style: _clockStyle(theme)),
          ],
          const Spacer(),
          Text(money(context, ticket.total), style: _totalStyle(theme)),
        ],
      ),
    );
  }
}

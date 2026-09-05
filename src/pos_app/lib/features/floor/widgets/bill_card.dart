import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import '../../../core/models/localized_text.dart';
import '../../../core/models/money.dart';
import '../../../core/theme/app_theme.dart';
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

/// One card per open bill: the place, its total, the running clock for a
/// room, and a dot when an order is still waiting to be confirmed onto it.
class BillCard extends StatelessWidget {
  final TicketSummary ticket;

  /// Elapsed session time, when the bill's room is running
  final String? clock;
  final bool waiting;
  final VoidCallback onTap;

  const BillCard({
    super.key,
    required this.ticket,
    required this.onTap,
    this.clock,
    this.waiting = false,
  });

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;

    final title = ticket.locationName?.localized(context);
    final label = (title != null && title.isNotEmpty)
        ? title
        : (ticket.label?.isNotEmpty == true ? ticket.label! : ticketTypeLabel(l10n, ticket.type));

    return FTappable(
      onPress: onTap,
      // A fixed card height (pos_web's min-h-28) is what lets the total sit at
      // the bottom: inside a Wrap there is no other height to fill
      builder: (context, states, child) => Container(
        height: 112,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: states.contains(FTappableVariant.pressed) || states.contains(FTappableVariant.hovered)
              ? theme.colors.secondary.withValues(alpha: 0.5)
              : theme.colors.background,
          border: Border.all(color: theme.colors.border),
          borderRadius: BorderRadius.circular(14),
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
                child: Icon(ticketTypeIcon(ticket.type), size: 16, color: theme.colors.mutedForeground),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.typography.base.copyWith(fontWeight: FontWeight.w600),
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
            Text(
              clock!,
              style: theme.typography.sm.copyWith(
                color: theme.colors.mutedForeground,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
          ],
          const Spacer(),
          Text(
            money(context, ticket.total),
            style: theme.typography.lg.copyWith(
              fontWeight: FontWeight.w600,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        ],
      ),
    );
  }
}

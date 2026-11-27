import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/models/localized_text.dart';
import 'package:ninja_app_core/theme/app_theme.dart';
import '../../../core/models/money.dart';
import '../../../core/utils/bidi.dart';
import '../../../l10n/app_localizations.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import '../../tickets/models/ticket_detail.dart';
import '../bill_lines.dart';
import '../bill_people.dart';
import '../../../core/theme/type_roles.dart';
import '../../../core/widgets/paid_tag.dart';

/// A quiet heading over a part of the order: what is new, what was sent
class OrderSectionLabel extends StatelessWidget {
  final String text;

  const OrderSectionLabel(this.text, {super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 4),
      child: TypeLabel(text),
    );
  }
}

/// What an open bill already holds, as one quiet list. The same item
/// ordered twice for the same person reads as one line; a line that was for
/// somebody says so under it, by their whole name, which is all that tells
/// whose is whose. While lines are being picked each one stands on its own
/// with a box to tick; the room's time is the room's and what is paid is
/// done, so neither is picked. The web till's SentLines is the same.
class SentLines extends StatelessWidget {
  final List<TicketLineView> lines;

  /// Orders just confirmed by the server, whose lines are tinted for a moment
  final Set<int> landed;

  /// The lines being picked, to move to another bill or to name: which, and
  /// the tap that picks one. Null while they are not
  final LineSelection? selection;

  const SentLines({super.key, required this.lines, this.landed = const {}, this.selection});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final selection = this.selection;
    final shown = selection == null
        ? sentLinesByPerson(lines)
        : [for (final line in lines) (line: line, paid: line.paid)];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final (index, one) in shown.indexed) ...[
          if (index > 0) Container(height: 1, color: theme.colors.border),
          _SentRow(
            key: ValueKey(one.line.id),
            line: one.line,
            paid: one.paid,
            landed: landed.contains(one.line.orderId),
            // Null outside picking; false for a line that cannot be picked, which keeps the box's room
            picked: selection == null
                ? null
                : pickableLine(one.line)
                    ? selection.chosen.contains(one.line.id)
                    : false,
            onToggle: selection != null && pickableLine(one.line) ? () => selection.onToggle(one.line.id) : null,
          ),
        ],
      ],
    );
  }
}

/// The sent lines being picked: which, and the tap that picks one
typedef LineSelection = ({Set<int> chosen, void Function(int lineId) onToggle});

class _SentRow extends StatelessWidget {
  final TicketLineView line;

  /// Paid for already, by a part payment taken while the bill is open
  final bool paid;
  final bool landed;

  /// Ticked or not while lines are picked; null when they are not
  final bool? picked;

  /// The tap that ticks it; null for a line that cannot be picked
  final VoidCallback? onToggle;

  const _SentRow({super.key, required this.line, required this.paid, required this.landed, this.picked, this.onToggle});

  static String _qty(double qty) => qty == qty.roundToDouble() ? qty.toStringAsFixed(0) : qty.toString();

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final negative = line.total < 0;
    final emerald = AppColors.emerald(theme.colors.brightness);
    final ink = negative ? emerald : theme.colors.mutedForeground;
    final style = theme.type.detail.copyWith(color: ink);
    const tabular = [FontFeature.tabularFigures()];
    final details = line.details?.localized(context) ?? '';
    final who = line.customerName ?? '';

    final picked = this.picked;
    final onToggle = this.onToggle;
    final ticked = picked ?? false;

    final body = Container(
      constraints: BoxConstraints(minHeight: picked == null ? 44 : Sizes.control),
      color: ticked ? theme.colors.secondary : null,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // The box to tick. A line that cannot be picked keeps its room, so the list stays in line
          if (picked != null) ...[
            Visibility(
              visible: onToggle != null,
              maintainSize: true,
              maintainAnimation: true,
              maintainState: true,
              child: Container(
                width: 24,
                height: 24,
                decoration: BoxDecoration(
                  color: ticked ? theme.colors.primary : null,
                  border: Border.all(
                      color: ticked ? theme.colors.primary : theme.colors.mutedForeground.withValues(alpha: 0.5)),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: ticked ? Icon(FIcons.check, size: Sizes.iconSmall, color: theme.colors.primaryForeground) : null,
              ),
            ),
            const SizedBox(width: 8),
          ],
          SizedBox(
            width: 32,
            child: Text('${_qty(line.qty)}×',
                style: style.copyWith(
                    color: theme.colors.mutedForeground, fontWeight: FontWeight.w500, fontFeatures: tabular)),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(line.description?.localized(context) ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: style),
                if (details.isNotEmpty)
                  Text(details,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.type.caption.copyWith(color: theme.colors.mutedForeground)),
                // Whose it is, in full and on its own line. Laid out in the
                // name's own script, so a long one is cut at its end, and
                // pinned to the row's start, so it still sits under its item
                if (who.isNotEmpty)
                  Text(
                    who,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textDirection: textDirectionFor(who),
                    textAlign: textAlignFor(context),
                    style: theme.type.caption.copyWith(
                      fontWeight: FontWeight.w500,
                      color: theme.colors.foreground.withValues(alpha: 0.7),
                    ),
                  ),
              ],
            ),
          ),
          if (paid) ...[
            const SizedBox(width: 8),
            const PaidTag(),
          ],
          const SizedBox(width: 8),
          Text(money(context, line.total), style: style.copyWith(fontFeatures: tabular)),
        ],
      ),
    );
    final row = onToggle == null
        ? body
        : Semantics(
            checked: ticked,
            label: AppLocalizations.of(context)!.selectLines,
            child: FTappable(onPress: onToggle, child: body),
          );
    if (!landed) return row;
    // Just in from the server: a soft tint behind it fades out
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 1, end: 0),
      duration: const Duration(milliseconds: 1200),
      curve: Curves.easeOut,
      builder: (context, t, child) =>
          DecoratedBox(decoration: BoxDecoration(color: theme.colors.primary.withValues(alpha: 0.08 * t)), child: child),
      child: row,
    );
  }
}

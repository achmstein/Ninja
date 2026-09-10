import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import '../../../core/models/localized_text.dart';
import '../../../core/models/money.dart';
import '../../../core/theme/text_styles.dart';
import '../../../core/widgets/heading.dart';
import '../../../core/widgets/pos_dialog.dart';
import '../../../l10n/app_localizations.dart';
import '../../floor/widgets/bill_card.dart' show ticketTypeIcon, ticketTypeLabel;
import '../../tables/models/cafe_table.dart';
import '../../tables/services/tables_service.dart';
import '../../tickets/models/enums.dart';
import '../../tickets/models/move_lines.dart';
import '../../tickets/models/ticket_detail.dart';
import '../../tickets/models/ticket_summary.dart';
import '../../tickets/providers/tickets_provider.dart';
import '../../../core/utils/bidi.dart';

/// How the picker opens: `move` shows the bills already on the floor as a
/// searchable card grid; `new` the ways to open a fresh bill. Two focused
/// screens instead of one long modal, so a busy floor is not a wall of
/// buttons to scroll.
enum MoveMode { move, newBill }

/// Where the selected lines go. Any bill already on the floor — the
/// customer who ordered at a table and then took a room. Or a new one: a
/// counter tab for whoever is leaving the table to pay on their way out, a
/// free table for the group that moved, or the same place again — the
/// turnover split. A room's own bill follows its session, so a room never
/// gets a second one. Resolves to the pick.
Future<MoveTarget?> showMoveTargetDialog(
  BuildContext context, {
  required TicketDetail ticket,
  required int count,
  required bool allSelected,
  required MoveMode mode,
}) {
  return showPosDialog<MoveTarget>(
    context,
    maxWidth: mode == MoveMode.move ? 680 : 448,
    builder: (context) => _MoveTargetDialog(ticket: ticket, count: count, allSelected: allSelected, mode: mode),
  );
}

class _MoveTargetDialog extends ConsumerStatefulWidget {
  final TicketDetail ticket;
  final int count;
  final bool allSelected;
  final MoveMode mode;
  const _MoveTargetDialog({required this.ticket, required this.count, required this.allSelected, required this.mode});

  @override
  ConsumerState<_MoveTargetDialog> createState() => _MoveTargetDialogState();
}

class _MoveTargetDialogState extends ConsumerState<_MoveTargetDialog> {
  final _label = TextEditingController();
  final _search = TextEditingController();

  @override
  void initState() {
    super.initState();
    _search.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _label.dispose();
    _search.dispose();
    super.dispose();
  }

  void _pick(MoveTarget target) => Navigator.of(context, rootNavigator: true).pop(target);

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final move = widget.mode == MoveMode.move;

    return ConstrainedBox(
      constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.9),
      child: DialogScroll(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(move ? l10n.moveToBill : l10n.newBill,
                style: theme.typography.xl.copyWith(fontWeight: FontWeight.w600)),
            const SizedBox(height: 4),
            Text(l10n.moveLinesAction(widget.count),
                style: theme.typography.base.copyWith(color: theme.colors.mutedForeground)),
            const SizedBox(height: 16),
            if (move) _moveBody(theme, l10n) else _newBillBody(theme, l10n),
          ],
        ),
      ),
    );
  }

  // The bills already on the floor, searchable, grouped by kind so the
  // cashier's eye lands where they expect (rooms, then tables, then tabs).
  Widget _moveBody(FThemeData theme, AppLocalizations l10n) {
    final tickets = ref.watch(openTicketsProvider).value ?? const [];
    final others = tickets.where((t) => t.id != widget.ticket.id).toList();
    final q = _search.text.trim().toLowerCase();
    final visible = q.isEmpty
        ? others
        : others.where((t) {
            final name = (t.locationName?.localized(context) ?? t.label ?? '').toLowerCase();
            return name.contains(q) ||
                ticketTypeLabel(l10n, t.type).toLowerCase().contains(q) ||
                '${t.id}'.contains(q);
          }).toList();

    final groups = <(TicketType, String)>[
      (TicketType.room, l10n.rooms),
      (TicketType.table, l10n.tables),
      (TicketType.counter, l10n.counterTabs),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        FTextField(
          control: FTextFieldControl.managed(controller: _search),
          hint: l10n.searchBills,
          maxLines: 1,
          prefixBuilder: (context, style, _) => Padding(
            padding: const EdgeInsetsDirectional.only(start: 12),
            child: Icon(FIcons.search, size: 20, color: theme.colors.mutedForeground),
          ),
          suffixBuilder: _search.text.isEmpty
              ? null
              : (context, style, _) => FTappable(
                    onPress: () => setState(() => _search.clear()),
                    child: Padding(
                      padding: const EdgeInsetsDirectional.only(end: 12),
                      child: Icon(FIcons.x, size: 18, color: theme.colors.mutedForeground),
                    ),
                  ),
        ),
        const SizedBox(height: 12),
        if (visible.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 32),
            child: Text(l10n.noBillsToMoveTo,
                textAlign: TextAlign.center,
                style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground)),
          )
        else
          for (final (type, label) in groups)
            if (visible.any((t) => t.type == type)) ...[
              Heading(label),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final target in visible.where((t) => t.type == type))
                    _BillCard(target: target, onTap: () => _pick(MoveToTicket(target.id))),
                ],
              ),
              const SizedBox(height: 16),
            ],
      ],
    );
  }

  // Ways to open a fresh bill: a named counter tab, the same place again
  // (turnover split), or a free table the group moved to.
  Widget _newBillBody(FThemeData theme, AppLocalizations l10n) {
    final tickets = ref.watch(openTicketsProvider).value ?? const [];
    final tables = ref.watch(tablesProvider).value ?? const <CafeTable>[];
    final freeTables = [
      for (final table in tables)
        if (table.isActive && !tickets.any((t) => t.type == TicketType.table && t.tableId == table.id)) table,
    ];
    final canSplit = widget.ticket.type != TicketType.room && !widget.allSelected;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: FTextField(
                control: FTextFieldControl.managed(controller: _label),
                hint: l10n.tabName,
                maxLines: 1,
              ),
            ),
            const SizedBox(width: 8),
            SizedBox(
              height: 48,
              child: FButton(
                variant: FButtonVariant.outline,
                mainAxisSize: MainAxisSize.min,
                onPress: () => _pick(MoveToCounter(_label.text.trim().isEmpty ? null : _label.text.trim())),
                prefix: const Icon(FIcons.plus, size: 20),
                child: Text(l10n.newTab, style: theme.typography.base.forButton),
              ),
            ),
          ],
        ),
        if (canSplit) ...[
          const SizedBox(height: 8),
          SizedBox(
            height: 56,
            child: FButton(
              variant: FButtonVariant.outline,
              mainAxisAlignment: MainAxisAlignment.start,
              onPress: () => _pick(const MoveToSplit()),
              prefix: Icon(FIcons.split, size: 20, color: theme.colors.mutedForeground),
              child: Text(l10n.newTicketForPlace, style: theme.typography.base.forButton),
            ),
          ),
        ],
        if (freeTables.isNotEmpty) ...[
          const SizedBox(height: 16),
          Heading(l10n.freeTables),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final table in freeTables)
                SizedBox(
                  height: 44,
                  child: FButton(
                    variant: FButtonVariant.outline,
                    mainAxisSize: MainAxisSize.min,
                    onPress: () => _pick(MoveToTable(table.id, table.name)),
                    prefix: Icon(FIcons.armchair, size: 16, color: theme.colors.mutedForeground),
                    child: Text(table.name.localized(context), style: theme.typography.base.forButton),
                  ),
                ),
            ],
          ),
        ],
      ],
    );
  }
}

/// One open bill as a card in the move grid: kind icon and name, then its
/// number and running total.
class _BillCard extends StatelessWidget {
  final TicketSummary target;
  final VoidCallback onTap;

  const _BillCard({required this.target, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final title = (target.locationName?.localized(context) ?? '').isNotEmpty
        ? target.locationName!.localized(context)
        : (target.label ?? ticketTypeLabel(l10n, target.type));

    return SizedBox(
      width: 190,
      child: FTappable(
        onPress: onTap,
        builder: (context, states, child) => Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: states.contains(FTappableVariant.pressed) ? theme.colors.secondary : null,
            border: Border.all(color: theme.colors.border),
            borderRadius: BorderRadius.circular(12),
          ),
          child: child,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                Icon(ticketTypeIcon(target.type), size: 18, color: theme.colors.mutedForeground),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.typography.base.copyWith(fontWeight: FontWeight.w600)),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(bidiIsolate('#${target.id}'),
                    style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground)),
                Text(money(context, target.total),
                    style: theme.typography.base.copyWith(
                        fontWeight: FontWeight.w600, fontFeatures: const [FontFeature.tabularFigures()])),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import '../../../core/models/localized_text.dart';
import '../../../core/models/money.dart';
import '../../../core/theme/text_styles.dart';
import '../../../core/widgets/heading.dart';
import '../../../l10n/app_localizations.dart';
import '../../floor/widgets/bill_card.dart' show ticketTypeIcon, ticketTypeLabel;
import '../../tables/models/cafe_table.dart';
import '../../tables/services/tables_service.dart';
import '../../tickets/models/enums.dart';
import '../../tickets/models/move_lines.dart';
import '../../tickets/models/ticket_detail.dart';
import '../../tickets/providers/tickets_provider.dart';

/// Where the selected lines go. Any bill already on the floor — the
/// customer who ordered at a table and then took a room. Or a new one: a
/// counter tab for whoever is leaving the table to pay on their way out, a
/// free table for the group that moved (opened and filled in one step), or
/// the same place again — the turnover split, for an order that landed on
/// the previous group's bill. A room's own bill follows its session, so a
/// room never gets a second one. Resolves to the pick.
Future<MoveTarget?> showMoveTargetDialog(
  BuildContext context, {
  required TicketDetail ticket,
  required int count,
  required bool allSelected,
}) {
  return showFDialog<MoveTarget>(
    context: context,
    useRootNavigator: true,
    builder: (context, style, animation) => FDialog.raw(
      style: style,
      animation: animation,
      constraints: const BoxConstraints(maxWidth: 448),
      builder: (context, _) => _MoveTargetDialog(ticket: ticket, count: count, allSelected: allSelected),
    ),
  );
}

class _MoveTargetDialog extends ConsumerStatefulWidget {
  final TicketDetail ticket;
  final int count;
  final bool allSelected;
  const _MoveTargetDialog({required this.ticket, required this.count, required this.allSelected});

  @override
  ConsumerState<_MoveTargetDialog> createState() => _MoveTargetDialogState();
}

class _MoveTargetDialogState extends ConsumerState<_MoveTargetDialog> {
  final _label = TextEditingController();

  @override
  void dispose() {
    _label.dispose();
    super.dispose();
  }

  void _pick(MoveTarget target) => Navigator.of(context, rootNavigator: true).pop(target);

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final tickets = ref.watch(openTicketsProvider).value ?? const [];
    final tables = ref.watch(tablesProvider).value ?? const <CafeTable>[];

    final others = tickets.where((t) => t.id != widget.ticket.id).toList();
    final freeTables = [
      for (final table in tables)
        if (table.isActive && !tickets.any((t) => t.type == TicketType.table && t.tableId == table.id)) table,
    ];
    // Every movable line selected: a same-place split would just be a rename
    final canSplit = widget.ticket.type != TicketType.room && !widget.allSelected;

    return ConstrainedBox(
      constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.9),
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(l10n.moveTo, style: theme.typography.xl.copyWith(fontWeight: FontWeight.w600)),
            const SizedBox(height: 4),
            Text(l10n.moveLinesAction(widget.count),
                style: theme.typography.base.copyWith(color: theme.colors.mutedForeground)),
            if (others.isNotEmpty) ...[
              const SizedBox(height: 16),
              Heading(l10n.openBills),
              const SizedBox(height: 8),
              for (final (index, target) in others.indexed) ...[
                if (index > 0) const SizedBox(height: 8),
                SizedBox(
                  height: 56,
                  child: FButton(
                    variant: FButtonVariant.outline,
                    mainAxisAlignment: MainAxisAlignment.start,
                    onPress: () => _pick(MoveToTicket(target.id)),
                    prefix: Icon(ticketTypeIcon(target.type), size: 20, color: theme.colors.mutedForeground),
                    suffix: Text(money(context, target.total),
                        style: theme.typography.base.forButton.copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
                    child: Text.rich(
                      TextSpan(
                        text: (target.locationName?.localized(context) ?? '').isNotEmpty
                            ? target.locationName!.localized(context)
                            : (target.label ?? ticketTypeLabel(l10n, target.type)),
                        style: theme.typography.base.forButton,
                        children: [
                          TextSpan(
                            text: '  ${ticketTypeLabel(l10n, target.type)} · #${target.id}',
                            style: theme.typography.sm.forButton.copyWith(color: theme.colors.mutedForeground),
                          ),
                        ],
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ),
              ],
            ],
            const SizedBox(height: 16),
            Heading(l10n.newTicket),
            const SizedBox(height: 8),
            // A counter tab, named for whoever is taking their lines to the
            // counter; the name is optional, like any tab's
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
        ),
      ),
    );
  }
}

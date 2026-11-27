import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/models/localized_text.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import '../../../core/brand/brand_provider.dart';
import '../../../core/layout/breakpoints.dart';
import '../../../core/models/money.dart';
import '../../../core/utils/bidi.dart';
import '../../../core/widgets/pos_dialog.dart';
import '../../../l10n/app_localizations.dart';
import '../../floor/widgets/bill_card.dart' show ticketTypeIcon, ticketTypeLabel;
import '../../tables/models/dining_table.dart';
import '../../tables/services/tables_service.dart';
import '../../tickets/models/enums.dart';
import '../../tickets/models/move_lines.dart';
import '../../tickets/models/ticket_detail.dart';
import '../../tickets/models/ticket_summary.dart';
import '../../tickets/providers/tickets_provider.dart';
import '../../../core/theme/type_roles.dart';

/// Moving the picked lines: one list of every place they can go, one tap
/// each. A bill already on the floor (the customer who ordered at a table and
/// then took a room). A new tab by name, for whoever is paying on their own.
/// A second bill for the same place, when an order landed on the previous
/// group's bill. A free table, opened and filled in one step. A room's own
/// bill follows its stay, so a room never gets a second one. The box on the
/// top row narrows the list by a bill's or a table's name. Resolves to the
/// pick. The web till's MoveTargetDialog is the same.
Future<MoveTarget?> showMoveTargetDialog(
  BuildContext context, {
  required TicketDetail ticket,

  /// How many lines are picked: the dialog only says what it will move
  required int count,

  /// Every movable line is picked: a same-place split would just be a rename
  required bool allSelected,

  /// The one customer every picked line is for: the new tab's name, ready to take or change
  String? suggestedName,
}) {
  return showPosDialog<MoveTarget>(
    context,
    size: DialogSize.lg,
    builder: (context) =>
        MoveTargetList(ticket: ticket, count: count, allSelected: allSelected, suggestedName: suggestedName),
  );
}

/// The body of the move dialog: it closes the dialog with the pick
class MoveTargetList extends ConsumerStatefulWidget {
  final TicketDetail ticket;
  final int count;
  final bool allSelected;
  final String? suggestedName;

  const MoveTargetList({super.key, required this.ticket, required this.count, required this.allSelected, this.suggestedName});

  @override
  ConsumerState<MoveTargetList> createState() => _MoveTargetListState();
}

class _MoveTargetListState extends ConsumerState<MoveTargetList> {
  final _search = TextEditingController();

  // The picked lines' one customer, already there: one tap names the tab for them
  late final _label = TextEditingController(text: widget.suggestedName ?? '');

  /// The new tab's name is asked only once that row is tapped: a step replaces the row
  bool _naming = false;

  @override
  void initState() {
    super.initState();
    _search.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _search.dispose();
    _label.dispose();
    super.dispose();
  }

  void _pick(MoveTarget target) => Navigator.of(context, rootNavigator: true).pop(target);

  void _createTab() {
    final name = _label.text.trim();
    _pick(MoveToCounter(name.isEmpty ? null : name));
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final ticket = widget.ticket;
    final tickets = ref.watch(openTicketsProvider).value ?? const <TicketSummary>[];
    // Places with no clock: lines can move to a free one; a timed place's bill
    // follows its stay. A cloud kitchen seats nobody: nothing moves to a table
    final tables = ref.watch(isCloudKitchenProvider)
        ? const <DiningTable>[]
        : ref.watch(tablesProvider).value ?? const <DiningTable>[];

    String titleOf(TicketSummary target) {
      final place = target.locationName?.localized(context) ?? '';
      if (place.isNotEmpty) return place;
      final label = target.label ?? '';
      return label.isNotEmpty ? label : ticketTypeLabel(l10n, target.type);
    }

    final q = _search.text.trim().toLowerCase();
    bool has(String text) => text.toLowerCase().contains(q);
    final others = [
      for (final target in tickets)
        if (target.id != ticket.id &&
            (q.isEmpty || has(titleOf(target)) || has(ticketTypeLabel(l10n, target.type)) || '${target.id}'.contains(q)))
          target,
    ];
    final freeTables = [
      for (final table in tables)
        if (table.isActive &&
            !tickets.any((taken) => taken.type == TicketType.table && taken.placeId == table.id) &&
            (q.isEmpty || has(table.name.localized(context)) || has(l10n.table)))
          table,
    ];
    final canSplit = ticket.sessionId == null && !widget.allSelected;
    final placeName = ticket.locationName?.localized(context) ?? '';
    final place = placeName.isNotEmpty ? placeName : ((ticket.label ?? '').isNotEmpty ? ticket.label! : l10n.counter);
    // A new bill's rows are for when nothing is being searched for by name
    final offersNew = q.isEmpty;
    final muted = theme.colors.mutedForeground;
    final rule = Container(height: 1, color: theme.colors.border);

    Widget caption(String text) => Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
          child: TypeLabel(text),
        );

    // A row of the list: what it is, a quieter line under it, and the way on.
    // A name is laid out in its own script and pinned to the row's start
    Widget row({
      required IconData icon,
      required String title,
      required String detail,
      String? amount,
      required VoidCallback onPress,
    }) =>
        FTappable(
          onPress: onPress,
          builder: (context, states, child) => Container(
            constraints: const BoxConstraints(minHeight: Sizes.controlLarge),
            color: states.contains(FTappableVariant.pressed) ? theme.colors.secondary : null,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: child,
          ),
          child: Row(
            children: [
              Icon(icon, size: Sizes.icon, color: muted),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        textDirection: textDirectionFor(title),
                        textAlign: textAlignFor(context),
                        style: theme.type.heading),
                    Text(detail,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: theme.type.detail
                            .copyWith(color: muted, fontFeatures: const [FontFeature.tabularFigures()])),
                  ],
                ),
              ),
              if (amount != null) ...[
                const SizedBox(width: 12),
                Text(amount,
                    maxLines: 1,
                    style: theme.type.body.copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
              ],
              const SizedBox(width: 8),
              Icon(FIcons.chevronRight,
                  size: Sizes.iconSmall, color: muted),
            ],
          ),
        );

    final rows = <Widget>[
      if (others.isNotEmpty) caption(l10n.moveOpenBills),
      for (final target in others)
        row(
          icon: ticketTypeIcon(target.type),
          title: titleOf(target),
          detail: '${ticketTypeLabel(l10n, target.type)} · ${hashNumber(target.id)}',
          amount: money(context, target.total),
          onPress: () => _pick(MoveToTicket(target.id)),
        ),
      if (offersNew) ...[
        caption(l10n.moveNewBill),
        if (_naming)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: FTextField(
                    control: FTextFieldControl.managed(controller: _label),
                    label: Text(l10n.tabName),
                    maxLines: 1,
                    // Asked for by the tap on its row: it is what is typed into next
                    autofocus: true,
                    textInputAction: TextInputAction.done,
                    onSubmit: (_) => _createTab(),
                  ),
                ),
                const SizedBox(width: 8),
                ConstrainedBox(
                  constraints: const BoxConstraints(minWidth: 96, minHeight: Sizes.control),
                  child: FButton(
                    mainAxisSize: MainAxisSize.min,
                    onPress: _createTab,
                    child: Text(l10n.moveCreate, style: theme.type.button),
                  ),
                ),
              ],
            ),
          )
        else
          row(
            icon: FIcons.receiptText,
            title: l10n.moveTabWithName,
            detail: l10n.moveTabWithNameHint,
            onPress: () => setState(() => _naming = true),
          ),
        if (canSplit)
          row(
            icon: FIcons.split,
            title: l10n.moveSecondBill(place),
            detail: l10n.moveSecondBillHint,
            onPress: () => _pick(const MoveToSplit()),
          ),
      ],
      if (freeTables.isNotEmpty) ...[
        caption(l10n.moveFreeTable),
        // Tiles in a grid, all the same size: a few to choose between, one tap each
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
          child: LayoutBuilder(
            builder: (context, constraints) {
              final columns = context.isCompact ? 2 : 3;
              final width = (constraints.maxWidth - 8 * (columns - 1)) / columns;
              return Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final table in freeTables)
                    _TableTile(
                        name: table.name.localized(context), width: width, onPress: () => _pick(MoveToTable(table.id))),
                ],
              );
            },
          ),
        ),
      ],
      if (others.isEmpty && freeTables.isEmpty && !offersNew)
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 32),
          child: Text(l10n.moveNothing, textAlign: TextAlign.center, style: theme.type.body.copyWith(color: muted)),
        ),
    ];

    return ConstrainedBox(
      constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.9),
      child: DialogScroll(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(l10n.moveItemsTitle(widget.count), style: theme.type.title),
            const SizedBox(height: 4),
            Text(l10n.moveItemsHint(bidiIsolate(place)), style: theme.type.body.copyWith(color: muted)),
            const SizedBox(height: 12),
            FTextField(
              control: FTextFieldControl.managed(controller: _search),
              hint: l10n.moveFind,
              maxLines: 1,
              textInputAction: TextInputAction.search,
              clearable: (value) => value.text.isNotEmpty,
            ),
            const SizedBox(height: 12),
            Container(
              clipBehavior: Clip.antiAlias,
              decoration: BoxDecoration(
                border: Border.all(color: theme.colors.border),
                borderRadius: BorderRadius.circular(Sizes.radius),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (final (index, one) in rows.indexed) ...[
                    // A rule between two rows; a caption opens its own part
                    if (index > 0 && one is FTappable && rows[index - 1] is FTappable) rule,
                    one,
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A free table to move the lines to: every tile the same size, its name on
/// up to two lines
class _TableTile extends StatelessWidget {
  final String name;
  final double width;
  final VoidCallback onPress;

  const _TableTile({required this.name, required this.width, required this.onPress});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    return SizedBox(
      width: width,
      height: 64,
      child: FTappable(
        onPress: onPress,
        builder: (context, states, child) => Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          alignment: AlignmentDirectional.centerStart,
          decoration: BoxDecoration(
            color: states.contains(FTappableVariant.pressed) ? theme.colors.secondary : null,
            border: Border.all(color: theme.colors.border),
            borderRadius: BorderRadius.circular(Sizes.radius),
          ),
          child: child,
        ),
        child: Text(name,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            textDirection: textDirectionFor(name),
            textAlign: textAlignFor(context),
            style: theme.type.heading),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/models/localized_text.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import 'package:ninja_app_core/theme/text_styles.dart';
import '../../../core/layout/breakpoints.dart';
import '../../../core/models/money.dart';
import '../../../l10n/app_localizations.dart';
import '../../catalog/models/catalog_item.dart';
import '../models/sale_line.dart';
import 'cart_line_row.dart';
import 'customer_field.dart';

/// The running sale: its heading, who it is for and whether a rider takes
/// it, the lines, what goes well with the last one, the note and the charge
/// button. Beside the menu on a tablet, in the bottom sheet on a phone: the
/// same parts either way, so nothing is out of reach on either. The web
/// till's order panel is the same.
///
/// It only draws what the sale pad hands it: the pad owns the sale, and the
/// charge.
class SaleOrderPanel extends StatelessWidget {
  final String title;
  final List<SaleLine> lines;
  final SaleCustomer? customer;

  /// Empties the sale; null while there is nothing on it to clear
  final VoidCallback? onClear;

  /// Closes the sheet this is shown in; null beside the menu, where there
  /// is nothing to close
  final VoidCallback? onClose;

  /// The note is being typed with the keyboard up: the customer row and the
  /// suggestions step aside so the note stays in view
  final bool typingNote;

  /// The room's people, for whose round this is; null where the plain
  /// customer picker is shown instead
  final List<({String id, String name})>? roundRoster;
  final void Function(({String id, String name}) member) onPickRound;
  final VoidCallback onSomeoneElse;
  final VoidCallback onChooseCustomer;
  final VoidCallback onRemoveCustomer;

  /// Sends it out with a rider; null where that is not on offer
  final VoidCallback? onDeliver;

  /// Where a delivery on the sale goes, or why it cannot go yet
  final Widget? deliveryDetail;

  /// The rows by line, so the pad can bring the one just rung up into view
  final Map<String, GlobalKey> rowKeys;

  /// How many times each line has been rung up, so its tint starts again
  final Map<String, int> rungUp;
  final void Function(String key, int quantity) onSetQuantity;

  final List<CatalogItem> suggestions;
  final void Function(CatalogItem item) onSuggestion;

  /// The fee a delivery adds and about how long it takes; null on a sale
  /// that is not going out
  final ({double fee, int? minutes})? deliveryFee;

  final TextEditingController note;
  final FocusNode noteFocus;

  final String chargeLabel;
  final double total;

  /// Null while the sale cannot be charged
  final VoidCallback? onCharge;

  const SaleOrderPanel({
    super.key,
    required this.title,
    required this.lines,
    required this.customer,
    required this.onClear,
    this.onClose,
    required this.typingNote,
    required this.roundRoster,
    required this.onPickRound,
    required this.onSomeoneElse,
    required this.onChooseCustomer,
    required this.onRemoveCustomer,
    required this.onDeliver,
    required this.deliveryDetail,
    required this.rowKeys,
    required this.rungUp,
    required this.onSetQuantity,
    required this.suggestions,
    required this.onSuggestion,
    required this.deliveryFee,
    required this.note,
    required this.noteFocus,
    required this.chargeLabel,
    required this.total,
    required this.onCharge,
  });

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final roster = roundRoster;
    final showChips = roster != null;
    final offerDelivery = onDeliver != null;
    final customer = this.customer;
    final fee = deliveryFee;
    // A chip is a finger's 48 on a phone, where nothing else is near to
    // steady the hand; the tablet's column keeps its tighter rows
    final chipHeight = context.isNarrow ? Sizes.control : Sizes.controlSmall;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Built like the pad's header (8 + 48 + 8), so the two rules under them meet in one line
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(border: Border(bottom: BorderSide(color: theme.colors.border))),
          child: Row(
            children: [
              Expanded(
                child: Text.rich(
                  TextSpan(
                    text: title,
                    style: theme.typography.lg.copyWith(fontWeight: FontWeight.w700),
                    children: [
                      if (lines.isNotEmpty)
                        TextSpan(
                          text: '  ${l10n.linesCount(saleCount(lines))}',
                          style: theme.typography.sm.copyWith(fontWeight: FontWeight.w500, color: theme.colors.mutedForeground),
                        ),
                    ],
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              SizedBox.square(
                dimension: Sizes.control,
                child: FButton.icon(
                  variant: FButtonVariant.ghost,
                  onPress: onClear,
                  child: const Icon(FIcons.trash2, size: Sizes.icon),
                ),
              ),
              // In a sheet the heading is its title, and carries the way out
              if (onClose != null)
                SizedBox.square(
                  dimension: Sizes.control,
                  child: Semantics(
                    label: l10n.close,
                    child: FButton.icon(
                      variant: FButtonVariant.ghost,
                      onPress: onClose,
                      child: const Icon(FIcons.x, size: Sizes.iconNav),
                    ),
                  ),
                ),
            ],
          ),
        ),
        // Who it is for and whether a rider takes it, side by side on
        // one row; out of the way while the note is typed into
        if (!typingNote)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(border: Border(bottom: BorderSide(color: theme.colors.border))),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (roster != null) ...[
                  _WhoseRoundChips(
                    roster: roster,
                    selectedId: customer?.id,
                    chipHeight: chipHeight,
                    onPick: onPickRound,
                    onSomeoneElse: onSomeoneElse,
                  ),
                  if (customer != null || offerDelivery) const SizedBox(height: 8),
                ],
                if (customer != null || !showChips || offerDelivery)
                  Row(
                    children: [
                      if (customer != null)
                        Expanded(
                          child: SelectedCustomerChip(customer: customer, onRemove: onRemoveCustomer),
                        )
                      else if (!showChips)
                        Expanded(
                          child: ChooseCustomerButton(
                            // Beside the delivery button there is no room for "(optional)"
                            showOptional: !offerDelivery,
                            onPress: onChooseCustomer,
                          ),
                        ),
                      if (offerDelivery) ...[
                        if (customer != null || !showChips) const SizedBox(width: 8),
                        SizedBox(
                          height: Sizes.control,
                          child: FButton(
                            variant: FButtonVariant.outline,
                            mainAxisSize: MainAxisSize.min,
                            onPress: onDeliver,
                            prefix: const Icon(FIcons.bike, size: Sizes.icon),
                            child: Text(l10n.deliverIt, style: theme.typography.base.forButton),
                          ),
                        ),
                      ],
                    ],
                  ),
                if (deliveryDetail != null) ...[
                  const SizedBox(height: 8),
                  deliveryDetail!,
                ],
              ],
            ),
          ),
        Expanded(
          child: lines.isEmpty
              ? const SizedBox.shrink()
              // Every row built (a sale is a few dozen at most), so the
              // one just rung up can always be brought into view
              : SingleChildScrollView(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      for (final (index, line) in lines.indexed) ...[
                        if (index > 0) Container(height: 1, color: theme.colors.border),
                        KeyedSubtree(
                          key: rowKeys.putIfAbsent(line.key, GlobalKey.new),
                          child: _RungUp(
                            tick: rungUp[line.key] ?? 0,
                            child: CartLineRow(line: line, onSetQuantity: onSetQuantity),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
        ),
        // What the item rung up last goes well with: one tap to offer it
        if (suggestions.isNotEmpty && !typingNote)
          Container(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
            decoration: BoxDecoration(border: Border(top: BorderSide(color: theme.colors.border))),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(l10n.goesWellWith, style: theme.typography.xs.copyWith(color: theme.colors.mutedForeground)),
                const SizedBox(height: 6),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      for (final item in suggestions)
                        Padding(
                          padding: const EdgeInsetsDirectional.only(end: 8, bottom: 4),
                          child: ConstrainedBox(
                            constraints: BoxConstraints(minHeight: chipHeight),
                            child: FButton(
                              variant: FButtonVariant.outline,
                              mainAxisSize: MainAxisSize.min,
                              onPress: () => onSuggestion(item),
                              prefix: const Icon(FIcons.plus, size: Sizes.iconSmall),
                              child: Text('${item.name.localized(context)}  ${money(context, item.unitPrice)}',
                                  style: theme.typography.base.forButton),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(border: Border(top: BorderSide(color: theme.colors.border))),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (fee != null) ...[
                Row(
                  children: [
                    Expanded(
                      child: Text(
                          fee.minutes == null
                              ? l10n.deliveryFee
                              : '${l10n.deliveryFee} · ${l10n.deliveryAboutMinutes(fee.minutes!)}',
                          style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground)),
                    ),
                    Text(fee.fee > 0 ? money(context, fee.fee) : l10n.deliveryFree,
                        style: theme.typography.sm.copyWith(
                            color: theme.colors.mutedForeground, fontFeatures: const [FontFeature.tabularFigures()])),
                  ],
                ),
                const SizedBox(height: 8),
              ],
              FTextField(
                control: FTextFieldControl.managed(controller: note),
                focusNode: noteFocus,
                hint: l10n.orderNoteOptional,
                maxLines: 1,
              ),
              const SizedBox(height: 12),
              SizedBox(
                height: Sizes.controlLarge,
                child: FButton(
                  onPress: onCharge,
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  suffix: Text(money(context, total),
                      style: theme.typography.lg.forButton.copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
                  child: Text(chargeLabel, style: theme.typography.lg.forButton),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// "Whose round?" — the room's members as one-tap chips, the selected one
/// filled, plus a "someone else" chip for a person not in the room yet.
class _WhoseRoundChips extends StatelessWidget {
  final List<({String id, String name})> roster;
  final String? selectedId;
  final double chipHeight;
  final void Function(({String id, String name}) member) onPick;
  final VoidCallback onSomeoneElse;

  const _WhoseRoundChips({
    required this.roster,
    required this.selectedId,
    required this.chipHeight,
    required this.onPick,
    required this.onSomeoneElse,
  });

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(l10n.whoseRound, style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground)),
        const SizedBox(height: 6),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final member in roster)
              ConstrainedBox(
                constraints: BoxConstraints(minHeight: chipHeight),
                child: FButton(
                  variant: member.id == selectedId ? null : FButtonVariant.outline,
                  mainAxisSize: MainAxisSize.min,
                  onPress: () => onPick(member),
                  child: Text(member.name.isEmpty ? l10n.guest : member.name, style: theme.typography.base.forButton),
                ),
              ),
            ConstrainedBox(
              constraints: BoxConstraints(minHeight: chipHeight),
              child: FButton(
                variant: FButtonVariant.outline,
                mainAxisSize: MainAxisSize.min,
                onPress: onSomeoneElse,
                prefix: Icon(FIcons.userPlus, size: Sizes.iconSmall, color: theme.colors.mutedForeground),
                child: Text(l10n.someoneElse, style: theme.typography.base.forButton),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

/// A line just rung up: a soft tint behind its row fades out, the way a line
/// landing on the bill does, so the eye finds what was added. [tick] counts
/// the taps, so each one starts it again
class _RungUp extends StatelessWidget {
  final int tick;
  final Widget child;

  const _RungUp({required this.tick, required this.child});

  @override
  Widget build(BuildContext context) {
    if (tick == 0) return child;
    final theme = context.theme;
    return TweenAnimationBuilder<double>(
      key: ValueKey(tick),
      tween: Tween(begin: 1, end: 0),
      duration: const Duration(milliseconds: 1200),
      curve: Curves.easeOut,
      builder: (context, t, child) =>
          DecoratedBox(decoration: BoxDecoration(color: theme.colors.primary.withValues(alpha: 0.08 * t)), child: child),
      child: child,
    );
  }
}

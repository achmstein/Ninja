import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/models/localized_text.dart';
import 'package:ninja_app_core/theme/app_theme.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import '../../../core/layout/breakpoints.dart';
import '../../../core/models/money.dart';
import '../../../core/sending/sending.dart';
import '../../../core/sending/sending_lines.dart';
import '../../../core/utils/bidi.dart';
import '../../../l10n/app_localizations.dart';
import '../../catalog/models/catalog_item.dart';
import '../../places/models/place.dart';
import '../../places/widgets/stay_strip.dart';
import '../../ticket/dialogs/discount_dialog.dart';
import '../../tickets/models/ticket_detail.dart';
import '../models/sale_line.dart';
import 'bill_people_row.dart';
import 'cart_line_row.dart';
import 'order_type_switch.dart';
import 'sent_lines.dart';
import '../../../core/theme/type_roles.dart';

/// The order's one big button: what it says, what it comes to, and whether
/// it can be pressed
typedef OrderPrimary = ({
  String label,

  /// Shown at the button's end; left out, the words are centred
  double? amount,

  /// Null while it cannot be pressed
  VoidCallback? onPress,

  /// Lines are still on their way: a small spinner beside the words
  bool busy,
});

/// The open bill the order is rung onto, as the panel draws it
typedef OrderBill = ({
  int ticketId,

  /// Read from the server; null until it is
  TicketDetail? ticket,

  /// Charged here and not confirmed yet (core/sending)
  List<Sending> sends,

  /// Orders whose lines have just landed, tinted for a moment
  Set<int> landed,

  /// The room's clock, while it runs
  Stay? runningStay,

  /// The rest the bill can do (the ⋯ menu); null until the bill is read
  Widget? menu,
});

/// The order side of the sale screen: one plain list, as a receipt reads.
/// Beside the menu on a tablet, in the bottom sheet on a phone: the same
/// parts either way, so nothing is out of reach on either. The web till's
/// order panel is the same.
///
/// Its head says what it is (a new sale, or the table, room or tab it is
/// rung onto) and carries what goes with that: the room's clock, the counter
/// or delivery switch, the sale's customer, the delivery's address. A bill
/// carries the names of its people there: one tapped, and what is rung up
/// next is theirs; none, and it is nobody's. Its list is what is new, then
/// what was sent. Its foot is the total and one button: Send what is new, or
/// take the money.
///
/// It only draws what the sale pad hands it: the pad owns the sale, and the
/// charge.
class SaleOrderPanel extends StatelessWidget {
  final String title;
  final List<SaleLine> lines;

  /// The open bill; null for a new sale
  final OrderBill? bill;

  /// Whose the order is: a bill's people (the room's, and whoever was rung
  /// up for or named on it) or a new sale's one customer, the one what is
  /// rung up next is for, and what a tap, a hold and the button at the row's
  /// end do
  final OrderPeople people;

  /// Empties the sale; null while there is nothing on it to clear
  final VoidCallback? onClear;

  /// Closes the sheet this is shown in; null beside the menu, where there
  /// is nothing to close
  final VoidCallback? onClose;

  /// The note is being typed with the keyboard up: what stands under the
  /// head and the suggestions step aside so the note stays in view
  final bool typingNote;


  /// Counter or delivery, where a new sale can go out with a rider; null
  /// where that is not on offer
  final ({bool delivering, VoidCallback onDelivery, VoidCallback onCounter})? orderType;

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

  /// What the order comes to: the whole bill with what is new and on its
  /// way, or the new sale with its delivery
  final double total;
  final OrderPrimary primary;

  /// Sent lines are being picked (to split off, move or name)
  final LineSelection? selection;

  /// What stands in the button's place while lines are picked
  final Widget? footer;

  const SaleOrderPanel({
    super.key,
    required this.title,
    required this.lines,
    required this.bill,
    required this.people,
    required this.onClear,
    this.onClose,
    required this.typingNote,
    required this.orderType,
    required this.deliveryDetail,
    required this.rowKeys,
    required this.rungUp,
    required this.onSetQuantity,
    required this.suggestions,
    required this.onSuggestion,
    required this.deliveryFee,
    required this.note,
    required this.noteFocus,
    required this.total,
    required this.primary,
    this.selection,
    this.footer,
  });

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final bill = this.bill;
    final onBill = bill != null;
    final orderType = this.orderType;
    final fee = deliveryFee;
    final rule = BorderSide(color: theme.colors.border);
    const tabular = [FontFeature.tabularFigures()];
    // A chip is a finger's 48 on a phone, where nothing else is near to
    // steady the hand; the tablet's column keeps its tighter rows
    final chipHeight = context.isNarrow ? Sizes.control : Sizes.controlSmall;

    final sends = bill?.sends ?? const <Sending>[];
    final sent = bill?.ticket?.lines ?? const <TicketLineView>[];
    final hasSent = sent.isNotEmpty || sends.isNotEmpty;
    final runningStay = bill?.runningStay;
    // Taken already in part payments, on a bill still open
    final partPaid = bill?.ticket?.partPaid ?? 0;
    final billTicket = bill?.ticket;

    // What goes with the order, under its head: each in its one fixed place
    final about = <Widget>[
      // The room's clock, one line: always in sight, the rest a tap away
      if (runningStay != null) StayStrip(session: runningStay),
      // What kind of order: decided first, and always in sight
      if (orderType != null)
        OrderTypeSwitch(delivering: orderType.delivering, onDelivery: orderType.onDelivery, onCounter: orderType.onCounter),
      // Whose the order is, one row that swipes: a tap and what is rung up next is theirs, a second
      // tap lets go. The way to add one stays at the row's end. Nothing has to be tapped. A new
      // sale's one customer is shown the same way
      if (!onBill || (billTicket != null && billTicket.isOpen && !billTicket.isVoided))
        BillPeopleRow(people: people, height: chipHeight),
      ?deliveryDetail,
    ];

    return LayoutBuilder(
      builder: (context, constraints) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Built like the pad's header (8 + 48 + 8), so the two rules under them meet in one line
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(border: Border(bottom: rule)),
            child: Row(
              children: [
                // The name gives way, cut with an ellipsis; the bill's number never does
                Expanded(
                  child: Row(
                    children: [
                      Flexible(
                        child: Text(title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: theme.type.heading),
                      ),
                      if (onBill || lines.isNotEmpty) ...[
                        const SizedBox(width: 8),
                        Text(
                          onBill ? hashNumber(bill.ticketId) : l10n.linesCount(saleCount(lines)),
                          maxLines: 1,
                          style: theme.type.detail.copyWith(
                              fontWeight: FontWeight.w500, color: theme.colors.mutedForeground, fontFeatures: tabular),
                        ),
                      ],
                    ],
                  ),
                ),
                // A bill with nothing new has no button of its own here: the head keeps its height all the same
                const SizedBox(height: Sizes.control),
                // The rest a bill can do (discount, print, void) opens here, over the order
                ?bill?.menu,
                if (!onBill || lines.isNotEmpty)
                  SizedBox.square(
                    dimension: Sizes.control,
                    child: Semantics(
                      label: l10n.clearSale,
                      child: FButton.icon(
                        variant: FButtonVariant.ghost,
                        onPress: onClear,
                        child: const Icon(FIcons.trash2, size: Sizes.icon),
                      ),
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
          // Out of the way while the note is typed into. The room's opened
          // strip can be long: it scrolls in its place and never takes the
          // lines' whole room
          if (about.isNotEmpty && !typingNote)
            Container(
              constraints: BoxConstraints(maxHeight: constraints.maxHeight * 0.55),
              decoration: BoxDecoration(border: Border(bottom: rule)),
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    for (final (index, one) in about.indexed) ...[
                      if (index > 0) const SizedBox(height: 8),
                      one,
                    ],
                  ],
                ),
              ),
            ),
          Expanded(
            child: lines.isEmpty && !hasSent
                // An open bill with nothing on it yet says how to start
                ? (onBill && bill.ticket != null
                    ? Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 64),
                        child: Text(l10n.orderEmptyHint,
                            textAlign: TextAlign.center,
                            style: theme.type.body.copyWith(color: theme.colors.mutedForeground)),
                      )
                    : const SizedBox.shrink())
                // Every row built (a sale is a few dozen at most), so the
                // one just rung up can always be brought into view
                : SingleChildScrollView(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // What is new first: it is what the hands are on
                        if (lines.isNotEmpty && hasSent) OrderSectionLabel(l10n.newItems),
                        for (final (index, line) in lines.indexed) ...[
                          if (index > 0) Container(height: 1, color: theme.colors.border),
                          KeyedSubtree(
                            key: rowKeys.putIfAbsent(line.key, GlobalKey.new),
                            child: _RungUp(
                              tick: rungUp[line.key] ?? 0,
                              child: CartLineRow(line: line, onSetQuantity: onSetQuantity, marked: onBill),
                            ),
                          ),
                        ],
                        if (hasSent) ...[
                          if (lines.isNotEmpty) OrderSectionLabel(l10n.sentItems),
                          // Charged a moment ago and on their way: they breathe until the server has them
                          SendingLines(sends: sends, ruled: false),
                          if (sends.isNotEmpty && sent.isNotEmpty) Container(height: 1, color: theme.colors.border),
                          SentLines(lines: sent, landed: bill?.landed ?? const {}, selection: selection),
                        ],
                      ],
                    ),
                  ),
          ),
          // What the item rung up last goes well with: one tap to offer it
          if (suggestions.isNotEmpty && !typingNote)
            Container(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
              decoration: BoxDecoration(border: Border(top: rule)),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(l10n.goesWellWith, style: theme.type.caption.copyWith(color: theme.colors.mutedForeground)),
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
                                    style: theme.type.button),
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
            decoration: BoxDecoration(border: Border(top: rule)),
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
                            style: theme.type.detail.copyWith(color: theme.colors.mutedForeground)),
                      ),
                      Text(fee.fee > 0 ? money(context, fee.fee) : l10n.deliveryFree,
                          style: theme.type.detail.copyWith(color: theme.colors.mutedForeground, fontFeatures: tabular)),
                    ],
                  ),
                  const SizedBox(height: 8),
                ],
                // The discount on the bill and what it takes off, nothing else: a tap changes it or takes it away
                if (billTicket != null && billTicket.discount > 0) ...[
                  _DiscountRow(ticket: billTicket),
                  const SizedBox(height: 8),
                ],
                Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    Expanded(
                      child: Text(l10n.total, style: theme.type.detail.copyWith(color: theme.colors.mutedForeground)),
                    ),
                    Text(money(context, total),
                        style: theme.type.figure),
                  ],
                ),
                // Part of it is paid already: what was taken, and what is left to take
                if (partPaid > 0)
                  Row(
                    children: [
                      Expanded(
                        child: Text(l10n.partPaidSoFar(money(context, partPaid)),
                            style: theme.type.detail.copyWith(
                                fontWeight: FontWeight.w500, color: AppColors.emerald(theme.colors.brightness))),
                      ),
                      Text(l10n.leftToPay(money(context, total - partPaid < 0 ? 0 : total - partPaid)),
                          style: theme.type.detail.copyWith(fontWeight: FontWeight.w600, fontFeatures: tabular)),
                    ],
                  ),
                const SizedBox(height: 12),
                // The note is the round's: there is nothing to say it about until something is rung up
                if (lines.isNotEmpty) ...[
                  FTextField(
                    control: FTextFieldControl.managed(controller: note),
                    focusNode: noteFocus,
                    hint: l10n.orderNoteOptional,
                    maxLines: 1,
                  ),
                  const SizedBox(height: 12),
                ],
                // While lines are picked, what is done with them stands in the button's place
                footer ??
                    SizedBox(
                      height: Sizes.controlLarge,
                      child: FButton(
                        onPress: primary.onPress,
                        mainAxisAlignment: primary.amount == null ? MainAxisAlignment.center : MainAxisAlignment.spaceBetween,
                        prefix: primary.busy
                            ? SizedBox.square(
                                dimension: Sizes.icon,
                                child: CircularProgressIndicator(strokeWidth: 2, color: theme.colors.primaryForeground),
                              )
                            : null,
                        suffix: primary.amount == null
                            ? null
                            : Text(money(context, primary.amount!),
                                style: theme.type.mainAction.copyWith(fontFeatures: tabular)),
                        child: Text(primary.label, style: theme.type.mainAction),
                      ),
                    ),
              ],
            ),
          ),
        ],
      ),
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

/// Money off the bill, said over its total where it is taken off: how much
/// (the percent when it was one), and a tap to change it or take it away.
/// Why and by whom is the discount pop-up's to say.
class _DiscountRow extends StatelessWidget {
  final TicketDetail ticket;

  const _DiscountRow({required this.ticket});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final emerald = AppColors.emerald(theme.colors.brightness);
    final rate = ticket.discountRate;
    final percent = rate == null ? null : (rate * 10000).round() / 100;
    final label = percent == null
        ? l10n.discount
        : '${l10n.discount} ${percent == percent.roundToDouble() ? percent.toInt() : percent}%';
    final style = theme.type.detail.copyWith(color: emerald);
    final row = Container(
      constraints: const BoxConstraints(minHeight: Sizes.control),
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        color: emerald.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(Sizes.radius),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(label,
                maxLines: 1, overflow: TextOverflow.ellipsis, style: style.copyWith(fontWeight: FontWeight.w500)),
          ),
          Text('−${money(context, ticket.discount)}',
              style: style.copyWith(fontWeight: FontWeight.w600, fontFeatures: const [FontFeature.tabularFigures()])),
          if (ticket.isOpen) ...[
            const SizedBox(width: 8),
            Icon(FIcons.chevronRight,
                size: Sizes.iconSmall, color: emerald),
          ],
        ],
      ),
    );
    if (!ticket.isOpen) return row;
    return Semantics(
      button: true,
      child: FTappable(onPress: () => showDiscountDialog(context, ticket), child: row),
    );
  }
}

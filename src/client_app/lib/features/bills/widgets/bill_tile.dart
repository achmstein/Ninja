import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme_provider.dart';
import '../../../core/ui/ui.dart';
import 'package:intl/intl.dart';
import '../../../core/models/localized_text.dart';
import '../../../core/providers/locale_provider.dart';
import '../../../core/widgets/app_text.dart';
import '../../../l10n/app_localizations.dart';
import '../../../core/utils/money.dart';
import '../../orders/models/order.dart';
import '../../places/models/place.dart';
import '../../pay/widgets/pay_bill_bar.dart';
import '../../places/services/place_service.dart';
import '../models/bill.dart';
import '../models/bill_math.dart';
import '../services/bills_service.dart';
import 'bill_slip.dart';
import '../../receipts/screens/receipt_screen.dart' show BillReceipt;
import 'bill_stars.dart';

/// A round on its way to a bill: sent and waiting for the staff, or
/// confirmed and about to be put on it
class PendingRound {
  final Order order;

  /// Confirmed: the till is putting it on the bill
  final bool adding;

  const PendingRound(this.order, {required this.adding});
}

/// The rounds on their way, each put with the open bill it will land on
/// (client_web's live-bills.ts): the one at the same place, else the first
/// open one. With no open bill they are left out, for the page to show them
/// on their own.
Map<int, List<PendingRound>> placeRounds(List<Bill> bills, List<Order> orders) {
  final byBill = <int, List<PendingRound>>{};
  final open = bills.where((b) => b.isOpen).toList();
  if (open.isEmpty) return byBill;
  // On any bill, open or closed: only the ones on none are still being added
  final onBills = {for (final bill in bills) for (final line in bill.lines) line.orderId};
  final rounds = [
    for (final order in orders)
      if (order.status != OrderStatus.confirmed && order.status != OrderStatus.cancelled)
        PendingRound(order, adding: false)
      // Confirmed, but the bill has not caught up yet
      else if (order.status == OrderStatus.confirmed && !onBills.contains(order.id) && order.ticketId == null)
        PendingRound(order, adding: true),
  ]..sort((x, y) => y.order.date.compareTo(x.order.date));
  for (final round in rounds) {
    final bill = open.where((b) => b.locationName != null && b.locationName == round.order.placeName).firstOrNull ?? open.first;
    (byBill[bill.id] ??= []).add(round);
  }
  return byBill;
}

/// One round of a bill: the lines that came in one order (newest first), or a line on its own
class _Round {
  final String key;
  final DateTime? at;
  final List<BillLine> lines;

  /// The till put it on the bill without a name: there, but not read as theirs
  final bool unnamed;

  const _Round({required this.key, required this.at, required this.lines, required this.unnamed});
}

/// The customer's own lines, and the ones nobody's name is on, by the order they came in, newest first
List<_Round> _roundsOf(Iterable<BillLine> lines, Map<int, Order>? ordersById) {
  final byOrder = <String, ({DateTime? at, List<BillLine> lines, bool unnamed})>{};
  for (final line in lines) {
    final key = line.orderId != null ? 'o${line.orderId}' : 'l${line.id}';
    final orderId = line.orderId;
    final at = orderId == null || ordersById == null ? null : ordersById[orderId]?.date;
    final round = byOrder[key] ?? (at: at, lines: <BillLine>[], unnamed: true);
    round.lines.add(line);
    byOrder[key] = (at: round.at, lines: round.lines, unnamed: round.unnamed && line.isUnassigned);
  }
  return [for (final e in byOrder.entries) _Round(key: e.key, at: e.value.at, lines: e.value.lines, unnamed: e.value.unnamed)].reversed.toList();
}

/// A bill as a stack of its rounds (client_web's bill-card.tsx). The total
/// sits on top and rolls to each new value; a tap fans the stack open to
/// every round and what the till added to them, and folds it back. An open
/// bill is the dock's dark slab with the way to pay under it, its stack
/// standing open; a closed one is a light card, with the stars once paid.
class BillTile extends ConsumerStatefulWidget {
  final Bill bill;

  /// Today's orders by number: when each round was sent, and the stars on a paid bill
  final Map<int, Order>? ordersById;

  /// Rounds on their way to this bill, shown faint on top of its stack
  final List<PendingRound> pending;

  /// The bill forming out of orders the till has no bill for yet: no receipt and nothing to pay
  final bool forming;

  const BillTile({super.key, required this.bill, this.ordersById, this.pending = const [], this.forming = false});

  @override
  ConsumerState<BillTile> createState() => _BillTileState();
}

class _BillTileState extends ConsumerState<BillTile> {
  late bool _fanned = widget.bill.isOpen;

  /// The receipt printed out inside the card, under its button
  bool _paper = false;

  @override
  Widget build(BuildContext context) {
    final bill = widget.bill;
    final l10n = AppLocalizations.of(context)!;
    final locale = ref.watch(localeProvider);
    final now = ref.watch(minuteClockProvider).value ?? DateTime.now();
    final money = ref.watch(moneyProvider);
    final stays = ref.watch(myStaysProvider).value ?? const <Stay>[];
    // The stay this bill charges the time of, for its roster
    final stay = bill.sessionId == null ? null : stays.where((s) => s.id == bill.sessionId).firstOrNull;
    final running = runningTime(bill, activeStayOf(ref), now);
    final parts = billParts(bill, running, stay);
    final place = bill.locationName?.localized(context);
    final opened = DateFormat('h:mm a', locale.languageCode).format(bill.openedAt.toLocal());
    final time = bill.lines.where((line) => line.isTime).toList();
    final rounds = _roundsOf(bill.lines.where((line) => (line.isMine || line.isUnassigned) && !line.isTime), widget.ordersById);
    final hasTime = time.isNotEmpty || running != null;
    final open = bill.isOpen;
    final approx = running != null ? '≈ ' : '';

    final card = Builder(
      builder: (context) {
        // On the slab (an open bill) the inks are the slab's
        final theme = context.theme;
        final c = theme.colors;
        final small = context.localeText(theme.typography.caption.copyWith(color: c.mutedForeground));
        // A round's own fill: a touch lighter than the slab, or the page's muted on a light card
        final fill = open ? Color.lerp(c.background, c.foreground, 0.09)! : c.background;
        Widget row(String label, String value, {TextStyle? style}) => Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                Expanded(child: Text(label, style: style ?? small)),
                const SizedBox(width: 8),
                Text(value, style: (style ?? small).copyWith(fontFeatures: NinjaTypography.tabular)),
              ],
            );
        Widget shell(List<Widget> children) => Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: fill, borderRadius: BorderRadius.circular(Ninja.tileRadius)),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: children),
            );
        // One on its way: an outline, its order's lines faint, and where it has got to
        Widget pendingCard(PendingRound round) => Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(Ninja.tileRadius),
                border: Border.all(color: c.foreground.withValues(alpha: 0.3), width: 1.5),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(DateFormat('h:mm a', locale.languageCode).format(round.order.date.toLocal()), style: small.copyWith(fontWeight: FontWeight.w600)),
                      const Spacer(),
                      Container(width: 6, height: 6, decoration: const BoxDecoration(color: Color(0xFFF59E0B), shape: BoxShape.circle)),
                      const SizedBox(width: 6),
                      Flexible(
                        child: Text(
                          round.adding ? l10n.addingToBill : l10n.waitingToBeConfirmed,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: small.copyWith(fontWeight: FontWeight.w700, color: const Color(0xFFF59E0B)),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Opacity(
                    opacity: 0.6,
                    child: Column(
                      children: [
                        for (final (i, item) in round.order.items.indexed)
                          _BillLine(
                            line: BillLine(
                              id: -i - 1,
                              source: 'Order',
                              orderId: round.order.id,
                              description: item.productName,
                              details: item.customizationsDescription,
                              qty: item.units.toDouble(),
                              unitPrice: item.unitPrice,
                              discount: 0,
                              total: item.unitPrice * item.units,
                              isMine: true,
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            );
        final cards = <Widget>[
          for (final round in widget.pending) pendingCard(round),
          for (final round in rounds)
            shell([
              if (round.at != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Text(
                    DateFormat('h:mm a', locale.languageCode).format(round.at!.toLocal()),
                    style: small.copyWith(fontWeight: FontWeight.w600),
                  ),
                ),
              Opacity(opacity: round.unnamed ? 0.6 : 1, child: Column(children: [for (final line in round.lines) _BillLine(line: line)])),
            ]),
          if (hasTime) shell([for (final line in time) _BillLine(line: line), if (running != null) RunningTimeLine(bill: bill, running: running)]),
        ];
        final edge = BorderRadius.vertical(bottom: Radius.circular(Ninja.tileRadius * 0.7));

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Where and when, and what the till did with it
            Row(
              children: [
                if (bill.placeId != null && bill.placeKind != null) ...[
                  Icon(bill.placeKind!.icon, size: 16, color: c.mutedForeground),
                  const SizedBox(width: 6),
                ],
                // The place and the time take the room, the badge stands at the end: a Flexible beside a
                // Spacer split that room in two and left the badge in the middle
                Expanded(
                  child: Row(
                    children: [
                      Flexible(
                        child: Text(
                          place == null || place.isEmpty ? l10n.atTheCounter : place,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: small.copyWith(fontWeight: FontWeight.w600),
                        ),
                      ),
                      Text(' · $opened', style: small.copyWith(fontWeight: FontWeight.w600)),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                _StatusChip(bill: bill),
              ],
            ),
            const SizedBox(height: 16),
            // The total, large; with somebody else's rounds on it, the customer's own; how many rounds, to open them
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: Opacity(
                    opacity: bill.isVoided ? 0.5 : 1,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(parts.shared ? l10n.yourRounds : l10n.total, style: small),
                        RollingNumber(
                          '$approx${money(parts.shared ? parts.ownLines : parts.total)}',
                          value: parts.shared ? parts.ownLines : parts.total,
                          style: context.localeText(theme.typography.display.copyWith(
                            fontWeight: FontWeight.w800,
                            color: c.foreground,
                            decoration: bill.isVoided ? TextDecoration.lineThrough : null,
                          )),
                        ),
                      ],
                    ),
                  ),
                ),
                if (cards.isNotEmpty)
                  Pressable(
                    onTap: () => setState(() => _fanned = !_fanned),
                    scale: 0.95,
                    child: Container(
                      // With a count, the words then the chevron; with none (only the place's time on it), the
                      // chevron alone, centred in a round button rather than left where the words would end
                      height: 32,
                      constraints: const BoxConstraints(minWidth: 32),
                      padding: rounds.length + widget.pending.length > 0 ? const EdgeInsetsDirectional.fromSTEB(12, 0, 8, 0) : EdgeInsets.zero,
                      alignment: Alignment.center,
                      decoration: ShapeDecoration(color: c.muted, shape: const StadiumBorder()),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (rounds.length + widget.pending.length > 0) ...[
                            Text(l10n.ninjaRoundCount(rounds.length + widget.pending.length), style: small.copyWith(fontWeight: FontWeight.w600, color: c.foreground)),
                            const SizedBox(width: 4),
                          ],
                          AnimatedRotation(
                            turns: _fanned ? 0.5 : 0,
                            duration: Motion.base,
                            curve: Motion.enter,
                            child: Icon(LucideIcons.chevronDown, size: 16, color: c.foreground),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
            if (cards.isNotEmpty) ...[
              const SizedBox(height: 16),
              GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => setState(() => _fanned = !_fanned),
                child: AnimatedSize(
                  duration: Motion.slow,
                  curve: Motion.enter,
                  alignment: Alignment.topCenter,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // The newest round in full
                      cards.first,
                      // Closed: the rounds behind it show as edges under it, and nothing of what is on them
                      if (!_fanned && cards.length > 1) ...[
                        Container(
                          height: 8,
                          margin: const EdgeInsets.symmetric(horizontal: 12),
                          decoration: BoxDecoration(color: fill.withValues(alpha: 0.7), borderRadius: edge),
                        ),
                        if (cards.length > 2)
                          Container(
                            height: 6,
                            margin: const EdgeInsets.symmetric(horizontal: 24),
                            decoration: BoxDecoration(color: fill.withValues(alpha: 0.4), borderRadius: edge),
                          ),
                      ],
                      // Open: the rest one under the other
                      if (_fanned)
                        for (final card in cards.skip(1)) Padding(padding: const EdgeInsets.only(top: 8), child: card),
                    ],
                  ),
                ),
              ),
            ],
            // What the till added, and the whole bill's total when others are on it: with the stack open
            AnimatedSize(
              duration: Motion.slow,
              curve: Motion.enter,
              alignment: Alignment.topCenter,
              child: !_fanned
                  ? const SizedBox(width: double.infinity)
                  : Padding(
                      padding: const EdgeInsets.only(top: 12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          if (!parts.shared && bill.discount > 0)
                            row('${l10n.discount}${bill.discountRate != null ? ' ${percent(bill.discountRate)}%' : ''}', '−${money(bill.discount)}'),
                          if (!parts.shared && bill.serviceCharge > 0)
                            row(l10n.serviceCharge(percent(bill.serviceChargeRate).toString()), money(bill.serviceCharge)),
                          if (!parts.shared && bill.vat > 0 && !bill.vatIncluded) row(l10n.vat(percent(bill.vatRate).toString()), money(bill.vat)),
                          if (parts.shared) row(l10n.billTotal, '$approx${money(parts.total)}'),
                          if (bill.refundedTotal > 0) row(l10n.refunded, '−${money(bill.refundedTotal)}', style: small.copyWith(color: c.destructive)),
                          if (!widget.forming) ...[
                            const SizedBox(height: 8),
                            NinjaButton(
                              variant: NinjaButtonVariant.secondary,
                              size: NinjaButtonSize.sm,
                              prefix: const Icon(LucideIcons.receiptText, size: 16),
                              onPress: () => setState(() => _paper = !_paper),
                              child: BlurSwap(
                                alignment: Alignment.center,
                                child: Text(_paper ? l10n.ninjaHideReceipt : l10n.ninjaOpenBill, key: ValueKey(_paper)),
                              ),
                            ),
                            // The receipt, printed out inside the card under its button rather than a page of its own
                            AnimatedSize(
                              duration: Motion.slow,
                              curve: Motion.enter,
                              alignment: Alignment.topCenter,
                              child: !_paper
                                  ? const SizedBox(width: double.infinity)
                                  // Printed out from under the button, then brought into view
                                  : Reveal(
                                      child: Padding(
                                        padding: const EdgeInsets.fromLTRB(4, 12, 4, 12),
                                        child: DecoratedBox(
                                          decoration: const BoxDecoration(
                                            boxShadow: [BoxShadow(color: Color(0x1F000000), blurRadius: 6, offset: Offset(0, 2))],
                                          ),
                                          child: BillReceipt(ticketId: bill.id, bill: bill),
                                        ),
                                      ),
                                    ),
                            ),
                          ],
                        ],
                      ),
                    ),
            ),
          ],
        );
      },
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // An open bill is the dock's dark slab; a closed one a light panel
        open ? SlabCard(child: card) : Panel(padding: const EdgeInsets.all(20), child: card),
        // Paying from the phone, where the business takes it: under the slab
        if (open && !widget.forming) PayBillBar(ticketId: bill.id),
        // A paid bill is the thanks: the stars for the rounds on it
        if (bill.isSettled && widget.ordersById != null)
          Padding(padding: const EdgeInsets.symmetric(horizontal: 8), child: BillStars(bill: bill, ordersById: widget.ordersById!)),
      ],
    );
  }
}

/// What the till did with the bill: paid (and on which receipt), on the customer's tab, voided, or still open
class _StatusChip extends StatelessWidget {
  final Bill bill;

  const _StatusChip({required this.bill});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final theme = context.theme;
    final c = theme.colors;
    final (Color fill, Color ink, String label, bool dot) = bill.isVoided
        ? (c.muted, c.mutedForeground, l10n.voided, false)
        : !bill.isSettled
            ? (NinjaColors.warning.withValues(alpha: 0.15), const Color(0xFFF59E0B), l10n.unpaid, true)
            : (
                NinjaColors.success.withValues(alpha: 0.12),
                c.brightness == Brightness.dark ? NinjaColors.success : const Color(0xFF059669),
                '${bill.paidWith == 'Account' ? l10n.onYourTab : l10n.paid}${bill.receiptNumber != null ? ' ${l10n.receiptShort(bill.receiptNumber!)}' : ''}',
                false,
              );
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: ShapeDecoration(color: fill, shape: const StadiumBorder()),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (dot) ...[Container(width: 6, height: 6, decoration: BoxDecoration(color: ink, shape: BoxShape.circle)), const SizedBox(width: 6)],
          Text(label, style: context.localeText(theme.typography.caption.copyWith(fontWeight: FontWeight.w700, color: ink, fontFeatures: NinjaTypography.tabular))),
        ],
      ),
    );
  }
}

/// One of the customer's own lines, or the place's time, whole. A round the
/// till named nobody for is muted: on the bill, but not read as theirs.
class _BillLine extends ConsumerWidget {
  final BillLine line;

  const _BillLine({required this.line});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final colors = context.theme.colors;
    final money = ref.watch(moneyProvider);
    final details = line.details?.localized(context);
    final ink = line.isUnassigned ? colors.mutedForeground : colors.foreground;

    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              if (line.isTime)
                Icon(LucideIcons.timer, size: 14, color: colors.mutedForeground)
              else
                AppText('${hoursOf(line.qty)}x', style: TextStyle(fontSize: 14, color: colors.mutedForeground)),
              const SizedBox(width: 4),
              Expanded(
                child: AppText(line.description.localized(context), style: TextStyle(fontSize: 14, color: ink)),
              ),
              const SizedBox(width: 8),
              AppText(
                money(line.total),
                style: TextStyle(fontSize: 14, color: ink, fontFeatures: const [FontFeature.tabularFigures()]),
              ),
            ],
          ),
          if (line.isTime)
            Padding(
              padding: const EdgeInsetsDirectional.only(start: 24),
              child: AppText(
                '${l10n.hoursShort(line.qty)} × ${money(line.unitPrice)}${l10n.perHourShort}',
                style: TextStyle(
                    fontSize: 12, color: colors.mutedForeground, fontFeatures: const [FontFeature.tabularFigures()]),
              ),
            )
          else if (details != null && details.isNotEmpty)
            Padding(
              padding: const EdgeInsetsDirectional.only(start: 24),
              child: AppText(details, style: TextStyle(fontSize: 12, color: colors.mutedForeground)),
            ),
        ],
      ),
    );
  }
}

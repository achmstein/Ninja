import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import '../../../core/widgets/app_text.dart';
import '../../../l10n/app_localizations.dart';
import '../../orders/models/order.dart';
import '../../orders/widgets/rating_dialog.dart';
import '../../orders/widgets/rating_widget.dart';
import '../models/bill.dart';

/// The rating, on the paid bill: one row of stars for the customer's own
/// rounds on it. A tap on a star opens the rating sheet with that star
/// chosen and room for a word; the sheet rates every round of theirs the
/// bill covered. Rated already, it shows what they gave.
class BillStars extends ConsumerStatefulWidget {
  final Bill bill;
  final Map<int, Order> ordersById;

  const BillStars({super.key, required this.bill, required this.ordersById});

  @override
  ConsumerState<BillStars> createState() => _BillStarsState();
}

class _BillStarsState extends ConsumerState<BillStars> {
  bool _done = false;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final colors = context.theme.colors;
    final mine = widget.bill.lines
        .where((line) => line.isMine && line.orderId != null)
        .map((line) => widget.ordersById[line.orderId!])
        .whereType<Order>()
        .toSet()
        .toList();
    if (mine.isEmpty) return const SizedBox.shrink();

    if (_done) {
      return Padding(
        padding: const EdgeInsets.only(top: 4),
        child: AppText(l10n.ratedThanks, style: TextStyle(fontSize: 13, color: colors.mutedForeground)),
      );
    }

    final unrated = mine.where((order) => order.ratingValue == null).toList();
    if (unrated.isEmpty) {
      return Padding(
        padding: const EdgeInsets.only(top: 4),
        child: Row(
          children: [
            AppText(l10n.yourRating, style: TextStyle(fontSize: 13, color: colors.mutedForeground)),
            StarRating(rating: mine.first.ratingValue ?? 0, size: 16, inactiveColor: colors.mutedForeground),
          ],
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Row(
        children: [
          AppText(l10n.howWasIt, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: colors.foreground)),
          const SizedBox(width: 8),
          StarRating(
            rating: 0,
            size: 22,
            inactiveColor: colors.mutedForeground.withValues(alpha: 0.4),
            onRatingChanged: (value) async {
              final rated = await showRatingDialog(
                context: context,
                ref: ref,
                orderIds: unrated.map((order) => order.id).toList(),
                initialRating: value,
              );
              if (rated && mounted) setState(() => _done = true);
            },
          ),
        ],
      ),
    );
  }
}

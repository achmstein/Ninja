import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/models/localized_text.dart';
import 'package:ninja_app_core/theme/app_theme.dart';
import 'package:ninja_app_core/theme/text_styles.dart';
import '../../../core/models/money.dart';
import '../../../core/widgets/pos_dialog.dart';
import '../../../l10n/app_localizations.dart';
import '../services/price_check_service.dart';

/// What the cashier does with the other branch's menu
enum PriceReviewChoice {
  /// Send it at that branch's prices, without what it ran out of
  useTheirs,

  /// Make and deliver it here after all
  keepHere,
}

/// Before a phone delivery goes to another branch: what that branch's menu
/// says differently, line by line ("Latte 65 → 70 at Maadi", "Cheesecake:
/// sold out at Maadi"). Null when the cashier closed it without choosing.
Future<PriceReviewChoice?> showPriceReviewDialog(BuildContext context, PriceReview review, String branch) =>
    showPosDialog<PriceReviewChoice>(
      context,
      builder: (_) => _PriceReview(review: review, branch: branch),
    );

class _PriceReview extends StatelessWidget {
  final PriceReview review;
  final String branch;

  const _PriceReview({required this.review, required this.branch});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final amber = AppColors.amber(theme.colors.brightness);
    final nothingLeft = review.lines.isEmpty;
    final drops = review.items.any((i) => i.kind != PriceReviewKind.changed);
    void close(PriceReviewChoice choice) => Navigator.of(context, rootNavigator: true).pop(choice);

    String describe(PriceReviewItem item) {
      final name = item.line.name.localized(context);
      return switch (item.kind) {
        PriceReviewKind.changed => l10n.priceReviewChanged(name, money(context, item.from), money(context, item.to), branch),
        PriceReviewKind.soldOut => l10n.priceReviewSoldOut(name, branch),
        PriceReviewKind.optionsOut => l10n.priceReviewOptionsOut(
            name,
            [
              for (final c in item.line.customizations)
                if (item.optionIds.contains(c.optionId)) c.optionName.localized(context),
            ].join(l10n.listSeparator),
            branch,
          ),
      };
    }

    return DialogScroll(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(l10n.priceReviewTitle(branch), style: theme.typography.xl.copyWith(fontWeight: FontWeight.w600)),
          if (drops && !nothingLeft) ...[
            const SizedBox(height: 4),
            Text(l10n.priceReviewDropped, style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground)),
          ],
          const SizedBox(height: 12),
          for (final item in review.items)
            Container(
              margin: const EdgeInsets.only(bottom: 6),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              decoration: BoxDecoration(color: theme.colors.muted, borderRadius: BorderRadius.circular(8)),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (item.kind != PriceReviewKind.changed) ...[
                    Icon(FIcons.triangleAlert, size: 16, color: amber),
                    const SizedBox(width: 6),
                  ],
                  Expanded(
                    child: Text(describe(item),
                        style: theme.typography.sm.copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
                  ),
                ],
              ),
            ),
          if (nothingLeft) ...[
            const SizedBox(height: 6),
            Text(l10n.priceReviewNothingLeft(branch), style: theme.typography.sm.copyWith(color: amber)),
          ],
          const SizedBox(height: 16),
          SizedBox(
            height: 52,
            child: FButton(
              onPress: nothingLeft ? null : () => close(PriceReviewChoice.useTheirs),
              child: Text(l10n.priceReviewUse(branch), style: theme.typography.base.forButton),
            ),
          ),
          const SizedBox(height: 8),
          SizedBox(
            height: 52,
            child: FButton(
              variant: FButtonVariant.outline,
              onPress: () => close(PriceReviewChoice.keepHere),
              child: Text(l10n.deliveryKeepHere, style: theme.typography.base.forButton),
            ),
          ),
        ],
      ),
    );
  }
}

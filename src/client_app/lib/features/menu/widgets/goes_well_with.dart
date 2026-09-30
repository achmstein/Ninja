import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import '../../../core/providers/locale_provider.dart';
import '../../../core/utils/money.dart';
import '../../../core/widgets/app_text.dart';
import '../../../l10n/app_localizations.dart';
import '../../cart/services/cart_service.dart';
import '../models/menu_item.dart';
import '../paired_items.dart';
import 'item_customization_sheet.dart';

/// What goes well with an item, on its sheet: a small card each, in the
/// business's order, sideways when there are more than fit. A tap puts one
/// with nothing to choose straight in the cart (its card then leaves the
/// row, being in the cart), or opens one that asks a question first.
class GoesWellWith extends ConsumerWidget {
  final MenuItem item;

  const GoesWellWith({super.key, required this.item});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final suggestions = pairedFor(item, ref.watch(menuByIdProvider), ref.watch(cartProvider).items).take(maxOnSheet).toList();
    if (suggestions.isEmpty) return const SizedBox.shrink();

    final colors = context.theme.colors;
    final l10n = AppLocalizations.of(context)!;
    return Padding(
      padding: const EdgeInsets.only(bottom: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AppText(
            l10n.goesWellWith,
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: colors.foreground),
          ),
          const SizedBox(height: 8),
          SizedBox(
            height: 150,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: suggestions.length,
              separatorBuilder: (_, _) => const SizedBox(width: 10),
              itemBuilder: (context, i) => _SuggestionCard(item: suggestions[i]),
            ),
          ),
        ],
      ),
    );
  }
}

class _SuggestionCard extends ConsumerWidget {
  final MenuItem item;

  const _SuggestionCard({required this.item});

  void _pick(BuildContext context, WidgetRef ref) {
    if (canQuickAdd(item)) {
      HapticFeedback.selectionClick();
      ref.read(cartProvider.notifier).addItem(suggestedLine(item, 'Pairing'));
      return;
    }
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useRootNavigator: true,
      backgroundColor: Colors.transparent,
      barrierColor: Colors.black.withValues(alpha: 0.5),
      builder: (context) => ItemCustomizationSheet(item: item, suggestion: 'Pairing'),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.theme.colors;
    final l10n = AppLocalizations.of(context)!;
    final money = ref.watch(moneyProvider);
    final name = item.name.getText(ref.watch(localeProvider));
    final placeholder = Container(
      color: colors.muted,
      child: Icon(FIcons.utensilsCrossed, color: colors.mutedForeground),
    );

    return Semantics(
      button: true,
      label: l10n.addSuggestion(name),
      child: GestureDetector(
        onTap: () => _pick(context, ref),
        child: Container(
          width: 132,
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(
            color: colors.secondary,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                height: 88,
                width: double.infinity,
                child: item.pictureUri != null
                    ? CachedNetworkImage(
                        imageUrl: item.pictureUri!,
                        fit: BoxFit.cover,
                        placeholder: (context, url) => Container(color: colors.muted),
                        errorWidget: (context, url, error) => placeholder,
                      )
                    : placeholder,
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            AppText(
                              name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: colors.foreground),
                            ),
                            AppText(
                              money(item.effectivePrice),
                              style: TextStyle(fontSize: 12, color: colors.mutedForeground),
                            ),
                          ],
                        ),
                      ),
                      Container(
                        width: 26,
                        height: 26,
                        decoration: BoxDecoration(color: colors.primary, shape: BoxShape.circle),
                        child: Icon(FIcons.plus, size: 16, color: colors.primaryForeground),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

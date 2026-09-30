import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/ui/ui.dart';
import '../../../core/providers/locale_provider.dart';
import '../../../core/utils/money.dart';
import '../../../core/widgets/app_text.dart';
import '../../../l10n/app_localizations.dart';
import '../../menu/paired_items.dart';
import '../services/cart_service.dart';

/// The customer said "not now": nothing more is suggested until the cart is emptied.
class NotNowNotifier extends Notifier<bool> {
  @override
  bool build() {
    // A new order may be offered one again
    ref.listen(cartProvider, (_, cart) {
      if (cart.isEmpty && state) state = false;
    });
    return false;
  }

  void say() => state = true;
}

final notNowProvider = NotifierProvider<NotNowNotifier, bool>(NotNowNotifier.new);

/// The one thing the cart suggests, under its items: what goes well with the
/// item added last ("Add a waffle?"), in with one tap and its defaults, or
/// "not now". Asked once an order: either answer ends it, and nothing takes
/// its place. Only items with nothing to choose are offered here.
class CartNudge extends ConsumerWidget {
  const CartNudge({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final offer = ref.watch(notNowProvider) ? null : cartNudge(ref.watch(cartProvider).items, ref.watch(menuByIdProvider));
    if (offer == null) return const SizedBox.shrink();

    final colors = context.theme.colors;
    final l10n = AppLocalizations.of(context)!;
    final money = ref.watch(moneyProvider);
    final name = offer.name.getText(ref.watch(localeProvider));

    // In the open order, on the slab: a soft fill of its ink
    return Container(
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: colors.foreground.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(Ninja.tileRadius),
      ),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: SizedBox(
              width: 44,
              height: 44,
              child: offer.pictureUri != null
                  ? CachedNetworkImage(
                      imageUrl: offer.pictureUri!,
                      fit: BoxFit.cover,
                      placeholder: (context, url) => Container(color: colors.muted),
                      errorWidget: (context, url, error) => Container(color: colors.muted),
                    )
                  : Container(color: colors.muted, child: Icon(LucideIcons.utensilsCrossed, size: 18, color: colors.mutedForeground)),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                AppText(
                  l10n.addSuggestion(name),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontWeight: FontWeight.w600, color: colors.foreground),
                ),
                AppText(
                  money(offer.effectivePrice),
                  style: TextStyle(fontSize: 12, color: colors.foreground.withValues(alpha: 0.6)),
                ),
              ],
            ),
          ),
          NinjaIconButton(
            size: 36,
            variant: NinjaButtonVariant.ghost,
            semanticLabel: l10n.notNow,
            onPress: () => ref.read(notNowProvider.notifier).say(),
            child: const Icon(LucideIcons.x),
          ),
          const SizedBox(width: 4),
          NinjaIconButton(
            variant: NinjaButtonVariant.primary,
            semanticLabel: l10n.addSuggestion(name),
            onPress: () {
              HapticFeedback.selectionClick();
              ref.read(cartProvider.notifier).addItem(suggestedLine(offer, 'CartNudge'));
            },
            child: const Icon(LucideIcons.plus),
          ),
        ],
      ),
    );
  }
}

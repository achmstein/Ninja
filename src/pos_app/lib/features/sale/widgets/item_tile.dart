import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import '../../../core/models/localized_text.dart';
import '../../../core/models/money.dart';
import '../../catalog/models/catalog_item.dart';

/// A menu item's picture, or the same default the customer app shows when
/// it has none or the file fails to load: the utensils mark on a muted box.
class ItemImage extends StatelessWidget {
  final String? url;

  const ItemImage({super.key, this.url});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final fallback = ColoredBox(
      color: theme.colors.muted,
      child: Center(child: Icon(FIcons.utensils, size: 32, color: theme.colors.mutedForeground)),
    );
    if (url == null) return fallback;
    return CachedNetworkImage(
      imageUrl: url!,
      fit: BoxFit.cover,
      placeholder: (_, _) => ColoredBox(color: theme.colors.muted),
      errorWidget: (_, _, _) => fallback,
    );
  }
}

/// One tile on the pad: the picture, the name and the price. Sold-out
/// items stay in place, dimmed and untappable.
class ItemTile extends StatelessWidget {
  final CatalogItem item;
  final VoidCallback onTap;

  const ItemTile({super.key, required this.item, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final available = item.isAvailable;

    return Opacity(
      opacity: available ? 1 : 0.4,
      child: FTappable(
        onPress: available ? onTap : null,
        builder: (context, states, child) => Container(
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(
            color: theme.colors.background,
            border: Border.all(color: theme.colors.border),
            borderRadius: BorderRadius.circular(14),
          ),
          transform: states.contains(FTappableVariant.pressed) ? (Matrix4.identity()..scaleByDouble(0.98, 0.98, 1, 1)) : null,
          transformAlignment: Alignment.center,
          child: child,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AspectRatio(aspectRatio: 1, child: ItemImage(url: item.pictureUrl)),
            Padding(
              padding: const EdgeInsets.all(8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.name.localized(context),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: theme.typography.sm.copyWith(fontWeight: FontWeight.w500, height: 1.25),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    money(context, item.unitPrice),
                    style: theme.typography.sm.copyWith(
                      color: theme.colors.mutedForeground,
                      fontFeatures: const [FontFeature.tabularFigures()],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

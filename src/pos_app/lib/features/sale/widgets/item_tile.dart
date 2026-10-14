import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/models/localized_text.dart';
import '../../../core/models/money.dart';
import '../../../core/utils/bidi.dart';
import '../../catalog/models/catalog_item.dart';
import '../category_colour.dart';

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

/// The compact pad's tile, for a long menu: the name (two lines at most) and
/// the price, no picture, and the category's colour down the start edge.
/// Sold-out items stay in place, dimmed and untappable, as on the photo pad.
/// A Latin name in an Arabic till is laid out in its own direction and
/// pinned to the line's start, so it reads and truncates as written.
class CompactItemTile extends StatelessWidget {
  final CatalogItem item;
  final VoidCallback onTap;

  const CompactItemTile({super.key, required this.item, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final available = item.isAvailable;
    final name = item.name.localized(context);
    const radius = Radius.circular(10);

    return Opacity(
      opacity: available ? 1 : 0.4,
      child: FTappable(
        onPress: available ? onTap : null,
        builder: (context, states, child) => Container(
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(
            color: theme.colors.background,
            border: Border.all(color: theme.colors.border),
            borderRadius: const BorderRadius.all(radius),
          ),
          transform: states.contains(FTappableVariant.pressed) ? (Matrix4.identity()..scaleByDouble(0.98, 0.98, 1, 1)) : null,
          transformAlignment: Alignment.center,
          child: child,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // The start edge: the right one in an Arabic till
            ColoredBox(color: categoryColour(item.catalogTypeId), child: const SizedBox(width: 4)),
            Expanded(
              child: Padding(
                padding: const EdgeInsetsDirectional.fromSTEB(8, 6, 8, 6),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    // Gives way before the price does, should a large text size leave less room
                    Flexible(
                      child: Text(
                        name,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        textDirection: textDirectionFor(name),
                        textAlign: textAlignFor(context),
                        style: theme.typography.sm.copyWith(fontWeight: FontWeight.w500, height: 1.2),
                      ),
                    ),
                    Text(
                      money(context, item.unitPrice),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.typography.sm.copyWith(
                        color: theme.colors.mutedForeground,
                        fontFeatures: const [FontFeature.tabularFigures()],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

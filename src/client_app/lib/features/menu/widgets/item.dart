import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/brand/brand_style.dart';
import '../../../core/brand/styles.dart';
import '../../../core/motion/motion.dart';
import '../../../core/providers/branch_provider.dart';
import '../../../core/providers/locale_provider.dart';
import '../../../core/theme/theme_provider.dart';
import '../../../core/ui/ui.dart';
import '../../../core/utils/money.dart';
import '../../../l10n/app_localizations.dart';
import '../../cart/services/cart_service.dart';
import '../../cart/widgets/tray_flights.dart';
import '../models/menu_item.dart';
import '../paired_items.dart';
import '../services/menu_service.dart';
import 'deck.dart';
import 'hold.dart';
import 'item_view.dart';

/// Opens an item's options, grown out of its photo when it is on screen
void openItem(BuildContext context, MenuItem item, {String? suggestion}) => showItemView(context, item, suggestion: suggestion);

/// An item in the tray straight away (the plus, a held press): with its
/// defaults when nothing needs choosing, else its options open instead.
/// Nothing goes in while ordering is paused or the item is sold out; the
/// island says why.
void quickAdd(BuildContext context, WidgetRef ref, MenuItem item) {
  final l10n = AppLocalizations.of(context)!;
  final ordering = ref.read(branchProvider).selectedBranch?.isOrderingEnabled ?? true;
  if (!ordering) {
    showIsland(
      title: Text(l10n.orderingUnavailable),
      icon: const Icon(LucideIcons.circlePause, color: NinjaColors.warning),
    );
    return;
  }
  if (!item.isAvailable) {
    showIsland(
      title: Text(l10n.ninjaSoldOut(item.name.getText(ref.read(localeProvider)))),
      icon: const Icon(LucideIcons.circleSlash, color: NinjaColors.warning),
    );
    return;
  }
  final preference = ref.read(itemPreferenceProvider(item.id));
  if (!canQuickAdd(item, preference)) {
    openItem(context, item);
    return;
  }
  HapticFeedback.selectionClick();
  // Its photo flies into the tray, and the item goes in as it lands
  final from = ItemPhotos.find(item.id);
  trayFlights.fly(
    from: from?.rect,
    radius: from?.radius ?? 20,
    photo: item.pictureUri,
    reduced: reduceMotion(context),
    land: () => ref.read(cartProvider.notifier).addItem(quickAddLine(item, preference)),
  );
}

/// Each menu style's item on the page of items (client_web's list/items.ts);
/// the deck's cards zoomed out, and the tiles, are small tiles
Widget itemFor(MenuItemLayout layout, MenuItem item) => switch (layout) {
  MenuItemLayout.row => ItemRow(item: item),
  MenuItemLayout.card => ItemPhotoTile(item: item),
  MenuItemLayout.compact => ItemCompactRow(item: item),
  MenuItemLayout.hero => ItemHeroCard(item: item),
  MenuItemLayout.deck || MenuItemLayout.tiles => ZoomTile(item: item),
};

/// An item's name in a list: the heading's family at 16 px, bold rather than
/// the heading's extra bold, so a column of names reads as items under the
/// category, not as a stack of titles
TextStyle itemName(BuildContext context) {
  final style = BrandStyle.of(context);
  final theme = context.theme;
  final base = theme.typography.name.copyWith(color: theme.colors.foreground);
  return style.heading(context, base).copyWith(fontSize: base.fontSize, fontWeight: FontWeight.w700);
}

/// What an item is, under its name: 14 px, which Arabic's dots and small letters need to read
TextStyle itemNote(BuildContext context) => context.localeText(context.theme.typography.note.copyWith(color: context.theme.colors.mutedForeground));

/// Whether an item is on offer: a lower price than its own
bool _onOffer(MenuItem item) => item.isOnOffer && item.offerPrice != null && item.offerPrice! < item.price;

/// Rises into place the first time it is built, as the web's items do as they scroll into view
class Rise extends StatefulWidget {
  final Widget child;

  const Rise({super.key, required this.child});

  @override
  State<Rise> createState() => _RiseState();
}

class _RiseState extends State<Rise> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: Motion.slow);

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (reduceMotion(context)) {
      _c.value = 1;
    } else if (_c.value == 0 && !_c.isAnimating) {
      _c.forward();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: _c,
    child: widget.child,
    builder: (context, child) {
      final t = Motion.enter.transform(_c.value);
      return Opacity(
        opacity: t,
        child: Transform.translate(offset: Offset(0, 18 * (1 - t)), child: child),
      );
    },
  );
}

/// An item's press: a tap opens its options, a held one fills the deck's ring
/// (on its photo, or its button) and puts it in the tray, or opens it when
/// there is something to choose
class _ItemPress extends ConsumerWidget {
  final MenuItem item;
  final Widget child;
  final double scale;

  const _ItemPress({required this.item, required this.child, this.scale = 0.98});

  @override
  Widget build(BuildContext context, WidgetRef ref) =>
      HoldPress(scale: scale, onTap: () => openItem(context, item), onLongPress: () => quickAdd(context, ref, item), child: child);
}

/// The photo box of a list's item: the photo, or the plate on the business's colour
class ItemPhotoBox extends StatelessWidget {
  final MenuItem item;
  final double radius;
  final Widget? overlay;

  /// The held press's ring on it: in the corner of a big photo, in the middle of a row's small one
  final bool ring;
  final bool small;

  const ItemPhotoBox({super.key, required this.item, required this.radius, this.overlay, this.ring = true, this.small = false});

  @override
  Widget build(BuildContext context) {
    final c = context.theme.colors;
    final plate = ColoredBox(
      color: c.primary,
      child: LayoutBuilder(
        builder: (context, box) => Center(
          child: Icon(LucideIcons.utensilsCrossed, size: (box.maxWidth / 3).clamp(12, 48), color: c.primaryForeground.withValues(alpha: 0.4)),
        ),
      ),
    );
    Widget photo = item.pictureUri == null
        ? plate
        : CachedNetworkImage(
            imageUrl: item.pictureUri!,
            fit: BoxFit.cover,
            placeholder: (_, _) => ColoredBox(color: c.muted),
            errorWidget: (_, _, _) => plate,
          );
    if (!item.isAvailable) photo = ColorFiltered(colorFilter: _greyscale, child: photo);
    return ItemPhotoAnchor(
      id: item.id,
      radius: radius,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(radius),
        child: Stack(
          fit: StackFit.expand,
          children: [
            photo,
            ?overlay,
            if (ring && item.isAvailable)
              small ? const Center(child: HoldRing(size: 36)) : const PositionedDirectional(top: 10, end: 10, child: HoldRing()),
          ],
        ),
      ),
    );
  }
}

const _greyscale = ColorFilter.matrix([
  0.2126, 0.7152, 0.0722, 0, 0, //
  0.2126, 0.7152, 0.0722, 0, 0,
  0.2126, 0.7152, 0.0722, 0, 0,
  0, 0, 0, 1, 0,
]);

/// The price as a pill, and the struck-out one beside it under an offer
class ItemPrice extends ConsumerWidget {
  final MenuItem item;

  const ItemPrice({super.key, required this.item});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = context.theme;
    final c = theme.colors;
    final money = ref.watch(moneyProvider);
    final offer = _onOffer(item);
    // On a narrow card the struck-out price goes under the pill rather than past the edge
    return Wrap(
      spacing: 8,
      runSpacing: 4,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: ShapeDecoration(color: c.muted, shape: const StadiumBorder()),
          child: Text(
            money(offer ? item.offerPrice! : item.price),
            style: context.localeText(
              theme.typography.caption.copyWith(fontWeight: FontWeight.w700, color: c.foreground, fontFeatures: NinjaTypography.tabular),
            ),
          ),
        ),
        if (offer)
          Text(
            money(item.price),
            style: context.localeText(
              theme.typography.caption.copyWith(
                color: c.mutedForeground,
                fontWeight: FontWeight.w500,
                decoration: TextDecoration.lineThrough,
                fontFeatures: NinjaTypography.tabular,
              ),
            ),
          ),
      ],
    );
  }
}

/// The end of an item (client_web's RowAction). One that needs no choosing:
/// a round plus, which once the item is in the tray opens into less, how
/// many and more (more puts another in; less takes the newest one back
/// out). One with something to choose: a chevron to its options.
class ItemAction extends ConsumerWidget {
  final MenuItem item;

  /// A size down (a row's), its reach still a finger's
  final bool small;

  const ItemAction({super.key, required this.item, this.small = false});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final theme = context.theme;
    final c = theme.colors;
    final size = small ? 40.0 : 44.0;
    final ink = c.primaryForeground;
    final count = ref.watch(cartProvider.select((cart) => cart.items.where((line) => line.productId == item.id).fold(0, (sum, line) => sum + line.quantity)));

    Widget round(IconData icon, VoidCallback onTap, String label) => Pressable(
      key: ValueKey(icon),
      onTap: onTap,
      scale: 0.9,
      semanticLabel: label,
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(color: c.primary, shape: BoxShape.circle, boxShadow: Ninja.ctaShadow),
        child: Icon(icon, size: 20, color: ink),
      ),
    );

    if (!canQuickAdd(item, ref.watch(itemPreferenceProvider(item.id)))) {
      final rtl = Directionality.of(context) == TextDirection.rtl;
      return round(rtl ? LucideIcons.chevronLeft : LucideIcons.chevronRight, () => openItem(context, item), item.name.getText(Localizations.localeOf(context)));
    }

    void less() {
      final cart = ref.read(cartProvider);
      for (var i = cart.items.length - 1; i >= 0; i--) {
        if (cart.items[i].productId != item.id) continue;
        ref.read(cartProvider.notifier).updateQuantity(i, cart.items[i].quantity - 1);
        return;
      }
    }

    return BlurSwap(
      alignment: AlignmentDirectional.centerEnd,
      child: count == 0
          ? round(LucideIcons.plus, () => quickAdd(context, ref, item), l10n.addToCart)
          : Container(
              key: const ValueKey('step'),
              height: size,
              padding: const EdgeInsets.symmetric(horizontal: 2),
              decoration: ShapeDecoration(color: c.primary, shape: const StadiumBorder(), shadows: Ninja.ctaShadow),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _StepButton(icon: LucideIcons.minus, label: l10n.ninjaLess, onTap: less),
                  ConstrainedBox(
                    constraints: const BoxConstraints(minWidth: 20),
                    child: RollingNumber(
                      '$count',
                      value: count.toDouble(),
                      style: theme.typography.note.copyWith(fontWeight: FontWeight.w700, color: ink),
                    ),
                  ),
                  _StepButton(icon: LucideIcons.plus, label: l10n.ninjaMore, onTap: () => quickAdd(context, ref, item)),
                ],
              ),
            ),
    );
  }
}

class _StepButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _StepButton({required this.icon, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) => Pressable(
    onTap: onTap,
    scale: 0.85,
    semanticLabel: label,
    child: SizedBox(width: 36, height: 36, child: Icon(icon, size: 16, color: context.theme.colors.primaryForeground)),
  );
}

/// The classic menu's item: its photo, its name in the heading's voice and a
/// line of what it is, the price its pill, and a round button at the end
class ItemRow extends StatelessWidget {
  final MenuItem item;

  const ItemRow({super.key, required this.item});

  @override
  Widget build(BuildContext context) {
    final locale = Localizations.localeOf(context);
    final short = MediaQuery.sizeOf(context).height < 740;
    final description = item.description.getText(locale);
    return Opacity(
      opacity: item.isAvailable ? 1 : 0.5,
      child: Row(
        children: [
          Expanded(
            child: _ItemPress(
              item: item,
              child: Row(
                children: [
                  SizedBox.square(
                    dimension: short ? 72 : 80,
                    child: ItemPhotoBox(item: item, radius: Ninja.tileRadius, small: true),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(item.name.getText(locale), style: itemName(context)),
                        if (description.isNotEmpty) ...[
                          const SizedBox(height: 2),
                          Text(description, maxLines: 2, overflow: TextOverflow.ellipsis, style: itemNote(context)),
                        ],
                        const SizedBox(height: 6),
                        ItemPrice(item: item),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (item.isAvailable) ...[const SizedBox(width: 12), ItemAction(item: item, small: true)],
        ],
      ),
    );
  }
}

/// Photo grid: two big photo tiles a row, the name and price under each, the button on the photo's corner
class ItemPhotoTile extends StatelessWidget {
  final MenuItem item;

  const ItemPhotoTile({super.key, required this.item});

  @override
  Widget build(BuildContext context) {
    final locale = Localizations.localeOf(context);
    return Opacity(
      opacity: item.isAvailable ? 1 : 0.5,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Stack(
            children: [
              _ItemPress(
                item: item,
                scale: 0.96,
                child: AspectRatio(
                  aspectRatio: 4 / 5,
                  child: ItemPhotoBox(item: item, radius: 24),
                ),
              ),
              if (item.isAvailable) PositionedDirectional(end: 8, bottom: 8, child: ItemAction(item: item)),
            ],
          ),
          const SizedBox(height: 8),
          GestureDetector(
            onTap: () => openItem(context, item),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(item.name.getText(locale), maxLines: 2, overflow: TextOverflow.ellipsis, style: itemName(context)),
                  const SizedBox(height: 6),
                  ItemPrice(item: item),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Compact: the name, a line of what it is, the price, the button; no photo, many to a screen
class ItemCompactRow extends ConsumerWidget {
  final MenuItem item;

  const ItemCompactRow({super.key, required this.item});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final locale = Localizations.localeOf(context);
    final theme = context.theme;
    final c = theme.colors;
    final money = ref.watch(moneyProvider);
    final offer = _onOffer(item);
    final description = item.description.getText(locale);
    final strong = context.localeText(theme.typography.body.copyWith(color: c.foreground));
    // The press is on the words and its ring on the button: one scope round both
    return HoldScope(
      child: Opacity(
        opacity: item.isAvailable ? 1 : 0.5,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Row(
            children: [
              Expanded(
                child: _ItemPress(
                  item: item,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.baseline,
                        textBaseline: TextBaseline.alphabetic,
                        children: [
                          Expanded(
                            child: Text(item.name.getText(locale), style: strong.copyWith(fontWeight: FontWeight.w600, height: 1.3)),
                          ),
                          const SizedBox(width: 12),
                          if (offer) ...[
                            Text(
                              money(item.price),
                              style: context.localeText(
                                theme.typography.caption.copyWith(
                                  color: c.mutedForeground,
                                  decoration: TextDecoration.lineThrough,
                                  fontFeatures: NinjaTypography.tabular,
                                ),
                              ),
                            ),
                            const SizedBox(width: 6),
                          ],
                          Text(
                            money(offer ? item.offerPrice! : item.price),
                            style: strong.copyWith(fontWeight: FontWeight.w700, fontFeatures: NinjaTypography.tabular),
                          ),
                        ],
                      ),
                      if (description.isNotEmpty) Text(description, maxLines: 1, overflow: TextOverflow.ellipsis, style: itemNote(context)),
                    ],
                  ),
                ),
              ),
              if (item.isAvailable) ...[
                const SizedBox(width: 12),
                // No photo to fill a ring on: held, the deck's ring covers the button
                Stack(
                  alignment: Alignment.center,
                  children: [ItemAction(item: item), const HoldRing()],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Magazine: one wide photo an item, the name and price set on it under a shade, the button on its corner
class ItemHeroCard extends ConsumerWidget {
  final MenuItem item;

  const ItemHeroCard({super.key, required this.item});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final locale = Localizations.localeOf(context);
    final theme = context.theme;
    final money = ref.watch(moneyProvider);
    final offer = _onOffer(item);
    final description = item.description.getText(locale);
    // The words sit on the photo's shade: white whatever the theme
    final heading = BrandStyle.of(context).heading(context, theme.typography.title.copyWith(color: Colors.white, height: 1.15));
    return Opacity(
      opacity: item.isAvailable ? 1 : 0.5,
      child: Stack(
        children: [
          _ItemPress(
            item: item,
            scale: 0.97,
            child: AspectRatio(
              aspectRatio: 16 / 11,
              child: ItemPhotoBox(
                item: item,
                radius: Ninja.cardRadius,
                overlay: DecoratedBox(
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.bottomCenter,
                      end: Alignment.topCenter,
                      colors: [Color(0xBF000000), Color(0x59000000), Color(0x00000000)],
                      stops: [0, 0.35, 0.7],
                    ),
                  ),
                  child: Align(
                    alignment: AlignmentDirectional.bottomStart,
                    child: Padding(
                      padding: const EdgeInsetsDirectional.fromSTEB(20, 64, 80, 20),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(item.name.getText(locale), style: heading),
                          if (description.isNotEmpty)
                            Text(
                              description,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: itemNote(context).copyWith(color: Colors.white.withValues(alpha: 0.8)),
                            ),
                          const SizedBox(height: 4),
                          Row(
                            children: [
                              Text(
                                money(offer ? item.offerPrice! : item.price),
                                style: context.localeText(
                                  theme.typography.body.copyWith(color: Colors.white, fontWeight: FontWeight.w700, fontFeatures: NinjaTypography.tabular),
                                ),
                              ),
                              if (offer) ...[
                                const SizedBox(width: 8),
                                Text(
                                  money(item.price),
                                  style: context.localeText(
                                    theme.typography.caption.copyWith(
                                      color: Colors.white.withValues(alpha: 0.7),
                                      decoration: TextDecoration.lineThrough,
                                      decorationColor: Colors.white70,
                                    ),
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
          if (item.isAvailable) PositionedDirectional(end: 16, bottom: 16, child: ItemAction(item: item)),
        ],
      ),
    );
  }
}

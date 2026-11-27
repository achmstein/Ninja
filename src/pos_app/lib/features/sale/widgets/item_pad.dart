import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import 'package:shimmer/shimmer.dart';
import 'package:go_router/go_router.dart';
import '../../../core/layout/breakpoints.dart';
import 'package:ninja_app_core/models/localized_text.dart';
import '../../../l10n/app_localizations.dart';
import '../../catalog/models/catalog_item.dart';
import '../compact_columns.dart';
import '../../../core/utils/bidi.dart';
import '../widgets/item_tile.dart';
import '../../../core/theme/type_roles.dart';

/// The attached customer's usuals, shown as a category of their own
const usualsCategory = -1;

/// A muted, rounded shimmer bar sized to a fraction of its row — the stand-in
/// for a line of text while a skeleton loads.
Widget _bar(FThemeData theme, {required double widthFactor, double height = 12}) => SizedBox(
      height: height,
      child: FractionallySizedBox(
        alignment: AlignmentDirectional.centerStart,
        widthFactor: widthFactor,
        child: DecoratedBox(
          decoration: BoxDecoration(color: theme.colors.muted, borderRadius: BorderRadius.circular(4)),
        ),
      ),
    );

/// Two lines of name and the price: well over a finger's 56 tall
const _compactTileHeight = 76.0;

/// The menu side of the sale screen: its head (the way back, then the
/// categories as one row that swipes, or the search), and its items as tiles.
/// A long menu on a tablet ([compact]) lists its categories down the side
/// with the search always in view. The customer's usuals are a category of
/// their own, first, and open by default. The web till's ItemPad is the same.
///
/// It only draws what the sale pad hands it, and says what was tapped.
class ItemPad extends StatelessWidget {
  final List<CatalogCategory> categories;
  final AsyncValue<List<CatalogItem>> items;

  /// Whose the items are, their most ordered: empty when there are none
  final List<CatalogItem> usuals;

  /// The category picked; null until one is, when the usuals (or the first) open
  final int? activeCategory;
  final void Function(int id) onPickCategory;

  /// Text tiles for a long menu, the owner's choice in admin; photo tiles otherwise
  final bool compact;
  final TextEditingController search;

  /// The phone's search, opened from the button at the row's end
  final bool searchOpen;
  final VoidCallback onToggleSearch;
  final void Function(CatalogItem item) onTapItem;

  /// Under the menu: the phone's way to the order
  final Widget? foot;

  const ItemPad({
    super.key,
    required this.categories,
    required this.items,
    required this.usuals,
    required this.activeCategory,
    required this.onPickCategory,
    required this.compact,
    required this.search,
    required this.searchOpen,
    required this.onToggleSearch,
    required this.onTapItem,
    this.foot,
  });

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final itemsAsync = items;
    final narrow = context.isNarrow;
    // A long menu lists its categories down the side, with the search always
    // in view, instead of a row of chips over the items. A phone has no side
    // to spare: its categories are one row of chips, whichever tiles it shows
    final rail = compact && !narrow;
    final searching = !rail && searchOpen;
    final needle = rail || searching ? search.text.trim().toLowerCase() : '';
    final firstCategoryId = categories.isNotEmpty ? categories.first.id : null;
    final activeCategoryId = switch (activeCategory) {
      null => usuals.isNotEmpty ? usualsCategory : firstCategoryId,
      usualsCategory when usuals.isEmpty => firstCategoryId,
      final id => id,
    };
    final countIn = <int, int>{};
    for (final item in itemsAsync.value ?? const <CatalogItem>[]) {
      countIn[item.catalogTypeId] = (countIn[item.catalogTypeId] ?? 0) + 1;
    }
    final pickCategory = onPickCategory;

    // One category chip: a tablet's wrap into rows at their own height, a
    // phone's run in one row at a finger's 48
    Widget chip({required String label, required bool active, required VoidCallback onPress, bool usual = false}) =>
        ConstrainedBox(
          constraints: BoxConstraints(minHeight: narrow ? Sizes.control : Sizes.controlSmall),
          child: FButton(
            variant: active ? null : FButtonVariant.outline,
            mainAxisSize: MainAxisSize.min,
            onPress: onPress,
            prefix: usual ? const Icon(FIcons.sparkles, size: Sizes.iconSmall) : null,
            child: Text(label, style: theme.type.button),
          ),
        );
    final chips = [
      if (usuals.isNotEmpty)
        chip(
          label: l10n.usuals,
          active: activeCategoryId == usualsCategory,
          onPress: () => onPickCategory(usualsCategory),
          usual: true,
        ),
      for (final category in categories)
        chip(
          label: category.name.localized(context),
          active: category.id == activeCategoryId,
          onPress: () => onPickCategory(category.id),
        ),
    ];

    return Column(
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(border: Border(bottom: BorderSide(color: theme.colors.border))),
          child: Row(
            // The search, or the one row of chips, sits level with the back button
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              SizedBox.square(
                dimension: Sizes.control,
                child: FButton.icon(
                  variant: FButtonVariant.ghost,
                  onPress: () => context.go('/'),
                  child: Icon(FIcons.arrowLeft, size: Sizes.iconNav),
                ),
              ),
              const SizedBox(width: 8),
              // Compact: the search, the categories being the list beside the items
              // Held to the button's height: left to itself the field is half a pixel
              // taller, and the rule under this head then misses the one under the order's
              if (rail || searching)
                Expanded(
                  child: SizedBox(
                    height: Sizes.control,
                    // The field keeps its own height inside, centred: squeezing it cuts its edge
                    child: OverflowBox(
                    minHeight: 0,
                    maxHeight: double.infinity,
                    child: FTextField(
                    control: FTextFieldControl.managed(controller: search),
                    hint: l10n.searchItems,
                    textInputAction: TextInputAction.search,
                    // Opened by its button on a phone, it is what is typed into next
                    autofocus: searching,
                    prefixBuilder: (context, style, states) => Padding(
                      padding: const EdgeInsetsDirectional.only(start: 10),
                      child: Icon(FIcons.search, size: Sizes.icon, color: theme.colors.mutedForeground),
                    ),
                    // The phone's field is closed, and emptied, by the button beside it:
                    // a second cross inside it would be one too many
                    clearable: (value) => !searching && value.text.isNotEmpty,
                  ),
                  ),
                  ),
                )
              // Photo tiles: the categories are one row that swipes, on a tablet as on a
              // phone. Wrapped into rows, a long menu's categories took the room the
              // items need, and the menu started at a different height on every tablet
              else
                Expanded(
                  child: SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        for (final (index, one) in chips.indexed)
                          Padding(
                            padding: EdgeInsetsDirectional.only(start: index == 0 ? 0 : 8),
                            child: one,
                          ),
                      ],
                    ),
                  ),
                ),
              // Search is the shortcut past the one row of chips
              if (!rail) ...[
                const SizedBox(width: 4),
                SizedBox.square(
                  dimension: Sizes.control,
                  child: Semantics(
                    label: searching ? l10n.close : l10n.searchItems,
                    child: FButton.icon(
                      variant: FButtonVariant.ghost,
                      onPress: onToggleSearch,
                      child: Icon(searching ? FIcons.x : FIcons.search, size: Sizes.icon),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
        Expanded(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (rail)
                _CategoryRail(
                  entries: [
                    if (usuals.isNotEmpty) (id: usualsCategory, name: l10n.usuals, count: usuals.length, icon: FIcons.sparkles),
                    for (final category in categories)
                      (id: category.id, name: category.name.localized(context), count: countIn[category.id] ?? 0, icon: null),
                  ],
                  active: needle.isEmpty ? activeCategoryId : null,
                  onPick: pickCategory,
                ),
              Expanded(
          child: itemsAsync.when(
            loading: () => LayoutBuilder(
              builder: (context, constraints) {
                if (compact) {
                  final width = constraints.maxWidth - 24;
                  final columns = compactColumns(width);
                  return Shimmer.fromColors(
                    baseColor: theme.colors.muted,
                    highlightColor: theme.colors.background,
                    child: GridView.builder(
                      padding: const EdgeInsets.all(12),
                      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: columns,
                        mainAxisSpacing: 8,
                        crossAxisSpacing: 8,
                        mainAxisExtent: _compactTileHeight,
                      ),
                      itemCount: columns * 4,
                      // Name and price lines, no picture: the compact tile's shape
                      itemBuilder: (_, _) => DecoratedBox(
                        decoration: BoxDecoration(
                          border: Border.all(color: theme.colors.border),
                          borderRadius: BorderRadius.circular(Sizes.radius),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.all(10),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              _bar(theme, widthFactor: 1),
                              _bar(theme, widthFactor: 0.4, height: 10),
                            ],
                          ),
                        ),
                      ),
                    ),
                  );
                }
                // Match the real grid's geometry so the skeleton
                // sits exactly where the item tiles will land.
                const gap = 12.0;
                final width = constraints.maxWidth - 24;
                final columns = ((width + gap) ~/ (140 + gap)).clamp(1, 99);
                final tileWidth = (width - gap * (columns - 1)) / columns;
                return Shimmer.fromColors(
                  baseColor: theme.colors.muted,
                  highlightColor: theme.colors.background,
                  child: GridView.builder(
                    padding: const EdgeInsets.all(12),
                    gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: columns,
                      mainAxisSpacing: gap,
                      crossAxisSpacing: gap,
                      mainAxisExtent: tileWidth + 78,
                    ),
                    itemCount: columns * 3,
                    itemBuilder: (_, _) => DecoratedBox(
                      decoration: BoxDecoration(
                        border: Border.all(color: theme.colors.border),
                        borderRadius: BorderRadius.circular(Sizes.radiusCard),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // The square picture
                          AspectRatio(
                            aspectRatio: 1,
                            child: DecoratedBox(
                              decoration: BoxDecoration(
                                color: theme.colors.muted,
                                borderRadius: const BorderRadius.vertical(top: Radius.circular(Sizes.radiusCard)),
                              ),
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.all(8),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                _bar(theme, widthFactor: 1),
                                const SizedBox(height: 6),
                                _bar(theme, widthFactor: 0.6),
                                const SizedBox(height: 8),
                                _bar(theme, widthFactor: 0.4, height: 10),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
            error: (_, _) => Center(child: Text(l10n.somethingWentWrong, style: theme.type.body.copyWith(color: theme.colors.mutedForeground))),
            data: (items) {
              final visible = needle.isNotEmpty
                  // A search runs across every category, in either language
                  ? items
                      .where((i) =>
                          (i.name.en ?? '').toLowerCase().contains(needle) ||
                          (i.name.ar ?? '').toLowerCase().contains(needle))
                      .toList()
                  : activeCategoryId == usualsCategory
                      ? usuals
                      : (items.where((i) => i.catalogTypeId == activeCategoryId).toList()
                        ..sort((a, b) => a.displayOrder.compareTo(b.displayOrder)));
              if (visible.isEmpty) {
                return Center(
                  child: Text(needle.isNotEmpty ? l10n.noItemsMatch : l10n.noItemsInCategory,
                      style: theme.type.body.copyWith(color: theme.colors.mutedForeground)),
                );
              }
              return LayoutBuilder(
                builder: (context, constraints) {
                  if (compact) {
                    // Packed by the menu's own width: six to eight across beside the sale
                    return GridView.builder(
                      padding: const EdgeInsets.all(12),
                      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: compactColumns(constraints.maxWidth - 24),
                        mainAxisSpacing: 8,
                        crossAxisSpacing: 8,
                        mainAxisExtent: _compactTileHeight,
                      ),
                      itemCount: visible.length,
                      itemBuilder: (context, index) => CompactItemTile(item: visible[index], onTap: () => onTapItem(visible[index])),
                    );
                  }
                  const gap = 12.0;
                  final width = constraints.maxWidth - 24;
                  final columns = (width + gap) ~/ (140 + gap);
                  final tileWidth = (width - gap * (columns - 1)) / columns;
                  return GridView.builder(
                    padding: const EdgeInsets.all(12),
                    gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: columns < 1 ? 1 : columns,
                      mainAxisSpacing: gap,
                      crossAxisSpacing: gap,
                      // Square picture, then the name's two lines and the price's one (20 each), the padding and the gap
                      mainAxisExtent: tileWidth + 78,
                    ),
                    itemCount: visible.length,
                    itemBuilder: (context, index) => ItemTile(item: visible[index], onTap: () => onTapItem(visible[index])),
                  );
                },
              );
            },
          ),
              ),
            ],
          ),
        ),
        ?foot,
      ],
    );
  }
}

/// One entry in the compact till's category list
typedef _RailEntry = ({int id, String name, int count, IconData? icon});

/// The compact till's categories down the start side, however many there
/// are, scrolling on their own: each one's name (two lines at most, a Latin
/// one laid out as it is written from the line's start) and how many items it
/// holds, the open one filled in. The web till's is the same.
class _CategoryRail extends StatelessWidget {
  final List<_RailEntry> entries;

  /// The open category; none while a search is shown
  final int? active;
  final void Function(int id) onPick;

  const _CategoryRail({required this.entries, required this.active, required this.onPick});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    return Container(
      width: 208,
      decoration: BoxDecoration(border: BorderDirectional(end: BorderSide(color: theme.colors.border))),
      child: ListView(
        padding: const EdgeInsets.all(8),
        children: [
          for (final entry in entries)
            Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: _RailCategory(entry: entry, active: entry.id == active, onTap: () => onPick(entry.id)),
            ),
        ],
      ),
    );
  }
}

class _RailCategory extends StatelessWidget {
  final _RailEntry entry;
  final bool active;
  final VoidCallback onTap;

  const _RailCategory({required this.entry, required this.active, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final ink = active ? theme.colors.primaryForeground : theme.colors.foreground;
    return Semantics(
      button: true,
      selected: active,
      child: FTappable(
        onPress: onTap,
        builder: (context, states, child) => Container(
          constraints: const BoxConstraints(minHeight: Sizes.control),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: active
                ? theme.colors.primary
                : states.contains(FTappableVariant.hovered) || states.contains(FTappableVariant.pressed)
                    ? theme.colors.secondary
                    : null,
            borderRadius: BorderRadius.circular(Sizes.radius),
          ),
          child: child,
        ),
        child: Row(
          children: [
            if (entry.icon != null) ...[
              Icon(entry.icon, size: Sizes.iconSmall, color: ink),
              const SizedBox(width: 8),
            ],
            Expanded(
              child: Text(
                entry.name,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                textDirection: textDirectionFor(entry.name),
                textAlign: textAlignFor(context),
                style: theme.type.detail.copyWith(fontWeight: FontWeight.w500, color: ink),
              ),
            ),
            const SizedBox(width: 8),
            Text(
              '${entry.count}',
              style: theme.type.caption.copyWith(
                color: active ? theme.colors.primaryForeground.withValues(alpha: 0.8) : theme.colors.mutedForeground,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

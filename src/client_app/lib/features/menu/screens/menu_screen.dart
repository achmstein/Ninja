import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:scrollable_positioned_list/scrollable_positioned_list.dart';
import '../../../core/brand/brand_style.dart';
import '../../../core/brand/styles.dart';
import '../../../core/motion/motion.dart';
import '../../../core/providers/branch_provider.dart';
import '../../../core/providers/locale_provider.dart';
import '../../../core/shell/tuck.dart';
import '../../../core/ui/ui.dart';
import '../../../core/widgets/notice_card.dart';
import '../../../l10n/app_localizations.dart';
import '../models/menu_item.dart';
import '../services/menu_service.dart';
import '../widgets/deck.dart';
import '../widgets/dish.dart';

/// One of the menu's sections: a category and its dishes
typedef MenuSection = ({String label, List<MenuItem> items});

/// The menu's sections: each category with anything in it, in the business's
/// order. The most popular are not repeated here: each of them is a dish in
/// its category (client_web's list shows the categories alone).
List<MenuSection> menuSections(Map<MenuCategory, List<MenuItem>> grouped, Locale locale) => [
  for (final MapEntry(key: category, value: items) in grouped.entries)
    if (category.id >= 0 && items.isNotEmpty) (label: category.name.getText(locale), items: items),
];

/// The menu tab as client_web draws it (components/menu/menu-screen.tsx), in
/// the style the business chose. A list, or the tiles, is one scrolling page
/// under the tab's large title, each category a heading over its dishes
/// (list/menu-grid.tsx). The deck is big cards, one column a category
/// (deck/deck.tsx); a tap on the category in view, or the grid button,
/// zooms out to the whole menu as small tiles, and the button there goes
/// back to the cards. The categories are chips above the dock, in the
/// thumb's reach: on the cards they turn the deck, on the page they follow
/// the one in view and jump to one. A tap on a dish opens its options; its
/// plus, or a held press, puts it straight in the tray.
class MenuScreen extends ConsumerStatefulWidget {
  const MenuScreen({super.key});

  @override
  ConsumerState<MenuScreen> createState() => _MenuScreenState();
}

class _MenuScreenState extends ConsumerState<MenuScreen> {
  final _scroll = ItemScrollController();
  final _positions = ItemPositionsListener.create();
  final _section = ValueNotifier(0);
  int _sections = 0;

  /// The deck's column in view, and whether the deck is zoomed out to the whole menu
  int _column = 0;
  bool _grid = false;
  List<DeckColumn> _columns = const [];

  /// While a tap on a chip scrolls to its category, the pill stays on it rather than lighting each one passed
  bool _jumping = false;

  @override
  void initState() {
    super.initState();
    _positions.itemPositions.addListener(_spy);
  }

  @override
  void dispose() {
    _positions.itemPositions.removeListener(_spy);
    _section.dispose();
    super.dispose();
  }

  /// Which category is in view: the last one whose heading has reached the
  /// top of the page; at the end of the page the last one, however short
  void _spy() {
    if (_jumping || _sections == 0) return;
    final positions = _positions.itemPositions.value;
    if (positions.isEmpty) return;
    var index = 0;
    for (final p in positions) {
      // Item 0 is the title; the sections follow it
      if (p.index > 0 && p.itemLeadingEdge <= 0.08 && p.index - 1 > index) index = p.index - 1;
    }
    if (positions.any((p) => p.index == _sections && p.itemTrailingEdge <= 1.001)) index = _sections - 1;
    if (_section.value != index) _section.value = index;
  }

  /// The deck zoomed out: the whole menu, at the category the deck was on
  void _zoomOut() {
    final col = _columns.elementAtOrNull(_column);
    final category = col == null || col.usuals ? 0 : _column - (_columns.first.usuals ? 1 : 0);
    setState(() => _grid = true);
    _section.value = category;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.isAttached && category > 0) _scroll.jumpTo(index: category + 1);
    });
  }

  /// Back to the cards, at the category in view
  void _zoomIn() {
    final offset = _columns.isNotEmpty && _columns.first.usuals ? 1 : 0;
    setState(() {
      _grid = false;
      _column = (_section.value + offset).clamp(0, _columns.length - 1);
    });
  }

  Future<void> _jump(int index) async {
    _jumping = true;
    _section.value = index;
    await _scroll.scrollTo(index: index + 1, duration: const Duration(milliseconds: 450), curve: Curves.easeInOutCubic);
    // Let go once it has settled
    await Future<void>.delayed(const Duration(milliseconds: 60));
    _jumping = false;
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final locale = ref.watch(localeProvider);
    final branchId = ref.watch(selectedBranchIdProvider);
    final ordering = ref.watch(branchProvider).selectedBranch?.isOrderingEnabled ?? true;
    final layout = BrandStyle.of(context).layout.menuItem;
    final c = context.theme.colors;
    if (branchId == null) return const _Loading();

    final grouped = ref.watch(groupedMenuItemsProvider((locale, branchId)));
    final sections = menuSections(grouped.value ?? const {}, locale);
    _sections = sections.length;
    // The deck: the customer's usuals first, then each category
    final deck = layout == MenuItemLayout.deck;
    _columns = deck ? buildDeck(usualsLabel: l10n.yourUsuals, usuals: ref.watch(topMenuItemsProvider).value ?? const [], categories: sections) : const [];
    final cards = deck && !_grid && _columns.isNotEmpty;
    // The dock over the bottom of the page: the categories sit on it
    final dock = MediaQuery.paddingOf(context).bottom;

    final body = grouped.when(
      skipLoadingOnRefresh: true,
      loading: () => const _Loading(),
      error: (error, _) => Center(
        child: EmptyState(
          icon: LucideIcons.circleAlert,
          title: l10n.failedToLoadMenu(error.toString()),
          action: NinjaButton(
            mainAxisSize: MainAxisSize.min,
            onPress: () => ref.invalidate(groupedMenuItemsProvider((locale, branchId))),
            child: Text(l10n.retry),
          ),
        ),
      ),
      data: (_) => sections.isEmpty
          ? Center(
              child: EmptyState(icon: LucideIcons.utensilsCrossed, title: l10n.noItemsAvailable),
            )
          : RefreshIndicator(
              color: c.foreground,
              backgroundColor: c.background,
              onRefresh: () async {
                ref.invalidate(groupedMenuItemsProvider((locale, branchId)));
                await ref.read(groupedMenuItemsProvider((locale, branchId)).future);
              },
              child: MediaQuery.removePadding(
                context: context,
                removeBottom: true,
                child: ScrollablePositionedList.builder(
                  itemScrollController: _scroll,
                  itemPositionsListener: _positions,
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                  itemCount: sections.length + 1,
                  itemBuilder: (context, index) {
                    if (index == 0) {
                      // The deck zoomed out has the way back to its cards by its title
                      return deck ? _Head(title: l10n.ninjaWholeMenu, paused: !ordering, onBack: _zoomIn) : _Head(title: l10n.menu, paused: !ordering);
                    }
                    return _Section(section: sections[index - 1], layout: layout);
                  },
                ),
              ),
            ),
    );

    final Widget content = cards
        ? Column(
            key: const ValueKey('cards'),
            children: [
              if (!ordering) PausedNotice(title: l10n.orderingPausedTitle),
              Expanded(
                child: Deck(columns: _columns, column: _column.clamp(0, _columns.length - 1), onColumnChange: (c) => setState(() => _column = c)),
              ),
            ],
          )
        : KeyedSubtree(key: const ValueKey('page'), child: body);

    return Column(
      children: [
        // Between the cards and the whole menu, one fades out as the other fades in
        Expanded(
          child: AnimatedSwitcher(duration: Motion.base, switchInCurve: Motion.enter, switchOutCurve: Motion.exit, child: content),
        ),
        if (sections.isNotEmpty)
          // The categories, just above the dock; they come down with it as it tucks away
          AnimatedPadding(
            duration: tuckSettle,
            curve: Curves.easeOut,
            padding: EdgeInsets.only(bottom: dock),
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: c.background,
                boxShadow: const [BoxShadow(color: Color(0x59000000), offset: Offset(0, -10), blurRadius: 18, spreadRadius: -14)],
              ),
              child: Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: cards
                    // On the cards the chips turn the deck; the one in view again, or the button, zooms out
                    ? LiquidChips(
                        labels: [for (final c in _columns) c.label],
                        active: _column.clamp(0, _columns.length - 1),
                        onSelect: (i) => i == _column ? _zoomOut() : setState(() => _column = i),
                        trailing: NinjaIconButton(size: 36, semanticLabel: l10n.ninjaWholeMenu, onPress: _zoomOut, child: const Icon(LucideIcons.layoutGrid)),
                      )
                    : ValueListenableBuilder<int>(
                        valueListenable: _section,
                        builder: (context, active, _) => LiquidChips(
                          labels: [for (final s in sections) s.label],
                          active: active.clamp(0, sections.length - 1),
                          onSelect: _jump,
                          trailing: deck
                              ? NinjaIconButton(
                                  size: 36,
                                  semanticLabel: l10n.ninjaBackToCards,
                                  onPress: _zoomIn,
                                  child: const Icon(LucideIcons.galleryVertical),
                                )
                              : null,
                        ),
                      ),
              ),
            ),
          ),
      ],
    );
  }
}

class _Loading extends StatelessWidget {
  const _Loading();

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
    child: DecoratedBox(
      decoration: BoxDecoration(color: context.theme.colors.muted, borderRadius: BorderRadius.circular(Ninja.cardRadius)),
      child: const SizedBox.expand(),
    ),
  );
}

/// The page's large title, and a word over the whole menu while ordering is paused
class _Head extends StatelessWidget {
  final String title;
  final bool paused;

  /// A way back before the title (the deck zoomed out: back to its cards)
  final VoidCallback? onBack;

  const _Head({required this.title, required this.paused, this.onBack});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final theme = context.theme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (onBack != null)
            Row(
              children: [
                NinjaIconButton(
                  onPress: onBack,
                  semanticLabel: l10n.ninjaBackToCards,
                  child: Icon(Directionality.of(context) == TextDirection.rtl ? LucideIcons.arrowRight : LucideIcons.arrowLeft),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: BrandHeading(title, style: theme.typography.headline.copyWith(color: theme.colors.foreground)),
                ),
              ],
            )
          else
            BrandHeading(title, style: theme.typography.title.copyWith(color: theme.colors.foreground)),
          if (paused) ...[const SizedBox(height: 20), PausedNotice(title: l10n.orderingPausedTitle, margin: EdgeInsets.zero)],
        ],
      ),
    );
  }
}

/// A category: its heading, then its dishes as the style lays them out
class _Section extends StatelessWidget {
  final MenuSection section;
  final MenuItemLayout layout;

  const _Section({required this.section, required this.layout});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final items = section.items;
    final Widget dishes = switch (layout) {
      // Small tiles, three a row: the tiles, and the deck zoomed out
      MenuItemLayout.deck || MenuItemLayout.tiles => Column(
        children: [
          for (var i = 0; i < items.length; i += 3) ...[
            if (i > 0) const SizedBox(height: 10),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (var j = i; j < i + 3; j++) ...[
                  if (j > i) const SizedBox(width: 10),
                  Expanded(child: j < items.length ? Rise(child: dishFor(layout, items[j])) : const SizedBox()),
                ],
              ],
            ),
          ],
        ],
      ),
      MenuItemLayout.card => Column(
        children: [
          for (var i = 0; i < items.length; i += 2) ...[
            if (i > 0) const SizedBox(height: 20),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(child: Rise(child: dishFor(layout, items[i]))),
                const SizedBox(width: 12),
                Expanded(child: i + 1 < items.length ? Rise(child: dishFor(layout, items[i + 1])) : const SizedBox()),
              ],
            ),
          ],
        ],
      ),
      MenuItemLayout.compact => Column(
        children: [
          for (final (i, item) in items.indexed) ...[
            if (i > 0) Divider(height: 1, thickness: 1, color: theme.colors.border.withValues(alpha: 0.6)),
            Rise(child: dishFor(layout, item)),
          ],
        ],
      ),
      _ => Column(
        children: [
          for (final (i, item) in items.indexed) ...[if (i > 0) const SizedBox(height: 16), Rise(child: dishFor(layout, item))],
        ],
      ),
    };
    return Padding(
      padding: const EdgeInsets.only(bottom: 28),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          BrandHeading(section.label, style: theme.typography.headline.copyWith(color: theme.colors.foreground)),
          const SizedBox(height: 12),
          dishes,
        ],
      ),
    );
  }
}

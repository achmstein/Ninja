import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import 'package:scrollable_positioned_list/scrollable_positioned_list.dart';
import '../../../core/auth/auth_service.dart';
import '../../../core/brand/brand_mark.dart';
import '../../../core/brand/brand_provider.dart';
import '../../../core/brand/brand_style.dart';
import '../../../core/brand/styles.dart';
import '../../places/screens/qr_scan_screen.dart';
import '../../../core/widgets/profile_gate.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_text.dart';
import '../../../l10n/app_localizations.dart';
import '../../../core/utils/money.dart';
import '../../../core/providers/branch_provider.dart';
import '../../../core/providers/locale_provider.dart';
import '../models/menu_item.dart';
import '../models/user_preference.dart';
import '../../../core/utils/search_normalize.dart';
import '../services/menu_service.dart';
import '../providers/favorites_provider.dart';
import '../../cart/models/cart_item.dart';
import '../../cart/services/cart_service.dart';
import '../../orders/services/order_service.dart';
import '../../places/models/place.dart';
import '../../places/services/place_service.dart';
import '../widgets/item_customization_sheet.dart';
import '../../../core/services/sound_service.dart';

/// Menu screen showing food and drinks grouped by category
class MenuScreen extends ConsumerStatefulWidget {
  const MenuScreen({super.key});

  @override
  ConsumerState<MenuScreen> createState() => _MenuScreenState();
}

class _MenuScreenState extends ConsumerState<MenuScreen> {
  final ItemScrollController _itemScrollController = ItemScrollController();
  final ItemPositionsListener _itemPositionsListener = ItemPositionsListener.create();
  final TextEditingController _searchController = TextEditingController();

  final ValueNotifier<String?> _selectedCategoryNotifier = ValueNotifier(null);

  bool _showSearch = false;
  String _searchQuery = '';
  List<String> _categoryNames = [];
  bool _isProgrammaticScroll = false;

  @override
  void initState() {
    super.initState();
    _itemPositionsListener.itemPositions.addListener(_onScroll);
    _searchController.addListener(_onSearchChanged);
  }

  @override
  void dispose() {
    _itemPositionsListener.itemPositions.removeListener(_onScroll);
    _searchController.removeListener(_onSearchChanged);
    _searchController.dispose();
    _selectedCategoryNotifier.dispose();
    super.dispose();
  }

  void _onSearchChanged() {
    final query = _searchController.text;
    if (query != _searchQuery) {
      setState(() => _searchQuery = query);
    }
  }

  void _toggleSearch() {
    setState(() {
      _showSearch = !_showSearch;
      if (!_showSearch) {
        _searchController.clear();
        _searchQuery = '';
      }
    });
  }

  void _onScroll() {
    final positions = _itemPositionsListener.itemPositions.value;
    if (positions.isEmpty || _isProgrammaticScroll) return;

    // Single pass: find the item at the viewport top
    int topIndex = -1;
    double topLeading = 0.0;
    double topTrailing = 0.0;
    for (final p in positions) {
      if (p.itemLeadingEdge <= 0 && p.itemTrailingEdge > 0 && p.index > topIndex) {
        topIndex = p.index;
        topLeading = p.itemLeadingEdge;
        topTrailing = p.itemTrailingEdge;
      }
    }
    if (topIndex < 0) return;

    final adjustedIndex = topIndex;

    final extent = topTrailing - topLeading;
    final fraction = extent > 0 ? (-topLeading).clamp(0.0, extent) / extent : 0.0;
    final offset = adjustedIndex + fraction;

    if (_categoryNames.isNotEmpty) {
      final catIndex = offset.floor().clamp(0, _categoryNames.length - 1);
      final newCategory = _categoryNames[catIndex];
      if (newCategory != _selectedCategoryNotifier.value) {
        _selectedCategoryNotifier.value = newCategory;
      }
    }
  }

  void _scrollToCategory(String category) {
    final index = _categoryNames.indexOf(category);
    if (index == -1) return;

    _selectedCategoryNotifier.value = category;

    _isProgrammaticScroll = true;
    _itemScrollController.scrollTo(
      index: index,
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeInOut,
    ).then((_) {
      Future.delayed(const Duration(milliseconds: 50), () {
        if (!mounted) return;
        _isProgrammaticScroll = false;
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    final locale = ref.watch(localeProvider);
    final branchId = ref.watch(selectedBranchIdProvider);
    if (branchId == null) {
      return Center(child: CircularProgressIndicator(color: context.theme.colors.primary));
    }
    final groupedItemsAsync = ref.watch(groupedMenuItemsProvider((locale, branchId)));
    final topItems = ref.watch(topMenuItemsProvider).value ?? const <MenuItem>[];
    final cart = ref.watch(cartProvider);
    final colors = context.theme.colors;
    final l10n = AppLocalizations.of(context)!;
    final branchState = ref.watch(branchProvider);
    final isOrderingEnabled = branchState.selectedBranch?.isOrderingEnabled ?? true;
    final style = BrandStyle.of(context);
    final variant = style.layout.menuItem;

    return Column(
      children: [
        // Header with search toggle, laid out as the brand's style says.
        // Scanning lives here rather than under Rooms: the customer
        // scanning a sticker is about to order, and the code they point at
        // decides whether it is a room or a table.
        MenuHeader(
          variant: style.layout.header,
          title: l10n.menu,
          searchOpen: _showSearch,
          onScan: () => Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => const QrScanScreen()),
          ),
          onSearch: _toggleSearch,
        ),

        // Ordering disabled banner
        if (!isOrderingEnabled)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            color: colors.destructive.withValues(alpha: 0.1),
            child: Row(
              children: [
                Icon(FIcons.circleAlert, size: 16, color: colors.destructive),
                const SizedBox(width: 8),
                Expanded(
                  child: AppText(
                    l10n.orderingUnavailable,
                    style: TextStyle(fontSize: 13, color: colors.destructive),
                  ),
                ),
              ],
            ),
          ),

        // Content
        Expanded(
          child: groupedItemsAsync.when(
            loading: () => Center(child: CircularProgressIndicator(color: colors.primary)),
            error: (error, _) => Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(FIcons.circleAlert, size: 48, color: colors.mutedForeground),
                  const SizedBox(height: 16),
                  AppText(l10n.failedToLoadMenu(error.toString()), style: TextStyle(color: colors.foreground)),
                  const SizedBox(height: 16),
                  FButton(
                    onPress: () => ref.refresh(groupedMenuItemsProvider((locale, branchId))),
                    child: Text(l10n.retry),
                  ),
                ],
              ),
            ),
            data: (groupedItems) {
              if (groupedItems.isEmpty) {
                return Center(child: AppText(l10n.noItemsAvailable));
              }

              // Filter items based on search
              final filteredItems = _filterItemsWithLocale(groupedItems, locale);

              // Collect items on offer from all categories (deduplicate since popular items appear in multiple categories)
              final seenIds = <int>{};
              final offerItems = filteredItems.values
                  .expand((items) => items)
                  .where((item) => item.isOnOffer && seenIds.add(item.id))
                  .toList();

              // Compute layout state from data
              // The signed-in customer's usuals — a chip like offers, shown
              // first, and only when not searching.
              final usualItems = _searchQuery.isEmpty ? topItems.take(8).toList() : const <MenuItem>[];
              final hasUsuals = usualItems.isNotEmpty;
              final hasOffers = offerItems.isNotEmpty && _searchQuery.isEmpty;
              final categoryNames = [
                if (hasUsuals) l10n.yourUsuals,
                if (hasOffers) '${l10n.specialOffers} 🔥',
                ...filteredItems.keys.map((c) => c.name.getText(locale)),
              ];
              final topSectionsOffset = (hasUsuals ? 1 : 0) + (hasOffers ? 1 : 0);

              // Sync to fields used by scroll callbacks
              _categoryNames = categoryNames;

              // Set initial selected category (post-frame to avoid notifier
              // listeners firing during build)
              if (_selectedCategoryNotifier.value == null && categoryNames.isNotEmpty) {
                WidgetsBinding.instance.addPostFrameCallback((_) {
                  if (mounted && _selectedCategoryNotifier.value == null) {
                    _selectedCategoryNotifier.value = categoryNames.first;
                  }
                });
              }

              return Column(
                children: [
                  // Search bar — toggled by header search icon
                  if (_showSearch)
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      child: FTextField(
                        control: FTextFieldControl.managed(controller: _searchController),
                        hint: l10n.searchMenu,
                        autofocus: true,
                      ),
                    ),

                  // Sticky category menu — listens to notifier internally,
                  // only its chips rebuild on selection change.
                  _CategoryMenu(
                    variant: style.layout.categories,
                    categories: categoryNames,
                    selectedCategoryNotifier: _selectedCategoryNotifier,
                    onCategoryTap: _scrollToCategory,
                  ),

                  // Menu items — never rebuilt by scroll-driven state changes
                  Expanded(
                    child: RefreshIndicator(
                      color: colors.primary,
                      backgroundColor: colors.background,
                      onRefresh: () async {
                        ref.invalidate(groupedMenuItemsProvider((locale, branchId)));
                        // Wait for the new data to load
                        await ref.read(groupedMenuItemsProvider((locale, branchId)).future);
                      },
                      child: ScrollablePositionedList.builder(
                        itemScrollController: _itemScrollController,
                        itemPositionsListener: _itemPositionsListener,
                        padding: const EdgeInsets.only(bottom: 16),
                        itemCount: filteredItems.length + topSectionsOffset,
                        itemBuilder: (context, index) {
                          // "Your usuals" first — a normal titled section of
                          // the customer's most-ordered items.
                          if (hasUsuals && index == 0) {
                            return _CategorySection(
                              categoryName: l10n.yourUsuals,
                              items: usualItems,
                              locale: locale,
                              variant: variant,
                            );
                          }
                          // Offers section after usuals
                          if (hasOffers && index == (hasUsuals ? 1 : 0)) {
                            return _OffersSection(
                              items: offerItems,
                              locale: locale,
                              photos: variant != MenuItemLayout.compact,
                            );
                          }
                          final adjustedIndex = index - topSectionsOffset;
                          final entry = filteredItems.entries.elementAt(adjustedIndex);
                          final categoryName = entry.key.name.getText(locale);
                          final items = entry.value;
                          return _CategorySection(
                            categoryName: categoryName,
                            items: items,
                            locale: locale,
                            variant: variant,
                          );
                        },
                      ),
                    ),
                  ),
                ],
              );
            },
          ),
        ),

        // View Cart button (fixed at bottom)
        if (!cart.isEmpty)
          Builder(
            builder: (context) {
            final btnColors = context.theme.colors;
            final btnL10n = AppLocalizations.of(context)!;
            return Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: btnColors.background,
              border: Border(
                top: BorderSide(color: btnColors.border),
              ),
            ),
            child: SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => context.push('/cart'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: btnColors.primary,
                  foregroundColor: btnColors.primaryForeground,
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                  shape: style.buttonShape,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    AppText(
                      btnL10n.viewCart,
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 15,
                      ),
                    ),
                    AppText(
                      ref.watch(moneyProvider)(cart.totalPrice),
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 15,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
        ),
      ],
    );
  }

  Map<MenuCategory, List<MenuItem>> _filterItemsWithLocale(Map<MenuCategory, List<MenuItem>> items, Locale locale) {
    if (_searchQuery.isEmpty) return items;

    final filtered = <MenuCategory, List<MenuItem>>{};
    final query = normalizeSearch(_searchQuery);

    for (final entry in items.entries) {
      // Skip the synthetic "Most Popular" group (id -1): it re-lists popular
      // items that also live in their real category, which would otherwise make
      // a popular item show twice in search results.
      if (entry.key.id == -1) continue;
      final matchingItems = entry.value
          .where((item) =>
              normalizeSearch(item.name.getText(locale)).contains(query) ||
              normalizeSearch(item.description.getText(locale)).contains(query) ||
              normalizeSearch(item.name.en).contains(query) ||
              normalizeSearch(item.description.en).contains(query))
          .toList();
      if (matchingItems.isNotEmpty) {
        filtered[entry.key] = matchingItems;
      }
    }
    return filtered;
  }
}

/// Horizontal category menu — listens to [selectedCategoryNotifier] internally
/// so only this widget rebuilds when the selection changes during scrolling.
/// Laid out as the style says: [CategoriesLayout.chips] is the classic
/// strip, [CategoriesLayout.tabs] underlines the current one under its
/// label, and [CategoriesLayout.rail] (a side list on a wide web page) is
/// the chips on a phone.
class _CategoryMenu extends StatefulWidget {
  final CategoriesLayout variant;
  final List<String> categories;
  final ValueNotifier<String?> selectedCategoryNotifier;
  final Function(String) onCategoryTap;

  const _CategoryMenu({
    required this.variant,
    required this.categories,
    required this.selectedCategoryNotifier,
    required this.onCategoryTap,
  });

  @override
  State<_CategoryMenu> createState() => _CategoryMenuState();
}

class _CategoryMenuState extends State<_CategoryMenu> {
  final ScrollController _scrollController = ScrollController();
  final List<GlobalKey> _chipKeys = [];

  @override
  void initState() {
    super.initState();
    _syncKeys();
    widget.selectedCategoryNotifier.addListener(_onSelectionChanged);
  }

  @override
  void didUpdateWidget(_CategoryMenu oldWidget) {
    super.didUpdateWidget(oldWidget);
    _syncKeys();
  }

  void _syncKeys() {
    while (_chipKeys.length < widget.categories.length) {
      _chipKeys.add(GlobalKey());
    }
  }

  @override
  void dispose() {
    widget.selectedCategoryNotifier.removeListener(_onSelectionChanged);
    _scrollController.dispose();
    super.dispose();
  }

  void _onSelectionChanged() {
    _scrollToSelectedCategory();
    // Rebuild chips to update highlight — only this widget, not the parent.
    if (mounted) setState(() {});
  }

  void _scrollToSelectedCategory() {
    final selected = widget.selectedCategoryNotifier.value;
    if (selected == null) return;
    final index = widget.categories.indexOf(selected);
    if (index == -1 || !_scrollController.hasClients) return;
    if (index >= _chipKeys.length) return;

    final keyContext = _chipKeys[index].currentContext;
    if (keyContext != null) {
      Scrollable.ensureVisible(
        keyContext,
        alignment: 0.3,
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOut,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.theme.colors;
    final selected = widget.selectedCategoryNotifier.value;
    if (widget.variant == CategoriesLayout.tabs) return _tabs(colors, selected);
    return Container(
      height: 44,
      decoration: BoxDecoration(
        color: colors.background,
        border: Border(
          bottom: BorderSide(color: colors.border),
        ),
      ),
      child: ListView.builder(
        controller: _scrollController,
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 8),
        itemCount: widget.categories.length,
        itemBuilder: (context, index) {
          final category = widget.categories[index];
          final isSelected = category == selected;
          return GestureDetector(
            key: index < _chipKeys.length ? _chipKeys[index] : null,
            onTap: () => widget.onCategoryTap(category),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              decoration: BoxDecoration(
                border: Border(
                  bottom: BorderSide(
                    color: isSelected ? colors.primary : Colors.transparent,
                    width: 2,
                  ),
                ),
              ),
              alignment: Alignment.center,
              child: AppText(
                category,
                style: TextStyle(
                  color: isSelected ? colors.primary : colors.mutedForeground,
                  fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                  fontSize: 14,
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  /// Underlined tabs: quiet labels a tab's width apart, the current one in
  /// the text's colour with the brand's line hugging it from below
  Widget _tabs(FColors colors, String? selected) {
    return Container(
      height: 44,
      decoration: BoxDecoration(
        color: colors.background,
        border: Border(bottom: BorderSide(color: colors.border)),
      ),
      child: ListView.separated(
        controller: _scrollController,
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: widget.categories.length,
        separatorBuilder: (_, _) => const SizedBox(width: 20),
        itemBuilder: (context, index) {
          final category = widget.categories[index];
          final isSelected = category == selected;
          return GestureDetector(
            key: index < _chipKeys.length ? _chipKeys[index] : null,
            behavior: HitTestBehavior.opaque,
            onTap: () => widget.onCategoryTap(category),
            child: Stack(
              alignment: Alignment.center,
              children: [
                AppText(
                  category,
                  style: TextStyle(
                    color: isSelected ? colors.foreground : colors.mutedForeground,
                    fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                    fontSize: 14,
                  ),
                ),
                PositionedDirectional(
                  start: 0,
                  end: 0,
                  bottom: 0,
                  child: Container(
                    height: 2,
                    decoration: BoxDecoration(
                      color: isSelected ? colors.primary : Colors.transparent,
                      borderRadius: BorderRadius.circular(1),
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

/// Category section with header and items, laid out for the style's
/// [variant]: rows or text down the page, photo tiles two abreast, or wide
/// photos one under another
class _CategorySection extends StatelessWidget {
  final String categoryName;
  final List<MenuItem> items;
  final Locale locale;
  final MenuItemLayout variant;

  const _CategorySection({
    required this.categoryName,
    required this.items,
    required this.locale,
    this.variant = MenuItemLayout.row,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.theme.colors;
    final space = BrandStyle.of(context).space;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Category header
        Padding(
          padding: EdgeInsets.fromLTRB(16, 16 * space, 16, 8 * space),
          child: BrandHeading(categoryName, style: TextStyle(fontSize: 16, color: colors.foreground)),
        ),
        // Items
        ...switch (variant) {
          MenuItemLayout.row => [
            for (final (index, item) in items.indexed)
              MenuItemTile(item: item, isLast: index == items.length - 1, locale: locale),
          ],
          MenuItemLayout.compact => [
            for (final item in items) MenuItemTile(item: item, locale: locale, variant: variant),
          ],
          MenuItemLayout.hero => [
            for (final item in items)
              Padding(
                padding: EdgeInsets.fromLTRB(16, 0, 16, 16 * space),
                child: MenuItemTile(item: item, locale: locale, variant: variant),
              ),
          ],
          MenuItemLayout.card => [
            for (var i = 0; i < items.length; i += 2)
              Padding(
                padding: EdgeInsets.fromLTRB(16, 0, 16, 12 * space),
                child: IntrinsicHeight(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Expanded(
                        child: MenuItemTile(item: items[i], locale: locale, variant: variant),
                      ),
                      SizedBox(width: 12 * space),
                      Expanded(
                        child: i + 1 < items.length
                            ? MenuItemTile(item: items[i + 1], locale: locale, variant: variant)
                            : const SizedBox.shrink(),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        },
      ],
    );
  }
}

/// One item on the menu, dressed as the style's [variant] says; every way
/// adds, steps, favours and fast-orders the same.
///
/// * [MenuItemLayout.row]: the classic list row, a 64px picture with the
///   heart and the offer ribbon, the text, the add button or stepper
/// * [MenuItemLayout.card]: a photo tile for a two-column grid, the add
///   button on the photo's corner, the name and price under it
/// * [MenuItemLayout.compact]: text only, as a printed menu sets it: the
///   name, a dotted leader, the price; the description under
/// * [MenuItemLayout.hero]: a wide 16:9 photo with the text under it
class MenuItemTile extends ConsumerStatefulWidget {
  final MenuItem item;
  final bool isLast;
  final Locale locale;
  final MenuItemLayout variant;

  const MenuItemTile({
    super.key,
    required this.item,
    this.isLast = false,
    required this.locale,
    this.variant = MenuItemLayout.row,
  });


  @override
  ConsumerState<MenuItemTile> createState() => _MenuItemTileState();
}

class _MenuItemTileState extends ConsumerState<MenuItemTile> {
  double _fastOrderProgress = 0.0;
  Timer? _progressTimer;

  @override
  void dispose() {
    _progressTimer?.cancel();
    _progressTimer = null;
    super.dispose();
  }

  void _cancelFastOrder() {
    _progressTimer?.cancel();
    _progressTimer = null;
    if (mounted) {
      setState(() {
        _fastOrderProgress = 0.0;
      });
    }
  }

  void _startFastOrder(LongPressStartDetails details) {
    setState(() {
      _fastOrderProgress = 0.0;
    });

    // 20 ticks over 1 second
    const totalTicks = 20;
    var tick = 0;
    _progressTimer = Timer.periodic(const Duration(milliseconds: 50), (timer) {
      tick++;
      final progress = tick / totalTicks;

      if (!mounted) {
        timer.cancel();
        return;
      }

      if (progress >= 1.0) {
        timer.cancel();
        setState(() {
          _fastOrderProgress = 0.0;
        });
        _showFastOrderConfirmation();
      } else {
        setState(() => _fastOrderProgress = progress);
      }
    });
  }

  void _endFastOrder(LongPressEndDetails details) {
    if (_fastOrderProgress < 1.0) {
      _cancelFastOrder();
    }
  }

  /// Resolve customization option names for display (defaults + user preference overlay).
  List<String> _resolveCustomizationNames(UserItemPreference? preference, Locale locale) {
    final item = widget.item;
    if (item.customizations.isEmpty) return [];

    final selectedOptions = <int, List<int>>{};

    // Apply defaults first (never a sold-out option)
    for (final customization in item.customizations) {
      final defaults = customization.options
          .where((o) => o.isDefault && !o.isOutOfStock)
          .map((o) => o.id)
          .toList();
      if (defaults.isNotEmpty) {
        selectedOptions[customization.id] = defaults;
      } else if (customization.isRequired) {
        final first = customization.options.where((o) => !o.isOutOfStock).firstOrNull;
        if (first != null) selectedOptions[customization.id] = [first.id];
      }
    }

    // Overlay saved preferences
    if (preference != null) {
      final savedByCustomization = <int, List<int>>{};
      for (final option in preference.selectedOptions) {
        savedByCustomization
            .putIfAbsent(option.customizationId, () => [])
            .add(option.optionId);
      }
      for (final customization in item.customizations) {
        final savedOpts = savedByCustomization[customization.id];
        if (savedOpts != null && savedOpts.isNotEmpty) {
          final validOptions = savedOpts
              .where((optionId) => customization.options
                  .any((o) => o.id == optionId && !o.isOutOfStock))
              .toList();
          if (validOptions.isNotEmpty) {
            selectedOptions[customization.id] = validOptions;
          }
        }
      }
    }

    // Resolve to display names
    final names = <String>[];
    for (final customization in item.customizations) {
      final optionIds = selectedOptions[customization.id] ?? [];
      for (final optionId in optionIds) {
        final option = customization.options
            .where((o) => o.id == optionId)
            .firstOrNull;
        if (option != null) names.add(option.name.getText(locale));
      }
    }
    return names;
  }

  Future<void> _showFastOrderConfirmation() async {
    final l10n = AppLocalizations.of(context)!;
    final locale = ref.read(localeProvider);
    final menuService = ref.read(menuRepositoryProvider);
    final colors = context.theme.colors;

    // Fetch preference before showing dialog so we can display it
    final preference = await menuService.getUserPreference(widget.item.id);
    if (!mounted) return;

    final customizationNames = _resolveCustomizationNames(preference, locale);

    final confirmed = await showAdaptiveDialog<bool>(
      context: context,
      builder: (context) => FDialog(
        direction: Axis.horizontal,
        title: AppText(l10n.fastOrder),
        body: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AppText(widget.item.name.getText(locale)),
            if (customizationNames.isNotEmpty) ...[
              const SizedBox(height: 8),
              AppText(
                customizationNames.join(', '),
                style: TextStyle(
                  color: colors.mutedForeground,
                  fontSize: 13,
                ),
              ),
            ],
          ],
        ),
        actions: [
          FButton(
            variant: FButtonVariant.outline,
            child: AppText(l10n.cancel),
            onPress: () => Navigator.of(context).pop(false),
          ),
          FButton(
            child: AppText(l10n.confirm),
            onPress: () => Navigator.of(context).pop(true),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      await _submitFastOrder(preference);
    }
  }

  Future<void> _submitFastOrder(UserItemPreference? preference) async {
    if (!mounted) return;

    // Ensure user has name + phone before placing order
    if (!await ensureProfileComplete(context, ref)) return;
    if (!mounted) return;

    final l10n = AppLocalizations.of(context)!;
    final currentAuthState = ref.read(authServiceProvider);
    final orderService = ref.read(orderRepositoryProvider);

    // The active stay's place (optional); the ids ride along so the order
    // lands on the stay's bill
    await ref.read(myStaysProvider.notifier).refresh();
    int? placeId;
    String? placeKind;
    Map<String, dynamic>? placeName;
    int? sessionId;
    final sessionsState = ref.read(myStaysProvider);
    if (sessionsState.hasValue) {
      final activeSession = sessionsState.value!
          .where((s) => s.status == StayStatus.active)
          .firstOrNull;
      if (activeSession != null) {
        placeId = activeSession.placeId;
        placeKind = activeSession.placeKind.wireName;
        placeName = activeSession.placeName.toJson();
        sessionId = activeSession.id;
      }
    }

    try {
      await orderService.submitFastOrder(
        item: widget.item,
        userId: currentAuthState.userId ?? '',
        userName: currentAuthState.name ?? 'Guest',
        placeId: placeId,
        placeKind: placeKind,
        placeName: placeName,
        sessionId: sessionId,
        preference: preference,
      );
      if (!mounted) return;

      ref.read(ordersProvider.notifier).refresh();
      SoundService.instance.playSuccess();

      showFToast(
        context: context,
        title: Text(l10n.fastOrderPlaced),
        icon: Icon(FIcons.check, color: AppTheme.successColor),
      );
    } catch (e) {
      if (mounted) {
        showFToast(
          context: context,
          title: Text(l10n.failedToPlaceOrder),
          icon: Icon(FIcons.circleX, color: context.theme.colors.destructive),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isOrderingEnabled = ref.watch(branchProvider).selectedBranch?.isOrderingEnabled ?? true;
    return GestureDetector(
      onTap: isOrderingEnabled ? () => _showCustomizationSheet(context, ref) : null,
      onLongPressStart: isOrderingEnabled ? _startFastOrder : null,
      onLongPressEnd: isOrderingEnabled ? _endFastOrder : null,
      child: switch (widget.variant) {
        MenuItemLayout.row => _buildRow(context),
        MenuItemLayout.card => _buildCard(context),
        MenuItemLayout.compact => _buildCompact(context),
        MenuItemLayout.hero => _buildHero(context),
      },
    );
  }

  /// The classic row, exactly as it always was (its padding breathes with the density)
  Widget _buildRow(BuildContext context) {
    final colors = context.theme.colors;
    final l10n = AppLocalizations.of(context)!;
    final money = ref.watch(moneyProvider);
    final isFavorite = ref.watch(favoritesProvider).favoriteIds.contains(widget.item.id);
    final item = widget.item;
    final locale = widget.locale;
    final space = BrandStyle.of(context).space;

    return Container(
        padding: EdgeInsets.symmetric(horizontal: 16, vertical: 12 * space),
        decoration: widget.isLast
            ? null
            : BoxDecoration(
                border: Border(
                  bottom: BorderSide(color: colors.border),
                ),
              ),
        child: Row(
          children: [
            // Image with heart overlay
            Stack(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: SizedBox(
                    width: 64,
                    height: 64,
                    child: item.pictureUri != null
                        ? CachedNetworkImage(
                            imageUrl: item.pictureUri!,
                            fit: BoxFit.cover,
                            placeholder: (context, url) => Container(
                              color: colors.muted,
                              child: Center(
                                child: SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: colors.primary,
                                  ),
                                ),
                              ),
                            ),
                            errorWidget: (context, url, error) => Container(
                              color: colors.muted,
                              child: Icon(FIcons.utensils, size: 24, color: colors.mutedForeground),
                            ),
                          )
                        : Container(
                            color: colors.muted,
                            child: Icon(FIcons.utensils, size: 24, color: colors.mutedForeground),
                          ),
                  ),
                ),
                // Heart icon overlay - positioned based on text direction
                PositionedDirectional(
                  top: 4,
                  start: 4,
                  child: GestureDetector(
                    onTap: () => ref.read(favoritesProvider.notifier).toggleFavorite(item.id),
                    child: Icon(
                      isFavorite ? Icons.favorite : Icons.favorite_border,
                      size: 18,
                      color: isFavorite ? Colors.red : Colors.white,
                      shadows: const [
                        Shadow(color: Colors.black54, blurRadius: 4),
                      ],
                    ),
                  ),
                ),
                // Offer badge
                if (item.isOnOffer)
                  PositionedDirectional(
                    bottom: 0,
                    start: 0,
                    end: 0,
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 2),
                      decoration: const BoxDecoration(
                        color: Colors.green,
                        borderRadius: BorderRadius.only(
                          bottomLeft: Radius.circular(8),
                          bottomRight: Radius.circular(8),
                        ),
                      ),
                      child: AppText(
                        l10n.offer,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(width: 12),

            // Info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  AppText(
                    item.name.getText(locale),
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 15,
                      color: colors.foreground,
                    ),
                  ),
                  if (item.description.getText(locale).isNotEmpty) ...[
                    const SizedBox(height: 2),
                    AppText(
                      item.description.getText(locale),
                      style: TextStyle(
                        color: colors.mutedForeground,
                        fontSize: 13,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                  const SizedBox(height: 4),
                  AppText(
                    money(item.effectivePrice),
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                      color: item.isOnOffer ? Colors.green : colors.foreground,
                    ),
                  ),
                  if (item.isOnOffer && item.offerPrice != null)
                    AppText(
                      money(item.price),
                      style: TextStyle(
                        fontSize: 12,
                        color: colors.mutedForeground,
                        decoration: TextDecoration.lineThrough,
                      ),
                    ),
                ],
              ),
            ),

            // Quantity stepper or add button (with fast order progress)
            _addControl(context),
          ],
        ),
      );
  }

  /// The fast-order ring while a long press counts down, the stepper once
  /// the item is in the cart, else the add button (a chevron when it opens
  /// the options, with a caption under it when [caption])
  Widget _addControl(BuildContext context, {bool caption = true}) {
    final colors = context.theme.colors;
    final l10n = AppLocalizations.of(context)!;
    final cart = ref.watch(cartProvider);
    final cartQuantity = _getCartQuantity(cart, widget.item.id);
    final item = widget.item;
    final round = BrandStyle.of(context).roundRadius;

    if (_fastOrderProgress > 0) {
      return Container(
        width: 34,
        height: 34,
        decoration: round >= 17
            ? BoxDecoration(color: colors.primary, shape: BoxShape.circle)
            : BoxDecoration(color: colors.primary, borderRadius: BorderRadius.circular(round)),
        child: Stack(
          alignment: Alignment.center,
          children: [
            SizedBox(
              width: 30,
              height: 30,
              child: CircularProgressIndicator(
                value: _fastOrderProgress,
                strokeWidth: 2.5,
                color: colors.primaryForeground,
                backgroundColor: colors.primaryForeground.withValues(alpha: 0.3),
              ),
            ),
            Icon(
              FIcons.zap,
              color: colors.primaryForeground,
              size: 14,
            ),
          ],
        ),
      );
    }
    if (cartQuantity > 0) {
      return _QuantityStepper(
        quantity: cartQuantity,
        radius: round,
        onIncrement: () => _incrementInCart(ref, cart, item.id),
        onDecrement: () => _decrementFromCart(ref, cart, item.id),
      );
    }
    return Stack(
      clipBehavior: Clip.none,
      alignment: Alignment.topCenter,
      children: [
        GestureDetector(
          onTap: () => _handleAddTap(context, ref),
          child: Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: colors.primary,
              borderRadius: BorderRadius.circular(round),
            ),
            child: Icon(
              item.customizations.isNotEmpty ? FIcons.chevronRight : FIcons.plus,
              color: colors.primaryForeground,
              size: 18,
            ),
          ),
        ),
        if (caption && item.customizations.isNotEmpty)
          Positioned(
            top: 36,
            child: AppText(
              l10n.customizable,
              style: TextStyle(
                fontSize: 10,
                color: colors.mutedForeground,
              ),
            ),
          ),
      ],
    );
  }

  /// The heart: white with a shadow over a photo, the muted text's colour beside text
  Widget _favorite({bool onPhoto = true}) {
    final colors = context.theme.colors;
    final isFavorite = ref.watch(favoritesProvider).favoriteIds.contains(widget.item.id);
    return GestureDetector(
      onTap: () => ref.read(favoritesProvider.notifier).toggleFavorite(widget.item.id),
      child: Icon(
        isFavorite ? Icons.favorite : Icons.favorite_border,
        size: 18,
        color: isFavorite ? Colors.red : (onPhoto ? Colors.white : colors.mutedForeground),
        shadows: onPhoto ? const [Shadow(color: Colors.black54, blurRadius: 4)] : null,
      ),
    );
  }

  /// The green "Offer" pill a photo wears in its corner
  Widget _offerBadge({double fontSize = 10}) {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: fontSize * 0.8, vertical: fontSize * 0.25),
      decoration: BoxDecoration(color: Colors.green, borderRadius: BorderRadius.circular(999)),
      child: AppText(
        AppLocalizations.of(context)!.offer,
        style: TextStyle(color: Colors.white, fontSize: fontSize, fontWeight: FontWeight.bold),
      ),
    );
  }

  /// The price, the offer's in green with the old one struck through beside it
  Widget _price() {
    final colors = context.theme.colors;
    final money = ref.watch(moneyProvider);
    final item = widget.item;
    return Wrap(
      spacing: 8,
      crossAxisAlignment: WrapCrossAlignment.end,
      children: [
        AppText(
          money(item.effectivePrice),
          style: TextStyle(
            fontWeight: FontWeight.bold,
            fontSize: 14,
            color: item.isOnOffer ? Colors.green : colors.foreground,
          ),
        ),
        if (item.isOnOffer && item.offerPrice != null)
          AppText(
            money(item.price),
            style: TextStyle(
              fontSize: 12,
              color: colors.mutedForeground,
              decoration: TextDecoration.lineThrough,
            ),
          ),
      ],
    );
  }

  /// The item's picture filling its box, or the utensils on the muted fill
  Widget _picture(double iconSize) {
    final colors = context.theme.colors;
    final fallback = Container(
      color: colors.muted,
      child: Center(child: Icon(FIcons.utensils, size: iconSize, color: colors.mutedForeground.withValues(alpha: 0.5))),
    );
    final uri = widget.item.pictureUri;
    if (uri == null) return fallback;
    return CachedNetworkImage(
      imageUrl: uri,
      fit: BoxFit.cover,
      placeholder: (context, url) => Container(color: colors.muted),
      errorWidget: (context, url, error) => fallback,
    );
  }

  /// A photo tile for the grid: the square picture with the heart, the
  /// offer and the add button on its corners, the name and the price under it
  Widget _buildCard(BuildContext context) {
    final colors = context.theme.colors;
    final style = BrandStyle.of(context);
    final isOrderingEnabled = ref.watch(branchProvider).selectedBranch?.isOrderingEnabled ?? true;
    final inCart = _getCartQuantity(ref.watch(cartProvider), widget.item.id) > 0;

    final space = style.space;
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: style.surface(colors, radius: style.radius + 4),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              AspectRatio(
                aspectRatio: 1,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    _picture(32),
                    PositionedDirectional(top: 8, start: 8, child: _favorite()),
                    if (widget.item.isOnOffer) PositionedDirectional(top: 8, end: 8, child: _offerBadge()),
                    if (isOrderingEnabled)
                      PositionedDirectional(
                        bottom: 8,
                        end: 8,
                        child: Container(
                          padding: inCart ? const EdgeInsets.all(2) : EdgeInsets.zero,
                          decoration: BoxDecoration(
                            color: inCart ? colors.background.withValues(alpha: 0.9) : null,
                            borderRadius: BorderRadius.circular(style.roundRadius + 2),
                            boxShadow: const [BoxShadow(color: Color(0x33000000), blurRadius: 6, offset: Offset(0, 2))],
                          ),
                          child: _addControl(context, caption: false),
                        ),
                      ),
                  ],
                ),
              ),
              Padding(
                padding: EdgeInsetsDirectional.fromSTEB(10 * space, 10 * space, 10 * space, 4),
                child: AppText(
                  widget.item.name.getText(widget.locale),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14, height: 1.3, color: colors.foreground),
                ),
              ),
            ],
          ),
          // The price sits on the tile's floor, so a row of tiles lines up
          Padding(padding: EdgeInsetsDirectional.fromSTEB(10 * space, 0, 10 * space, 10 * space), child: _price()),
        ],
      ),
    );
  }

  /// Text only: the name, a dotted leader and the price on one line, the
  /// description under, the heart and the add button at the end
  Widget _buildCompact(BuildContext context) {
    final colors = context.theme.colors;
    final l10n = AppLocalizations.of(context)!;
    final money = ref.watch(moneyProvider);
    final style = BrandStyle.of(context);
    final item = widget.item;
    final description = item.description.getText(widget.locale);
    final isOrderingEnabled = ref.watch(branchProvider).selectedBranch?.isOrderingEnabled ?? true;

    return Padding(
      padding: EdgeInsets.symmetric(horizontal: 16, vertical: 12 * style.space),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Flexible(
                      child: AppText(
                        item.name.getText(widget.locale),
                        style: TextStyle(fontWeight: FontWeight.w500, fontSize: 15, color: colors.foreground),
                      ),
                    ),
                    if (item.isOnOffer) ...[
                      const SizedBox(width: 8),
                      Padding(
                        padding: const EdgeInsets.only(bottom: 2),
                        child: AppText(
                          l10n.offer.toUpperCase(),
                          style: const TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 0.5,
                            color: Colors.green,
                          ),
                        ),
                      ),
                    ],
                    const SizedBox(width: 8),
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(bottom: 6),
                        child: CustomPaint(
                          size: const Size(16, 2),
                          painter: _DottedLeader(colors.mutedForeground.withValues(alpha: 0.4)),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    AppText(
                      money(item.effectivePrice),
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                        color: item.isOnOffer ? Colors.green : colors.foreground,
                        fontFeatures: const [FontFeature.tabularFigures()],
                      ),
                    ),
                  ],
                ),
                if (item.isOnOffer && item.offerPrice != null)
                  Align(
                    alignment: AlignmentDirectional.centerEnd,
                    child: AppText(
                      money(item.price),
                      style: TextStyle(
                        fontSize: 12,
                        color: colors.mutedForeground,
                        decoration: TextDecoration.lineThrough,
                      ),
                    ),
                  ),
                if (description.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  AppText(
                    description,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(color: colors.mutedForeground, fontSize: 13),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 12),
          _favorite(onPhoto: false),
          if (isOrderingEnabled) ...[
            const SizedBox(width: 8),
            _addControl(context, caption: false),
          ],
        ],
      ),
    );
  }

  /// A wide photo with the name, the description and the price under it:
  /// the dish is the page
  Widget _buildHero(BuildContext context) {
    final colors = context.theme.colors;
    final style = BrandStyle.of(context);
    final item = widget.item;
    final description = item.description.getText(widget.locale);
    final isOrderingEnabled = ref.watch(branchProvider).selectedBranch?.isOrderingEnabled ?? true;

    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: style.surface(colors, radius: style.radius + 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AspectRatio(
            aspectRatio: 16 / 9,
            child: Stack(
              fit: StackFit.expand,
              children: [
                _picture(40),
                PositionedDirectional(top: 12, start: 12, child: _favorite()),
                if (item.isOnOffer) PositionedDirectional(top: 12, end: 12, child: _offerBadge(fontSize: 12)),
              ],
            ),
          ),
          Padding(
            padding: EdgeInsets.all(16 * style.space),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      BrandHeading(
                        item.name.getText(widget.locale),
                        style: TextStyle(fontSize: 18, height: 1.2, color: colors.foreground),
                      ),
                      if (description.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        AppText(
                          description,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(color: colors.mutedForeground, fontSize: 13),
                        ),
                      ],
                      const SizedBox(height: 6),
                      _price(),
                    ],
                  ),
                ),
                if (isOrderingEnabled) ...[
                  const SizedBox(width: 12),
                  _addControl(context, caption: false),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  int _getCartQuantity(Cart cart, int productId) {
    int total = 0;
    for (final cartItem in cart.items) {
      if (cartItem.productId == productId) {
        total += cartItem.quantity;
      }
    }
    return total;
  }

  void _handleAddTap(BuildContext context, WidgetRef ref) {
    if (widget.item.customizations.isEmpty) {
      _addToCart(ref);
    } else {
      _showCustomizationSheet(context, ref);
    }
  }

  void _addToCart(WidgetRef ref) {
    final cartItem = CartItem.fromMenuItem(widget.item);
    ref.read(cartProvider.notifier).addItem(cartItem);
  }

  void _incrementInCart(WidgetRef ref, Cart cart, int productId) {
    // Bump the most recent cart line for this product so its customizations
    // carry over — adding a bare item here would create a second,
    // uncustomized line instead
    for (int i = cart.items.length - 1; i >= 0; i--) {
      if (cart.items[i].productId == productId) {
        ref.read(cartProvider.notifier).updateQuantity(i, cart.items[i].quantity + 1);
        return;
      }
    }
    _addToCart(ref);
  }

  void _decrementFromCart(WidgetRef ref, Cart cart, int productId) {
    for (int i = cart.items.length - 1; i >= 0; i--) {
      if (cart.items[i].productId == productId) {
        if (cart.items[i].quantity > 1) {
          ref.read(cartProvider.notifier).updateQuantity(i, cart.items[i].quantity - 1);
        } else {
          ref.read(cartProvider.notifier).removeItem(i);
        }
        break;
      }
    }
  }

  void _showCustomizationSheet(BuildContext context, WidgetRef ref) {
    if (widget.item.customizations.isEmpty) {
      _addToCart(ref);
    } else {
      showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        useRootNavigator: true,
        backgroundColor: Colors.transparent,
        barrierColor: Colors.black.withValues(alpha: 0.5),
        builder: (context) => ItemCustomizationSheet(item: widget.item),
      );
    }
  }
}

/// Offers section showing items on offer in a horizontal list
class _OffersSection extends ConsumerWidget {
  final List<MenuItem> items;
  final Locale locale;

  /// False for a style without photos: the cards are text
  final bool photos;

  const _OffersSection({required this.items, required this.locale, this.photos = true});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.theme.colors;
    final l10n = AppLocalizations.of(context)!;

    final space = BrandStyle.of(context).space;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: EdgeInsets.fromLTRB(16, 16 * space, 16, 8 * space),
          child: BrandHeading(
            l10n.specialOffers,
            style: TextStyle(fontSize: 16, color: colors.foreground),
          ),
        ),
        SizedBox(
          height: photos ? 220 : 100,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            itemCount: items.length,
            itemBuilder: (context, index) => _OfferItemCard(
              item: items[index],
              locale: locale,
              photos: photos,
            ),
          ),
        ),
      ],
    );
  }
}

/// Card for a single offer item
class _OfferItemCard extends ConsumerWidget {
  final MenuItem item;
  final Locale locale;
  final bool photos;

  const _OfferItemCard({required this.item, required this.locale, this.photos = true});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.theme.colors;
    final money = ref.watch(moneyProvider);
    final style = BrandStyle.of(context);
    final square = style.layout.buttons == ButtonsLayout.square;

    return GestureDetector(
      onTap: () {
        if (item.customizations.isEmpty) {
          final cartItem = CartItem.fromMenuItem(item);
          ref.read(cartProvider.notifier).addItem(cartItem);
        } else {
          showModalBottomSheet(
            context: context,
            isScrollControlled: true,
            useRootNavigator: true,
            backgroundColor: Colors.transparent,
            barrierColor: Colors.black.withValues(alpha: 0.5),
            builder: (context) => ItemCustomizationSheet(item: item),
          );
        }
      },
      child: Container(
        width: 160,
        margin: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
        decoration: style.surface(colors, radius: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Image
            if (photos)
              ClipRRect(
                borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
                child: SizedBox(
                  width: double.infinity,
                  height: 120,
                  child: item.pictureUri != null
                      ? CachedNetworkImage(
                          imageUrl: item.pictureUri!,
                          fit: BoxFit.cover,
                          placeholder: (context, url) => Container(
                            color: colors.muted,
                            child: Center(
                              child: SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: colors.primary,
                                ),
                              ),
                            ),
                          ),
                          errorWidget: (context, url, error) => Container(
                            color: colors.muted,
                            child: Icon(FIcons.utensils, size: 32, color: colors.mutedForeground),
                          ),
                        )
                      : Container(
                          color: colors.muted,
                          child: Icon(FIcons.utensils, size: 32, color: colors.mutedForeground),
                        ),
                ),
              ),
            // Info
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    AppText(
                      item.name.getText(locale),
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 13,
                        color: colors.foreground,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const Spacer(),
                    Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              AppText(
                                money(item.effectivePrice),
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 14,
                                  color: Colors.green,
                                ),
                              ),
                              AppText(
                                money(item.price),
                                style: TextStyle(
                                  fontSize: 11,
                                  color: colors.mutedForeground,
                                  decoration: TextDecoration.lineThrough,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Builder(builder: (context) {
                          final cartQty = ref.watch(cartProvider).items
                              .where((c) => c.productId == item.id)
                              .fold(0, (sum, c) => sum + c.quantity);
                          if (cartQty > 0) {
                            return Container(
                              width: 28,
                              height: 28,
                              decoration: BoxDecoration(
                                color: colors.primary,
                                borderRadius: BorderRadius.circular(square ? 4 : 14),
                              ),
                              alignment: Alignment.center,
                              child: Text(
                                '$cartQty',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  color: colors.primaryForeground,
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            );
                          }
                          return Container(
                            padding: const EdgeInsets.all(6),
                            decoration: BoxDecoration(
                              color: colors.primary,
                              borderRadius: BorderRadius.circular(square ? 4 : 16),
                            ),
                            child: Icon(
                              item.customizations.isNotEmpty ? FIcons.chevronRight : FIcons.plus,
                              color: colors.primaryForeground,
                              size: 16,
                            ),
                          );
                        }),
                      ],
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

/// Quantity stepper widget
class _QuantityStepper extends StatelessWidget {
  final int quantity;
  final VoidCallback onIncrement;
  final VoidCallback onDecrement;

  /// The corners: a pill unless the style squares its buttons
  final double radius;

  const _QuantityStepper({
    required this.quantity,
    required this.onIncrement,
    required this.onDecrement,
    this.radius = 20,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.theme.colors;
    // Wrap in GestureDetector with opaque behavior to prevent taps from propagating to parent
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () {}, // Absorb taps to prevent parent from receiving them
      child: Container(
        height: 34,
        decoration: BoxDecoration(
          border: Border.all(color: colors.primary),
          borderRadius: BorderRadius.circular(radius),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: onDecrement,
              child: Container(
                padding: const EdgeInsets.all(8),
                child: Icon(
                  quantity == 1 ? FIcons.trash2 : FIcons.minus,
                  color: quantity == 1 ? context.theme.colors.destructive : colors.primary,
                  size: 18,
                ),
              ),
            ),
            Container(
              constraints: const BoxConstraints(minWidth: 24),
              alignment: Alignment.center,
              child: AppText(
                '$quantity',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                  color: colors.foreground,
                ),
              ),
            ),
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: onIncrement,
              child: Container(
                padding: const EdgeInsets.all(8),
                child: Icon(
                  FIcons.plus,
                  color: colors.primary,
                  size: 18,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The top of the menu as the style lays it out, the scan and search
/// actions always at the end:
///
/// * [HeaderLayout.left]: the classic header, the title at the start
/// * [HeaderLayout.center]: the brand centred
/// * [HeaderLayout.banner]: the café's cover photo with the brand over it,
///   light on a dark scrim whatever the page's scheme; without a cover, the
///   brand large on a panel of its accent
class MenuHeader extends ConsumerWidget {
  final HeaderLayout variant;
  final String title;
  final bool searchOpen;
  final VoidCallback onScan;
  final VoidCallback onSearch;

  const MenuHeader({
    super.key,
    required this.variant,
    required this.title,
    required this.searchOpen,
    required this.onScan,
    required this.onSearch,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.theme.colors;
    final searchIcon = searchOpen ? FIcons.x : FIcons.search;
    switch (variant) {
      case HeaderLayout.left:
        return FHeader(
          title: AppText(title, style: TextStyle(fontSize: 18)),
          suffixes: [
            FHeaderAction(icon: const Icon(Icons.qr_code_scanner, size: 20), onPress: onScan),
            const SizedBox(width: 6),
            FHeaderAction(icon: Icon(searchIcon, size: 20), onPress: onSearch),
          ],
        );
      case HeaderLayout.center:
        // Balanced: the actions at the end are mirrored by room at the start,
        // so the brand sits in the true middle. The nested header lays its
        // sides out in the constraints it is given, so it gets loose ones.
        return Align(
          alignment: AlignmentDirectional.topStart,
          heightFactor: 1,
          child: FHeader.nested(
            title: const _BrandLockup(height: 32),
            prefixes: const [SizedBox(width: 46)],
            suffixes: [
              FHeaderAction(icon: const Icon(Icons.qr_code_scanner, size: 20), onPress: onScan),
              const SizedBox(width: 6),
              FHeaderAction(icon: Icon(searchIcon, size: 20), onPress: onSearch),
            ],
          ),
        );
      case HeaderLayout.banner:
        final cover = ref.watch(brandProvider.select((b) => b.cover));
        final ink = cover != null ? Colors.white : colors.secondaryForeground;
        final actions = PositionedDirectional(
          top: 8,
          end: 8,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              _BannerAction(icon: Icons.qr_code_scanner, color: ink, onTap: onScan, scrim: cover != null),
              const SizedBox(width: 6),
              _BannerAction(icon: searchIcon, color: ink, onTap: onSearch, scrim: cover != null),
            ],
          ),
        );
        if (cover == null) {
          return Container(
            width: double.infinity,
            color: colors.secondary,
            child: Stack(
              children: [
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 32),
                  child: Center(child: _BrandLockup(height: 48, color: ink)),
                ),
                actions,
              ],
            ),
          );
        }
        return SizedBox(
          height: 176,
          width: double.infinity,
          child: Stack(
            fit: StackFit.expand,
            children: [
              CachedNetworkImage(
                imageUrl: cover.url,
                fit: BoxFit.cover,
                placeholder: (_, _) => ColoredBox(color: colors.muted),
                errorWidget: (_, _, _) => ColoredBox(color: colors.muted),
              ),
              const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.bottomCenter,
                    end: Alignment.topCenter,
                    colors: [Color(0xBF000000), Color(0x40000000), Color(0x1A000000)],
                  ),
                ),
              ),
              actions,
              const PositionedDirectional(
                start: 20,
                end: 20,
                bottom: 20,
                child: Align(
                  alignment: AlignmentDirectional.bottomStart,
                  // Over the scrim the brand is always light: the dark scheme's images
                  child: _BrandLockup(height: 44, color: Colors.white, brightness: Brightness.dark),
                ),
              ),
            ],
          ),
        );
    }
  }
}

/// The brand for a header: the wordmark when the café has one, else its
/// mark with the name beside it, set as a heading
class _BrandLockup extends ConsumerWidget {
  final double height;

  /// The name's colour; the page's text when null
  final Color? color;

  /// The page's brightness where it is not the theme's (over the cover photo)
  final Brightness? brightness;

  const _BrandLockup({required this.height, this.color, this.brightness});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final name = ref.watch(brandNameProvider);
    return BrandWordmark(
      height: height,
      maxWidth: MediaQuery.sizeOf(context).width * 0.6,
      brightness: brightness,
      fallback: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          BrandMark(size: height * 0.8, brightness: brightness),
          SizedBox(width: height * 0.25),
          Flexible(
            child: BrandHeading(
              name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: height * 0.45, color: color ?? context.theme.colors.foreground),
            ),
          ),
        ],
      ),
    );
  }
}

/// A header action on the banner: the icon in the banner's ink, on a soft
/// dark disc over a photo so it reads on any cover
class _BannerAction extends StatelessWidget {
  final IconData icon;
  final Color color;
  final VoidCallback onTap;
  final bool scrim;

  const _BannerAction({required this.icon, required this.color, required this.onTap, required this.scrim});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: scrim ? Colors.black.withValues(alpha: 0.3) : null,
        ),
        child: Icon(icon, size: 20, color: color),
      ),
    );
  }
}

/// The dotted line a printed menu runs from a dish's name to its price
class _DottedLeader extends CustomPainter {
  final Color color;

  const _DottedLeader(this.color);

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = color;
    const step = 4.0;
    final y = size.height / 2;
    for (var x = 1.0; x < size.width; x += step) {
      canvas.drawCircle(Offset(x, y), 0.8, paint);
    }
  }

  @override
  bool shouldRepaint(_DottedLeader oldDelegate) => oldDelegate.color != color;
}

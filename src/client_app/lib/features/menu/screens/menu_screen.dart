import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import 'package:scrollable_positioned_list/scrollable_positioned_list.dart';
import '../../../core/auth/auth_service.dart';
import '../../rooms/screens/qr_scan_screen.dart';
import '../../../core/widgets/profile_gate.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_text.dart';
import '../../../l10n/app_localizations.dart';
import '../../../core/providers/branch_provider.dart';
import '../../../core/providers/locale_provider.dart';
import '../models/bundle_deal.dart';
import '../models/menu_item.dart';
import '../models/user_preference.dart';
import '../services/menu_service.dart';
import '../providers/favorites_provider.dart';
import '../../cart/models/cart_item.dart';
import '../../cart/services/cart_service.dart';
import '../../orders/services/order_service.dart';
import '../../rooms/models/room.dart';
import '../../rooms/services/room_service.dart';
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
  bool _hasDealsSection = false;

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

    // Offset for deals section (offers is part of _categoryNames now)
    final dealsOffset = _hasDealsSection ? 1 : 0;
    final adjustedIndex = topIndex - dealsOffset;

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

    // Only deals section is outside _categoryNames; offers is included
    final dealsOffset = _hasDealsSection ? 1 : 0;

    _isProgrammaticScroll = true;
    _itemScrollController.scrollTo(
      index: index + dealsOffset,
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
    final bundlesAsync = ref.watch(activeBundlesProvider(branchId));
    final bundles = bundlesAsync.value ?? [];
    final cart = ref.watch(cartProvider);
    final colors = context.theme.colors;
    final l10n = AppLocalizations.of(context)!;
    final branchState = ref.watch(branchProvider);
    final isOrderingEnabled = branchState.selectedBranch?.isOrderingEnabled ?? true;

    return Column(
      children: [
        // Header with search toggle
        FHeader(
          title: AppText(l10n.menu, style: TextStyle(fontSize: 18)),
          suffixes: [
            // Scanning lives here rather than under Rooms: the customer
            // scanning a sticker is about to order, and the code they point at
            // decides whether it is a room or a table.
            FHeaderAction(
              icon: const Icon(Icons.qr_code_scanner, size: 20),
              onPress: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const QrScanScreen()),
              ),
            ),
            const SizedBox(width: 6),
            FHeaderAction(
              icon: Icon(_showSearch ? FIcons.x : FIcons.search, size: 20),
              onPress: _toggleSearch,
            ),
          ],
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
              final hasDeals = bundles.isNotEmpty && _searchQuery.isEmpty;
              final hasOffers = offerItems.isNotEmpty && _searchQuery.isEmpty;
              final categoryNames = [
                if (hasOffers) '${l10n.specialOffers} 🔥',
                ...filteredItems.keys.map((c) => c.name.getText(locale)),
              ];
              final topSectionsOffset = (hasDeals ? 1 : 0) + (hasOffers ? 1 : 0);

              // Sync to fields used by scroll callbacks
              _hasDealsSection = hasDeals;
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
                        ref.invalidate(activeBundlesProvider(branchId));
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
                          // Deals section at index 0
                          if (hasDeals && index == 0) {
                            return _DealsSection(
                              bundles: bundles,
                              locale: locale,
                            );
                          }
                          // Offers section right after deals
                          if (hasOffers && index == (hasDeals ? 1 : 0)) {
                            return _OffersSection(
                              items: offerItems,
                              locale: locale,
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
                  shape: const StadiumBorder(),
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
                      btnL10n.priceFormat(cart.totalPrice.toStringAsFixed(2)),
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
    final query = _searchQuery.toLowerCase();

    for (final entry in items.entries) {
      final matchingItems = entry.value
          .where((item) =>
              item.name.getText(locale).toLowerCase().contains(query) ||
              item.description.getText(locale).toLowerCase().contains(query) ||
              item.name.en.toLowerCase().contains(query) ||
              item.description.en.toLowerCase().contains(query))
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
class _CategoryMenu extends StatefulWidget {
  final List<String> categories;
  final ValueNotifier<String?> selectedCategoryNotifier;
  final Function(String) onCategoryTap;

  const _CategoryMenu({
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
}

/// Category section with header and items
class _CategorySection extends StatelessWidget {
  final String categoryName;
  final List<MenuItem> items;
  final Locale locale;

  const _CategorySection({
    required this.categoryName,
    required this.items,
    required this.locale,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.theme.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Category header
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: AppText(
            categoryName,
            style: TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: 16,
              color: colors.foreground,
            ),
          ),
        ),
        // Items
        ...items.asMap().entries.map((entry) => MenuItemTile(
          item: entry.value,
          isLast: entry.key == items.length - 1,
          locale: locale,
        )),
      ],
    );
  }
}

/// Menu item tile - list style with stepper and fast order support
class MenuItemTile extends ConsumerStatefulWidget {
  final MenuItem item;
  final bool isLast;
  final Locale locale;

  const MenuItemTile({super.key, required this.item, this.isLast = false, required this.locale});

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

    // Apply defaults first
    for (final customization in item.customizations) {
      final defaults = customization.options
          .where((o) => o.isDefault)
          .map((o) => o.id)
          .toList();
      if (defaults.isNotEmpty) {
        selectedOptions[customization.id] = defaults;
      } else if (customization.isRequired && customization.options.isNotEmpty) {
        selectedOptions[customization.id] = [customization.options.first.id];
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
              .where((optionId) =>
                  customization.options.any((o) => o.id == optionId))
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

    // Try to get active session's room name (optional)
    await ref.read(mySessionsProvider.notifier).refresh();
    Map<String, dynamic>? roomName;
    final sessionsState = ref.read(mySessionsProvider);
    if (sessionsState.hasValue) {
      final activeSession = sessionsState.value!
          .where((s) => s.status == SessionStatus.active)
          .firstOrNull;
      if (activeSession != null) {
        roomName = activeSession.roomName.toJson();
      }
    }

    try {
      await orderService.submitFastOrder(
        item: widget.item,
        userId: currentAuthState.userId ?? '',
        userName: currentAuthState.name ?? 'Guest',
        roomName: roomName,
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
    final colors = context.theme.colors;
    final l10n = AppLocalizations.of(context)!;
    final cart = ref.watch(cartProvider);
    final cartQuantity = _getCartQuantity(cart, widget.item.id);
    final favoritesState = ref.watch(favoritesProvider);
    final isFavorite = favoritesState.favoriteIds.contains(widget.item.id);
    final item = widget.item;
    final locale = widget.locale;
    final isOrderingEnabled = ref.watch(branchProvider).selectedBranch?.isOrderingEnabled ?? true;

    return GestureDetector(
      onTap: isOrderingEnabled ? () => _showCustomizationSheet(context, ref) : null,
      onLongPressStart: isOrderingEnabled ? _startFastOrder : null,
      onLongPressEnd: isOrderingEnabled ? _endFastOrder : null,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
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
                    l10n.priceFormat(item.effectivePrice.toStringAsFixed(2)),
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                      color: item.isOnOffer ? Colors.green : colors.foreground,
                    ),
                  ),
                  if (item.isOnOffer && item.offerPrice != null)
                    AppText(
                      l10n.priceFormat(item.price.toStringAsFixed(2)),
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
            _fastOrderProgress > 0
                ? Container(
                    width: 34,
                    height: 34,
                    decoration: BoxDecoration(
                      color: colors.primary,
                      shape: BoxShape.circle,
                    ),
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
                  )
                : cartQuantity > 0
                    ? _QuantityStepper(
                        quantity: cartQuantity,
                        onIncrement: () => _incrementInCart(ref, cart, item.id),
                        onDecrement: () => _decrementFromCart(ref, cart, item.id),
                      )
                    : Stack(
                        clipBehavior: Clip.none,
                        alignment: Alignment.topCenter,
                        children: [
                          GestureDetector(
                            onTap: () => _handleAddTap(context, ref),
                            child: Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: colors.primary,
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Icon(
                                item.customizations.isNotEmpty ? FIcons.chevronRight : FIcons.plus,
                                color: colors.primaryForeground,
                                size: 18,
                              ),
                            ),
                          ),
                          if (item.customizations.isNotEmpty)
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
                      ),
          ],
        ),
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

/// Deals section showing active bundle deals as full-width pages with dots
class _DealsSection extends ConsumerStatefulWidget {
  final List<BundleDeal> bundles;
  final Locale locale;

  const _DealsSection({required this.bundles, required this.locale});

  @override
  ConsumerState<_DealsSection> createState() => _DealsSectionState();
}

class _DealsSectionState extends ConsumerState<_DealsSection> {
  int _currentPage = 0;
  late final PageController _pageController;

  @override
  void initState() {
    super.initState();
    _pageController = PageController();
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.theme.colors;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 16),
        SizedBox(
          height: 300,
          child: PageView.builder(
            clipBehavior: Clip.antiAlias,
            controller: _pageController,
            onPageChanged: (index) => setState(() => _currentPage = index),
            itemCount: widget.bundles.length,
            itemBuilder: (context, index) => _BundleDealCard(
              bundle: widget.bundles[index],
              locale: widget.locale,
            ),
          ),
        ),
        if (widget.bundles.length > 1)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(widget.bundles.length, (index) {
                final isActive = index == _currentPage;
                return Container(
                  width: isActive ? 8 : 6,
                  height: isActive ? 8 : 6,
                  margin: const EdgeInsets.symmetric(horizontal: 3),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: isActive ? colors.primary : colors.mutedForeground.withValues(alpha: 0.3),
                  ),
                );
              }),
            ),
          ),
      ],
    );
  }
}

/// Offers section showing items on offer in a horizontal list
class _OffersSection extends ConsumerWidget {
  final List<MenuItem> items;
  final Locale locale;

  const _OffersSection({required this.items, required this.locale});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.theme.colors;
    final l10n = AppLocalizations.of(context)!;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: AppText(
            l10n.specialOffers,
            style: TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: 16,
              color: colors.foreground,
            ),
          ),
        ),
        SizedBox(
          height: 220,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            itemCount: items.length,
            itemBuilder: (context, index) => _OfferItemCard(
              item: items[index],
              locale: locale,
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

  const _OfferItemCard({required this.item, required this.locale});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.theme.colors;
    final l10n = AppLocalizations.of(context)!;

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
        decoration: BoxDecoration(
          color: colors.background,
          border: Border.all(color: colors.border),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Image
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
                                l10n.priceFormat(item.effectivePrice.toStringAsFixed(2)),
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 14,
                                  color: Colors.green,
                                ),
                              ),
                              AppText(
                                l10n.priceFormat(item.price.toStringAsFixed(2)),
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
                              .where((c) => c.productId == item.id && c.bundleId == null)
                              .fold(0, (sum, c) => sum + c.quantity);
                          if (cartQty > 0) {
                            return Container(
                              width: 28,
                              height: 28,
                              decoration: BoxDecoration(
                                color: colors.primary,
                                borderRadius: BorderRadius.circular(14),
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
                              borderRadius: BorderRadius.circular(16),
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

/// Card for a single bundle deal
class _BundleDealCard extends ConsumerWidget {
  final BundleDeal bundle;
  final Locale locale;

  const _BundleDealCard({required this.bundle, required this.locale});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.theme.colors;
    final l10n = AppLocalizations.of(context)!;
    final itemsList = bundle.items
        .map((i) => '${i.quantity > 1 ? '${i.quantity}x ' : ''}${i.itemName.getText(locale)}')
        .join(', ');

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8),
      child: Container(
        decoration: BoxDecoration(
          color: colors.background,
          border: Border.all(color: colors.border),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Image on top
            ClipRRect(
              borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
              child: SizedBox(
                width: double.infinity,
                height: 160,
                child: bundle.pictureUri != null
                    ? CachedNetworkImage(
                        imageUrl: bundle.pictureUri!,
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
                          child: Icon(FIcons.package, size: 32, color: colors.mutedForeground),
                        ),
                      )
                    : Container(
                        color: colors.muted,
                        child: Icon(FIcons.package, size: 32, color: colors.mutedForeground),
                      ),
              ),
            ),
            // Info
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    AppText(
                      bundle.name.getText(locale),
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 15,
                        color: colors.foreground,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (bundle.description.getText(locale).isNotEmpty) ...[
                      const SizedBox(height: 4),
                      AppText(
                        bundle.description.getText(locale),
                        style: TextStyle(
                          fontSize: 12,
                          color: colors.mutedForeground,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                    if (itemsList.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      AppText(
                        '${l10n.bundleIncludes}: $itemsList',
                        style: TextStyle(
                          fontSize: 11,
                          color: colors.mutedForeground,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                    const Spacer(),
                    // Price row + add button
                    Row(
                      children: [
                        Expanded(
                          child: Row(
                            children: [
                              AppText(
                                l10n.priceFormat(bundle.bundlePrice.toStringAsFixed(2)),
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 15,
                                  color: Colors.green,
                                ),
                              ),
                              if (bundle.originalPrice > bundle.bundlePrice) ...[
                                const SizedBox(width: 6),
                                AppText(
                                  l10n.priceFormat(bundle.originalPrice.toStringAsFixed(2)),
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: colors.mutedForeground,
                                    decoration: TextDecoration.lineThrough,
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                        Builder(builder: (context) {
                          final cartQty = ref.watch(cartProvider).items
                              .where((c) => c.bundleId == bundle.id)
                              .fold(0, (sum, c) => sum + c.quantity);
                          return GestureDetector(
                            onTap: () {
                              final cartItem = CartItem.fromBundle(bundle);
                              ref.read(cartProvider.notifier).addItem(cartItem);
                            },
                            child: Container(
                              width: 34,
                              height: 34,
                              decoration: BoxDecoration(
                                color: colors.primary,
                                borderRadius: BorderRadius.circular(17),
                              ),
                              alignment: Alignment.center,
                              child: cartQty > 0
                                  ? Text(
                                      '$cartQty',
                                      textAlign: TextAlign.center,
                                      style: TextStyle(
                                        color: colors.primaryForeground,
                                        fontSize: 14,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    )
                                  : Icon(
                                      FIcons.plus,
                                      color: colors.primaryForeground,
                                      size: 18,
                                    ),
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

  const _QuantityStepper({
    required this.quantity,
    required this.onIncrement,
    required this.onDecrement,
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
          borderRadius: BorderRadius.circular(20),
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


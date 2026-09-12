import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_text.dart';
import '../../../l10n/app_localizations.dart';
import '../../../core/providers/locale_provider.dart';
import '../models/menu_item.dart';
import '../models/user_preference.dart';
import '../services/menu_service.dart';
import '../../cart/models/cart_item.dart';
import '../../cart/services/cart_service.dart';

/// Bottom sheet for customizing menu item
class ItemCustomizationSheet extends ConsumerStatefulWidget {
  final MenuItem item;

  const ItemCustomizationSheet({super.key, required this.item});

  @override
  ConsumerState<ItemCustomizationSheet> createState() =>
      _ItemCustomizationSheetState();
}

class _ItemCustomizationSheetState
    extends ConsumerState<ItemCustomizationSheet> {
  final Map<int, List<int>> _selectedOptions = {}; // customizationId -> optionIds
  final TextEditingController _instructionsController = TextEditingController();
  int _quantity = 1;

  @override
  void initState() {
    super.initState();
    // Pre-select default options first
    _initializeWithDefaults();
    // Then load saved preferences
    _loadSavedPreferences();
  }

  void _initializeWithDefaults() {
    for (final customization in widget.item.customizations) {
      final defaults = customization.options
          .where((o) => o.isDefault && !o.isOutOfStock)
          .map((o) => o.id)
          .toList();
      if (defaults.isNotEmpty) {
        _selectedOptions[customization.id] = defaults;
      } else if (customization.isRequired) {
        final first = _firstInStockOption(customization);
        if (first != null) _selectedOptions[customization.id] = [first.id];
      }
    }
  }

  /// Sold-out options are shown but never picked on the customer's behalf.
  CustomizationOption? _firstInStockOption(ItemCustomization customization) =>
      customization.options.where((o) => !o.isOutOfStock).firstOrNull;

  Future<void> _loadSavedPreferences() async {
    final service = ref.read(menuRepositoryProvider);
    final preference = await service.getUserPreference(widget.item.id);

    if (preference != null && mounted) {
      _applyPreference(preference);
    }
  }

  void _applyPreference(UserItemPreference preference) {
    // Group saved options by customization ID
    final savedByCustomization = <int, List<int>>{};
    for (final option in preference.selectedOptions) {
      savedByCustomization
          .putIfAbsent(option.customizationId, () => [])
          .add(option.optionId);
    }

    // Apply saved preferences, validating they still exist
    for (final customization in widget.item.customizations) {
      final savedOptions = savedByCustomization[customization.id];
      if (savedOptions != null && savedOptions.isNotEmpty) {
        // Filter to only options that still exist in the catalog and are
        // not sold out right now
        final validOptions = savedOptions
            .where((optionId) => customization.options
                .any((o) => o.id == optionId && !o.isOutOfStock))
            .toList();

        if (validOptions.isNotEmpty) {
          _selectedOptions[customization.id] = validOptions;
        }
      }
    }

    // Ensure required customizations have a selection
    for (final customization in widget.item.customizations) {
      if (customization.isRequired) {
        final selected = _selectedOptions[customization.id] ?? [];
        if (selected.isEmpty) {
          final first = _firstInStockOption(customization);
          if (first != null) _selectedOptions[customization.id] = [first.id];
        }
      }
    }

    if (mounted) {
      setState(() {});
    }
  }

  @override
  void dispose() {
    _instructionsController.dispose();
    super.dispose();
  }

  void _showNoteSheet(BuildContext context, AppLocalizations l10n) {
    final colors = context.theme.colors;
    final tempController = TextEditingController(text: _instructionsController.text);

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => SafeArea(
        child: Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(context).viewInsets.bottom,
          ),
          child: Container(
            decoration: BoxDecoration(
              color: colors.background,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
            ),
            padding: const EdgeInsets.all(16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Handle
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    margin: const EdgeInsets.only(bottom: 16),
                    decoration: BoxDecoration(
                      color: colors.mutedForeground,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                AppText(
                  l10n.specialInstructions,
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                    color: colors.foreground,
                  ),
                ),
                const SizedBox(height: 12),
                Container(
                  decoration: BoxDecoration(
                    border: Border.all(color: colors.border),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: TextField(
                    controller: tempController,
                    autofocus: true,
                    minLines: 4,
                    maxLines: 6,
                    decoration: InputDecoration(
                      hintText: l10n.anySpecialRequestsOptional,
                      hintStyle: TextStyle(
                        color: colors.mutedForeground,
                      ),
                      border: InputBorder.none,
                      contentPadding: const EdgeInsets.all(12),
                    ),
                    style: TextStyle(
                      color: colors.foreground,
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: FButton(
                    onPress: () {
                      setState(() {
                        _instructionsController.text = tempController.text;
                      });
                      Navigator.pop(context);
                    },
                    child: AppText(l10n.done),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  double get _customizationsExtra {
    double extra = 0;
    for (final entry in _selectedOptions.entries) {
      final customization = widget.item.customizations
          .firstWhere((c) => c.id == entry.key);
      for (final optionId in entry.value) {
        final option = customization.options.firstWhere((o) => o.id == optionId);
        extra += option.priceAdjustment;
      }
    }
    return extra;
  }

  double get _totalPrice => (widget.item.effectivePrice + _customizationsExtra) * _quantity;

  double get _originalTotalPrice => (widget.item.price + _customizationsExtra) * _quantity;

  bool get _canAddToCart {
    for (final customization in widget.item.customizations) {
      if (customization.isRequired) {
        final selected = _selectedOptions[customization.id] ?? [];
        if (selected.isEmpty) return false;
      }
    }
    return true;
  }

  void _addToCart() {
    final selectedCustomizations = <SelectedCustomization>[];

    // Iterate customizations in displayOrder (as they come from API)
    for (final customization in widget.item.customizations) {
      final selectedOptionIds = _selectedOptions[customization.id] ?? [];
      for (final optionId in selectedOptionIds) {
        final option = customization.options.firstWhere((o) => o.id == optionId);
        selectedCustomizations.add(SelectedCustomization(
          customizationId: customization.id,
          customizationName: customization.name,
          optionId: option.id,
          optionName: option.name,
          priceAdjustment: option.priceAdjustment,
        ));
      }
    }

    final cartItem = CartItem.fromMenuItem(
      widget.item,
      customizations: selectedCustomizations,
      instructions: _instructionsController.text.isNotEmpty
          ? _instructionsController.text
          : null,
    ).copyWith(quantity: _quantity);

    ref.read(cartProvider.notifier).addItem(cartItem);
    Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.theme.colors;
    final l10n = AppLocalizations.of(context)!;
    final locale = ref.watch(localeProvider);
    return Container(
      height: MediaQuery.of(context).size.height,
      decoration: BoxDecoration(
        color: colors.background,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: SafeArea(
        bottom: false,
        child: Column(
          children: [
            // Handle
            Container(
              margin: const EdgeInsets.only(top: 12, bottom: 8),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: colors.mutedForeground,
                borderRadius: BorderRadius.circular(2),
              ),
            ),

            // Content
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.only(left: 16, right: 16, top: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Item header with close button
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: AppText(
                          widget.item.name.getText(locale),
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 24,
                            color: colors.foreground,
                          ),
                        ),
                      ),
                      GestureDetector(
                        onTap: () => Navigator.pop(context),
                        child: Icon(FIcons.x, size: 24, color: colors.mutedForeground),
                      ),
                    ],
                  ),
                  if (widget.item.description.getText(locale).isNotEmpty) ...[
                    const SizedBox(height: 8),
                    AppText(
                      widget.item.description.getText(locale),
                      style: TextStyle(color: colors.mutedForeground),
                    ),
                  ],
                  const SizedBox(height: 8),
                  AppText(
                    l10n.basePrice(widget.item.effectivePrice.toStringAsFixed(2)),
                    style: TextStyle(fontWeight: FontWeight.bold, color: colors.foreground),
                  ),
                  const SizedBox(height: 24),

                  // Customizations
                  ...widget.item.customizations.map((customization) =>
                    _buildCustomizationSection(context, customization, locale)),

                  // Special instructions
                  AppText(
                    l10n.specialInstructions,
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                      color: colors.foreground,
                    ),
                  ),
                  const SizedBox(height: 8),
                  GestureDetector(
                    onTap: () => _showNoteSheet(context, l10n),
                    child: Container(
                      width: double.infinity,
                      constraints: const BoxConstraints(minHeight: 80),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        border: Border.all(color: colors.border),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      alignment: AlignmentDirectional.topStart,
                      child: AppText(
                        _instructionsController.text.isNotEmpty
                            ? _instructionsController.text
                            : l10n.anySpecialRequestsOptional,
                        style: TextStyle(
                          color: _instructionsController.text.isNotEmpty
                              ? colors.foreground
                              : colors.mutedForeground,
                        ),
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Quantity selector
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      FButton.icon(
                        onPress: _quantity > 1
                            ? () => setState(() => _quantity--)
                            : null,
                        child: const Icon(FIcons.minus),
                      ),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 24),
                        child: AppText(
                          '$_quantity',
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                            color: colors.foreground,
                          ),
                        ),
                      ),
                      FButton.icon(
                        onPress: () => setState(() => _quantity++),
                        child: const Icon(FIcons.plus),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                ],
              ),
            ),
          ),

          // Add to cart button
          Container(
            padding: EdgeInsets.only(
              left: 16,
              right: 16,
              top: 12,
              bottom: 12 + MediaQuery.of(context).padding.bottom,
            ),
            decoration: BoxDecoration(
              color: colors.background,
              border: Border(
                top: BorderSide(color: context.theme.colors.mutedForeground.withValues(alpha: 0.2)),
              ),
            ),
            child: SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _canAddToCart ? _addToCart : null,
                style: ElevatedButton.styleFrom(
                  backgroundColor: _canAddToCart ? context.theme.colors.primary : Colors.grey,
                  foregroundColor: context.theme.colors.primaryForeground,
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                  shape: const StadiumBorder(),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    AppText(
                      l10n.addToCart,
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 15,
                      ),
                    ),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (widget.item.isOnOffer)
                          Padding(
                            padding: const EdgeInsetsDirectional.only(end: 6),
                            child: AppText(
                              l10n.priceFormat(_originalTotalPrice.toStringAsFixed(2)),
                              style: TextStyle(
                                fontSize: 13,
                                decoration: TextDecoration.lineThrough,
                                color: Colors.white70,
                              ),
                            ),
                          ),
                        AppText(
                          l10n.priceFormat(_totalPrice.toStringAsFixed(2)),
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 15,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
          ],
        ),
      ),
    );
  }

  Widget _buildCustomizationSection(BuildContext context, ItemCustomization customization, Locale locale) {
    final colors = context.theme.colors;
    final l10n = AppLocalizations.of(context)!;
    final selectedIds = _selectedOptions[customization.id] ?? [];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            AppText(
              customization.name.getText(locale),
              style: TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 16,
                color: colors.foreground,
              ),
            ),
            if (customization.isRequired) ...[
              const Spacer(),
              FBadge(
                variant: FBadgeVariant.destructive,
                child: AppText(l10n.required, style: TextStyle(fontSize: 12)),
              ),
            ],
          ],
        ),
        const SizedBox(height: 8),
        // Use radio buttons for single selection, checkboxes for multiple
        if (customization.allowMultiple)
          _buildCheckboxOptions(context, customization, selectedIds, locale, l10n)
        else
          _buildRadioOptions(context, customization, selectedIds, locale, l10n),
        const SizedBox(height: 16),
      ],
    );
  }

  Widget _buildRadioOptions(BuildContext context, ItemCustomization customization, List<int> selectedIds, Locale locale, AppLocalizations l10n) {
    final colors = context.theme.colors;
    final selectedId = selectedIds.isNotEmpty ? selectedIds.first : null;

    return Column(
      children: customization.options.map((option) {
        final isSelected = selectedId == option.id;
        final priceText = option.priceAdjustment > 0
            ? ' ${l10n.priceAdjustmentPlus(option.priceAdjustment.toStringAsFixed(2))}'
            : option.priceAdjustment < 0
                ? ' ${l10n.priceAdjustmentMinus(option.priceAdjustment.abs().toStringAsFixed(2))}'
                : '';

        return InkWell(
          onTap: option.isOutOfStock
              ? null
              : () {
                  setState(() {
                    if (isSelected && !customization.isRequired) {
                      _selectedOptions.remove(customization.id);
                    } else {
                      _selectedOptions[customization.id] = [option.id];
                    }
                  });
                },
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Row(
              children: [
                SizedBox(
                  width: 24,
                  height: 24,
                  child: Radio<int>(
                    value: option.id,
                    groupValue: selectedId,
                    onChanged: option.isOutOfStock
                        ? null
                        : (value) {
                            setState(() {
                              if (value != null) {
                                _selectedOptions[customization.id] = [value];
                              } else if (!customization.isRequired) {
                                _selectedOptions.remove(customization.id);
                              }
                            });
                          },
                    activeColor: colors.primary,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: AppText(
                    option.name.getText(locale),
                    style: TextStyle(
                      color: option.isOutOfStock ? colors.mutedForeground : colors.foreground,
                      fontWeight: isSelected ? FontWeight.w500 : FontWeight.normal,
                    ),
                  ),
                ),
                if (option.isOutOfStock)
                  AppText(
                    l10n.outOfStock,
                    style: TextStyle(color: colors.mutedForeground, fontSize: 13),
                  )
                else if (priceText.isNotEmpty)
                  AppText(
                    priceText,
                    style: TextStyle(
                      color: option.priceAdjustment > 0
                          ? colors.mutedForeground
                          : AppTheme.successColor,
                      fontSize: 13,
                    ),
                  ),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildCheckboxOptions(BuildContext context, ItemCustomization customization, List<int> selectedIds, Locale locale, AppLocalizations l10n) {
    final colors = context.theme.colors;

    return Column(
      children: customization.options.map((option) {
        final isSelected = selectedIds.contains(option.id);
        final priceText = option.priceAdjustment > 0
            ? ' ${l10n.priceAdjustmentPlus(option.priceAdjustment.toStringAsFixed(2))}'
            : option.priceAdjustment < 0
                ? ' ${l10n.priceAdjustmentMinus(option.priceAdjustment.abs().toStringAsFixed(2))}'
                : '';

        return InkWell(
          onTap: option.isOutOfStock
              ? null
              : () {
                  setState(() {
                    final current = List<int>.from(selectedIds);
                    if (isSelected) {
                      current.remove(option.id);
                    } else {
                      current.add(option.id);
                    }
                    _selectedOptions[customization.id] = current;
                  });
                },
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Row(
              children: [
                SizedBox(
                  width: 24,
                  height: 24,
                  child: Checkbox(
                    value: isSelected,
                    onChanged: option.isOutOfStock
                        ? null
                        : (value) {
                            setState(() {
                              final current = List<int>.from(selectedIds);
                              if (value == true) {
                                current.add(option.id);
                              } else {
                                current.remove(option.id);
                              }
                              _selectedOptions[customization.id] = current;
                            });
                          },
                    activeColor: colors.primary,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: AppText(
                    option.name.getText(locale),
                    style: TextStyle(
                      color: option.isOutOfStock ? colors.mutedForeground : colors.foreground,
                      fontWeight: isSelected ? FontWeight.w500 : FontWeight.normal,
                    ),
                  ),
                ),
                if (option.isOutOfStock)
                  AppText(
                    l10n.outOfStock,
                    style: TextStyle(color: colors.mutedForeground, fontSize: 13),
                  )
                else if (priceText.isNotEmpty)
                  AppText(
                    priceText,
                    style: TextStyle(
                      color: option.priceAdjustment > 0
                          ? colors.mutedForeground
                          : AppTheme.successColor,
                      fontSize: 13,
                    ),
                  ),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }
}

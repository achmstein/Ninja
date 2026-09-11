import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import '../../../core/models/localized_text.dart';
import '../../../core/models/money.dart';
import '../../../core/theme/text_styles.dart';
import '../../../core/widgets/pos_dialog.dart';
import '../../../l10n/app_localizations.dart';
import '../../catalog/models/catalog_item.dart';
import '../../catalog/services/catalog_service.dart';
import '../models/sale_line.dart';

/// Customization picker for an item pad tile: option chips (defaults
/// pre-selected), quantity, special instructions. Same selection semantics
/// as the customer app — required single-choice groups cannot be cleared,
/// optional ones toggle off, allowMultiple groups multi-select.
///
/// When a customer is attached to the sale ([customerId]), their saved
/// choices for this item overlay the defaults, so the round comes up the way
/// they usually take it. The cashier can still change anything.
Future<SaleLine?> showCustomizeDialog(BuildContext context, CatalogItem item, {String? customerId}) {
  return showPosDialog<SaleLine>(
    context,
    builder: (context) => _CustomizeForm(item: item, customerId: customerId),
  );
}

class _CustomizeForm extends ConsumerStatefulWidget {
  final CatalogItem item;
  final String? customerId;
  const _CustomizeForm({required this.item, this.customerId});

  @override
  ConsumerState<_CustomizeForm> createState() => _CustomizeFormState();
}

class _CustomizeFormState extends ConsumerState<_CustomizeForm> {
  int _quantity = 1;
  final _instructions = TextEditingController();
  late final Map<int, List<int>> _selections;
  // Once the cashier changes an option, a late-arriving preference must not
  // clobber it.
  bool _touched = false;

  CatalogItem get item => widget.item;

  @override
  void initState() {
    super.initState();
    _selections = {
      for (final c in item.customizations) c.id: c.options.where((o) => o.isDefault).map((o) => o.id).toList(),
    };
    _loadPreference();
  }

  Future<void> _loadPreference() async {
    final userId = widget.customerId;
    if (userId == null || userId.isEmpty) return;
    final saved = await ref.read(catalogRepositoryProvider).getCustomerItemPreference(userId, item.id);
    if (!mounted || _touched || saved.isEmpty) return;
    setState(() {
      for (final c in item.customizations) {
        final validOptionIds = c.options.map((o) => o.id).toSet();
        final chosen = (saved[c.id] ?? const <int>[]).where(validOptionIds.contains).toList();
        // Only overlay groups the customer actually has a saved choice for;
        // leave the item default in place otherwise.
        if (chosen.isNotEmpty) _selections[c.id] = chosen;
      }
    });
  }

  @override
  void dispose() {
    _instructions.dispose();
    super.dispose();
  }

  List<SaleCustomization> get _chosen => [
        for (final c in item.customizations)
          for (final o in c.options)
            if ((_selections[c.id] ?? const []).contains(o.id))
              SaleCustomization(
                customizationId: c.id,
                customizationNameEn: c.name.en,
                customizationNameAr: c.name.ar,
                optionId: o.id,
                optionNameEn: o.name.en,
                optionNameAr: o.name.ar,
                priceAdjustment: o.priceAdjustment,
              ),
      ];

  double get _unitPrice => item.unitPrice + _chosen.fold(0.0, (sum, c) => sum + c.priceAdjustment);

  bool get _missingRequired =>
      item.customizations.any((c) => c.isRequired && (_selections[c.id] ?? const []).isEmpty);

  void _toggle(ItemCustomization customization, int optionId) {
    _touched = true;
    final current = _selections[customization.id] ?? const [];
    setState(() {
      if (customization.allowMultiple) {
        _selections[customization.id] =
            current.contains(optionId) ? current.where((id) => id != optionId).toList() : [...current, optionId];
        return;
      }
      // Single-choice: tap again to clear only when the group is optional
      _selections[customization.id] =
          current.contains(optionId) && !customization.isRequired ? [] : [optionId];
    });
  }

  void _add() {
    final instructions = _instructions.text.trim();
    Navigator.of(context, rootNavigator: true).pop(SaleLine(
      productId: item.id,
      nameEn: item.name.en,
      nameAr: item.name.ar ?? '',
      price: _unitPrice,
      pictureUrl: item.pictureUrl,
      quantity: _quantity,
      specialInstructions: instructions.isEmpty ? null : instructions,
      customizations: _chosen,
    ));
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final description = item.description?.localized(context);
    final customizations = [...item.customizations]..sort((a, b) => a.displayOrder.compareTo(b.displayOrder));

    return ConstrainedBox(
      constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.95),
      child: DialogScroll(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(item.name.localized(context), style: theme.typography.xl.copyWith(fontWeight: FontWeight.w600)),
            if (description != null && description.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(description, style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground)),
            ],
            for (final customization in customizations) ...[
              const SizedBox(height: 16),
              Row(
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: [
                  Text(customization.name.localized(context),
                      style: theme.typography.sm.copyWith(fontWeight: FontWeight.w600)),
                  if (customization.isRequired) ...[
                    const SizedBox(width: 8),
                    Text(l10n.required, style: theme.typography.xs.copyWith(color: theme.colors.destructive)),
                  ],
                ],
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final option in [...customization.options]..sort((a, b) => a.displayOrder.compareTo(b.displayOrder)))
                    _OptionChip(
                      label: option.name.localized(context),
                      adjustment: option.priceAdjustment,
                      selected: (_selections[customization.id] ?? const []).contains(option.id),
                      onTap: () => _toggle(customization, option.id),
                    ),
                ],
              ),
            ],
            const SizedBox(height: 16),
            Row(
              children: [
                Text(l10n.quantity, style: theme.typography.sm.copyWith(fontWeight: FontWeight.w600)),
                const Spacer(),
                SizedBox.square(
                  dimension: 44,
                  child: FButton.icon(
                    onPress: () => setState(() => _quantity = _quantity > 1 ? _quantity - 1 : 1),
                    child: const Icon(FIcons.minus, size: 20),
                  ),
                ),
                SizedBox(
                  width: 40,
                  child: Text('$_quantity', textAlign: TextAlign.center,
                      style: theme.typography.lg.copyWith(fontWeight: FontWeight.w600, fontFeatures: const [FontFeature.tabularFigures()])),
                ),
                SizedBox.square(
                  dimension: 44,
                  child: FButton.icon(
                    onPress: () => setState(() => _quantity++),
                    child: const Icon(FIcons.plus, size: 20),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            FTextField(
              control: FTextFieldControl.managed(controller: _instructions),
              label: Text(l10n.specialInstructionsOptional),
              maxLines: 1,
            ),
            const SizedBox(height: 16),
            SizedBox(
              height: 56,
              child: FButton(
                onPress: !item.isAvailable || _missingRequired ? null : _add,
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                suffix: item.isAvailable
                    ? Text(money(context, _unitPrice * _quantity),
                        style: theme.typography.lg.forButton.copyWith(fontFeatures: const [FontFeature.tabularFigures()]))
                    : null,
                child: Text(item.isAvailable ? l10n.addToOrder : l10n.unavailable, style: theme.typography.lg.forButton),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _OptionChip extends StatelessWidget {
  final String label;
  final double adjustment;
  final bool selected;
  final VoidCallback onTap;

  const _OptionChip({required this.label, required this.adjustment, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    return SizedBox(
      height: 44,
      child: FButton(
        variant: selected ? null : FButtonVariant.outline,
        mainAxisSize: MainAxisSize.min,
        onPress: onTap,
        suffix: adjustment > 0
            ? Opacity(opacity: 0.7, child: Text('+${adjustment.toStringAsFixed(adjustment == adjustment.roundToDouble() ? 0 : 2)}', style: theme.typography.xs.forButton))
            : null,
        child: Text(label, style: theme.typography.base.forButton),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import 'package:shimmer/shimmer.dart';
import '../../../core/models/localized_text.dart';
import '../../../core/models/money.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/text_styles.dart';
import '../../../core/widgets/pos_toast.dart';
import '../../../l10n/app_localizations.dart';
import '../../catalog/models/catalog_item.dart';
import '../../catalog/providers/catalog_provider.dart';

/// Marking items sold out (and back) for this branch. Reads the same
/// providers as the sale pad, so a flip here greys the tile there at once.
/// The server ANDs the branch override with the global flag, so a row
/// shows the effective state: an item the back office pulled everywhere
/// stays off whatever the till says.
class AvailabilityScreen extends ConsumerStatefulWidget {
  const AvailabilityScreen({super.key});

  @override
  ConsumerState<AvailabilityScreen> createState() => _AvailabilityScreenState();
}

class _AvailabilityScreenState extends ConsumerState<AvailabilityScreen> {
  final _term = TextEditingController();
  int? _activeCategory;

  @override
  void initState() {
    super.initState();
    _term.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _term.dispose();
    super.dispose();
  }

  // Availability flips optimistically: the list updates first and rolls
  // back if the server rejects it. Always an explicit value — a server-side
  // "toggle" default could drift from what the switch shows.
  Future<void> _setAvailable(CatalogItem item, bool isAvailable) async {
    final ok = await ref.read(catalogItemsProvider.notifier).setAvailability(item.id, isAvailable);
    if (!ok && mounted) showPosToast(context, PosToastType.error, AppLocalizations.of(context)!.failedToUpdateAvailability);
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final categories = ref.watch(catalogCategoriesProvider).value ?? const <CatalogCategory>[];
    final itemsAsync = ref.watch(catalogItemsProvider);

    // A search spans every category; otherwise one category at a time, as
    // on the sale pad
    final search = _term.text.trim().toLowerCase();
    final activeCategoryId = search.isNotEmpty ? null : (_activeCategory ?? (categories.isNotEmpty ? categories.first.id : null));

    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 768),
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  SizedBox.square(
                    dimension: 48,
                    child: FButton.icon(
                      variant: FButtonVariant.ghost,
                      onPress: () => context.go('/'),
                      child: Icon(FIcons.arrowLeft, size: 24),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(l10n.availability, style: theme.typography.xl.copyWith(fontWeight: FontWeight.w700)),
                ],
              ),
              const SizedBox(height: 16),
              FTextField(
                control: FTextFieldControl.managed(controller: _term),
                hint: l10n.searchItems,
                prefixBuilder: (context, style, _) => Padding(
                  padding: const EdgeInsetsDirectional.only(start: 12),
                  child: Icon(FIcons.search, size: 20, color: theme.colors.mutedForeground),
                ),
                maxLines: 1,
              ),
              if (search.isEmpty) ...[
                const SizedBox(height: 16),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final category in categories)
                      SizedBox(
                        height: 44,
                        child: FButton(
                          variant: category.id == activeCategoryId ? null : FButtonVariant.outline,
                          mainAxisSize: MainAxisSize.min,
                          onPress: () => setState(() => _activeCategory = category.id),
                          child: Text(category.name.localized(context), style: theme.typography.base.forButton),
                        ),
                      ),
                  ],
                ),
              ],
              const SizedBox(height: 16),
              itemsAsync.when(
                loading: () => Shimmer.fromColors(
                  baseColor: theme.colors.muted,
                  highlightColor: theme.colors.background,
                  child: Container(
                    height: 192,
                    decoration: BoxDecoration(color: theme.colors.muted, borderRadius: BorderRadius.circular(14)),
                  ),
                ),
                error: (_, _) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 64),
                  child: Text(l10n.somethingWentWrong,
                      textAlign: TextAlign.center,
                      style: theme.typography.base.copyWith(color: theme.colors.mutedForeground)),
                ),
                data: (items) {
                  final visible = [
                    for (final item in items)
                      if (search.isNotEmpty
                          ? '${item.name.en} ${item.name.ar ?? ''}'.toLowerCase().contains(search)
                          : item.catalogTypeId == activeCategoryId)
                        item,
                  ]..sort((a, b) => a.displayOrder.compareTo(b.displayOrder));
                  if (visible.isEmpty) {
                    return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 64),
                      child: Text(search.isNotEmpty ? l10n.noItemsMatch : l10n.noItemsInCategory,
                          textAlign: TextAlign.center,
                          style: theme.typography.base.copyWith(color: theme.colors.mutedForeground)),
                    );
                  }
                  return Container(
                    decoration: BoxDecoration(
                      color: theme.colors.background,
                      border: Border.all(color: theme.colors.border),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: Column(
                      children: [
                        for (final (index, item) in visible.indexed) ...[
                          if (index > 0) Container(height: 1, color: theme.colors.border),
                          _ItemRow(item: item, onChange: (on) => _setAvailable(item, on)),
                        ],
                      ],
                    ),
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The whole row is the label, so a tap anywhere on it flips the switch —
/// no hunting for the control with a wet thumb
class _ItemRow extends StatelessWidget {
  final CatalogItem item;
  final ValueChanged<bool> onChange;

  const _ItemRow({required this.item, required this.onChange});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final available = item.isAvailable;
    return FTappable(
      onPress: () => onChange(!available),
      child: Container(
        constraints: const BoxConstraints(minHeight: 64),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.name.localized(context),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.typography.base.copyWith(
                      fontWeight: FontWeight.w500,
                      color: available ? null : theme.colors.mutedForeground,
                      decoration: available ? null : TextDecoration.lineThrough,
                    ),
                  ),
                  Text(money(context, item.unitPrice),
                      style: theme.typography.sm.copyWith(
                        color: theme.colors.mutedForeground,
                        fontFeatures: const [FontFeature.tabularFigures()],
                      )),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Text(
              available ? l10n.available : l10n.soldOut,
              style: theme.typography.sm.copyWith(
                fontWeight: FontWeight.w500,
                color: available ? AppColors.emerald(theme.colors.brightness) : theme.colors.destructive,
              ),
            ),
            const SizedBox(width: 12),
            FSwitch(value: available, onChange: onChange),
          ],
        ),
      ),
    );
  }
}

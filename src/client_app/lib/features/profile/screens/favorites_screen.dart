import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/providers/branch_provider.dart';
import '../../../core/ui/ui.dart';
import '../../../core/widgets/app_text.dart';
import '../../../l10n/app_localizations.dart';
import '../../menu/models/menu_item.dart';
import '../../menu/services/menu_service.dart';
import '../../menu/providers/favorites_provider.dart';
import '../../menu/widgets/menu_skeleton.dart';
import '../../menu/widgets/item.dart';

/// The favourites as the branch the app is at serves them: its prices, and
/// only what it has; asked again when the app moves to another branch
final favoriteMenuItemsProvider = FutureProvider<List<MenuItem>>((ref) async {
  final favoritesState = ref.watch(favoritesProvider);
  final favoriteIds = favoritesState.favoriteIds;
  final branchId = ref.watch(selectedBranchIdProvider);

  if (favoriteIds.isEmpty || branchId == null) {
    return [];
  }

  final service = ref.watch(menuRepositoryProvider);
  final allItems = shownItems(ref, await service.getMenuItems(branchId: branchId));

  return allItems.where((item) => favoriteIds.contains(item.id)).toList();
});

/// The customer's favourites: the menu's own item rows, opening and going
/// in as they do on the menu
class FavoritesScreen extends ConsumerWidget {
  const FavoritesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final items = ref.watch(favoriteMenuItemsProvider);
    Future<void> refresh() async {
      await ref.read(favoritesProvider.notifier).loadFavorites();
      ref.invalidate(favoriteMenuItemsProvider);
    }

    return NinjaPage(
      title: l10n.favorites,
      back: true,
      gap: 16,
      onRefresh: refresh,
      children: items.when(
        skipLoadingOnRefresh: true,
        // Shaped as the rows they will be
        loading: () => const [MenuRowsSkeleton()],
        error: (error, _) => [
          EmptyState(
            icon: LucideIcons.circleAlert,
            title: l10n.failedToLoadFavorites(error.toString()),
            action: NinjaButton(variant: NinjaButtonVariant.outline, mainAxisSize: MainAxisSize.min, onPress: refresh, child: AppText(l10n.retry)),
          ),
        ],
        data: (list) => list.isEmpty
            ? [EmptyState(icon: LucideIcons.heart, title: l10n.noFavoritesYet)]
            : [for (final item in list) ItemRow(item: item)],
      ),
    );
  }
}

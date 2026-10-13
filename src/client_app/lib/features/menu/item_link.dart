import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/providers/branch_provider.dart';
import '../../core/providers/locale_provider.dart';
import '../../core/ui/ui.dart';
import '../../l10n/app_localizations.dart';
import 'services/menu_service.dart';
import 'widgets/item_view.dart';

/// An item asked for by its link (`/item/{id}`, client_web's item.$itemId.tsx)
/// and not open yet: the link goes to the menu and leaves the item here, for
/// [ItemLink] to open once the menu is in
final pendingItem = ValueNotifier<int?>(null);

/// The item's id from its link's path; one that is not a number is no item
/// (0), which the menu then says it does not have
int itemIdFromLink(String? param) => int.tryParse(param ?? '') ?? 0;

/// Opens the item a link asked for, over the menu, once the menu has come
/// in: as if tapped there, though with no photo to grow out of it fades in.
/// One the menu does not have (gone, or never was) is said in the island,
/// the menu standing in for the web's "not on the menu" page and its way to
/// browse.
class ItemLink extends ConsumerStatefulWidget {
  /// Whether the menu is the page now: the item waits for it
  final bool onMenu;
  final Widget child;

  const ItemLink({super.key, required this.onMenu, required this.child});

  @override
  ConsumerState<ItemLink> createState() => _ItemLinkState();
}

class _ItemLinkState extends ConsumerState<ItemLink> {
  @override
  void initState() {
    super.initState();
    pendingItem.addListener(_changed);
  }

  @override
  void dispose() {
    pendingItem.removeListener(_changed);
    super.dispose();
  }

  /// Set while the router works out where a link goes, which can be in a build: looked at after it
  void _changed() {
    if (SchedulerBinding.instance.schedulerPhase != SchedulerPhase.persistentCallbacks) {
      if (mounted) setState(() {});
      return;
    }
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) setState(() {});
    });
  }

  @override
  Widget build(BuildContext context) {
    final id = pendingItem.value;
    final branchId = ref.watch(selectedBranchIdProvider);
    if (id != null && widget.onMenu && branchId != null) {
      final menu = ref.watch(groupedMenuItemsProvider((ref.watch(localeProvider), branchId)));
      // Not in yet: it waits; failed: the menu says so itself and the link lets go
      if (menu.hasValue || menu.hasError) {
        final item = menu.value?.values.expand((items) => items).where((item) => item.id == id).firstOrNull;
        // Opened a turn after the frame, not in it: arriving from another tab, the
        // frame's own tidy-up (an item open on the last page goes with it, run as
        // a microtask) would otherwise close the item the moment it opens
        WidgetsBinding.instance.addPostFrameCallback((_) {
          Future(() {
            if (!context.mounted || pendingItem.value != id) return;
            pendingItem.value = null;
            if (item != null) {
              showItemView(context, item);
            } else if (!menu.hasError) {
              showIsland(
                title: Text(AppLocalizations.of(context)!.itemNotFound),
                icon: const Icon(LucideIcons.coffee),
              );
            }
          });
        });
      }
    }
    return widget.child;
  }
}

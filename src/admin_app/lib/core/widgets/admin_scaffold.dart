import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import '../auth/auth_service.dart';
import '../../features/orders/providers/orders_provider.dart';
import '../../features/rooms/providers/rooms_provider.dart';
import '../../features/rooms/models/room.dart';
import '../../features/service_requests/providers/service_requests_provider.dart';
import '../../l10n/app_localizations.dart';
import 'app_text.dart';
import '../providers/branch_provider.dart';
import 'branch_switcher.dart';
import 'no_branch_screen.dart';

/// Notifier to track current route for triggering refreshes when navigating
class CurrentRouteNotifier extends Notifier<String> {
  @override
  String build() => '/orders';

  void setRoute(String route) {
    state = route;
  }
}

final currentRouteProvider = NotifierProvider<CurrentRouteNotifier, String>(
  CurrentRouteNotifier.new,
);

/// Navigation item model
class NavItem {
  final String route;
  final String Function(AppLocalizations l10n) labelBuilder;
  final IconData icon;

  const NavItem({
    required this.route,
    required this.labelBuilder,
    required this.icon,
  });

  String getLabel(AppLocalizations l10n) => labelBuilder(l10n);
}

/// Main navigation items (shown in bottom nav on mobile)
List<NavItem> mainNavItems = [
  NavItem(route: '/orders', labelBuilder: (l10n) => l10n.orders, icon: Icons.receipt_long_outlined),
  NavItem(route: '/rooms', labelBuilder: (l10n) => l10n.rooms, icon: FIcons.gamepad2),
  NavItem(route: '/service-requests', labelBuilder: (l10n) => l10n.requests, icon: Icons.notifications_outlined),
  NavItem(route: '/accounts', labelBuilder: (l10n) => l10n.accounts, icon: Icons.account_balance_wallet_outlined),
];

/// Secondary nav items (shown in More menu on mobile, sidebar on tablet)
List<NavItem> getSecondaryNavItems({required bool isOwner}) => [
  NavItem(route: '/menu', labelBuilder: (l10n) => l10n.menu, icon: Icons.restaurant_menu_outlined),
  NavItem(route: '/bundles', labelBuilder: (l10n) => l10n.bundleDeals, icon: Icons.local_offer_outlined),
  NavItem(route: '/loyalty', labelBuilder: (l10n) => l10n.loyalty, icon: Icons.card_giftcard_outlined),
  NavItem(route: '/customers', labelBuilder: (l10n) => l10n.customers, icon: Icons.people_outline),
  if (isOwner) NavItem(route: '/admins', labelBuilder: (l10n) => l10n.adminsManagement, icon: Icons.admin_panel_settings_outlined),
  if (isOwner) NavItem(route: '/branches', labelBuilder: (l10n) => l10n.branches, icon: Icons.store_outlined),
  if (!isOwner) NavItem(route: '/branch', labelBuilder: (l10n) => l10n.branchDetails, icon: Icons.store_outlined),
  NavItem(route: '/profile', labelBuilder: (l10n) => l10n.profile, icon: Icons.person_outline),
];

/// Admin scaffold with bottom navigation
class AdminScaffold extends ConsumerStatefulWidget {
  final Widget child;
  final String currentRoute;

  const AdminScaffold({
    super.key,
    required this.child,
    required this.currentRoute,
  });

  @override
  ConsumerState<AdminScaffold> createState() => _AdminScaffoldState();
}

class _AdminScaffoldState extends ConsumerState<AdminScaffold> {
  @override
  void initState() {
    super.initState();
    // Update route provider on initial load (delayed to avoid build-phase modification)
    Future.microtask(() {
      ref.read(currentRouteProvider.notifier).setRoute(widget.currentRoute);
    });
  }

  @override
  void didUpdateWidget(AdminScaffold oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Update route provider when route changes (delayed to avoid build-phase modification)
    if (oldWidget.currentRoute != widget.currentRoute) {
      Future.microtask(() {
        if (mounted) {
          ref.read(currentRouteProvider.notifier).setRoute(widget.currentRoute);
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return _MobileLayout(currentRoute: widget.currentRoute, child: widget.child);
  }
}

/// Mobile layout with bottom navigation
class _MobileLayout extends ConsumerWidget {
  final Widget child;
  final String currentRoute;

  const _MobileLayout({required this.child, required this.currentRoute});

  int _getSelectedIndex(List<NavItem> secondaryItems) {
    for (int i = 0; i < mainNavItems.length; i++) {
      if (currentRoute.startsWith(mainNavItems[i].route)) return i;
    }
    // Check if current route is in secondary items (More is selected)
    for (final item in secondaryItems) {
      if (currentRoute.startsWith(item.route)) return mainNavItems.length; // More index
    }
    return 0;
  }

  void _showMoreMenu(BuildContext context, WidgetRef ref, List<NavItem> secondaryItems) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;

    showModalBottomSheet(
      context: context,
      useRootNavigator: true,
      backgroundColor: theme.colors.background,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => SafeArea(
        bottom: false,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Handle
              Container(
                margin: const EdgeInsets.only(top: 12, bottom: 8),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: theme.colors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 8),
              // Nav items
              ...secondaryItems.map((item) {
                final isSelected = currentRoute.startsWith(item.route);
                return ListTile(
                  dense: true,
                  visualDensity: VisualDensity.compact,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16),
                  leading: Icon(
                    item.icon,
                    size: 20,
                    color: isSelected ? theme.colors.primary : theme.colors.foreground,
                  ),
                  title: AppText(
                    item.getLabel(l10n),
                    style: theme.typography.sm.copyWith(
                      fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                      color: isSelected ? theme.colors.primary : theme.colors.foreground,
                    ),
                  ),
                  onTap: () {
                    Navigator.pop(ctx);
                    context.go(item.route);
                  },
                );
              }),
              SizedBox(height: 8 + MediaQuery.of(ctx).viewPadding.bottom),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final isOwner = ref.watch(isOwnerProvider);
    final secondaryItems = getSecondaryNavItems(isOwner: isOwner);
    final selectedIndex = _getSelectedIndex(secondaryItems);
    final isProfileSelected = selectedIndex == mainNavItems.length;
    final ordersState = ref.watch(ordersProvider);
    final pendingOrdersCount = ordersState.orders.length;
    final roomsState = ref.watch(roomsProvider);
    final reservationsCount = roomsState.activeSessions
        .where((s) => s.status == SessionStatus.reserved)
        .length;
    final serviceRequestsState = ref.watch(serviceRequestsProvider);
    final pendingRequestsCount = serviceRequestsState.pendingRequests.length;

    return FScaffold(
      childPad: false,
      child: SafeArea(
        bottom: false,
        child: Column(
          children: [
            const BranchSwitcher(),
            // An admin assigned to no branch may operate nothing yet
            Expanded(
              child: ref.watch(branchProvider.select((s) => s.noBranch)) && !ref.watch(isOwnerProvider)
                  ? const NoBranchScreen()
                  : child,
            ),
          ],
        ),
      ),
      footer: Container(
        decoration: BoxDecoration(
          color: theme.colors.background,
          border: Border(top: BorderSide(color: theme.colors.border)),
        ),
        child: SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                for (int i = 0; i < mainNavItems.length; i++)
                  _NavBarItem(
                    icon: mainNavItems[i].icon,
                    label: mainNavItems[i].getLabel(l10n),
                    isSelected: selectedIndex == i,
                    onTap: () => context.go(mainNavItems[i].route),
                    badgeCount: mainNavItems[i].route == '/orders'
                        ? pendingOrdersCount
                        : mainNavItems[i].route == '/rooms'
                            ? reservationsCount
                            : mainNavItems[i].route == '/service-requests'
                                ? pendingRequestsCount
                                : 0,
                    badgeColor: mainNavItems[i].route == '/rooms' ? Colors.orange : null,
                  ),
                // More button
                _MoreNavItem(
                  isSelected: isProfileSelected,
                  onTap: () => _showMoreMenu(context, ref, secondaryItems),
                  label: l10n.more,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Bottom nav bar item
class _NavBarItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool isSelected;
  final VoidCallback onTap;
  final int badgeCount;
  final Color? badgeColor;

  const _NavBarItem({
    required this.icon,
    required this.label,
    required this.isSelected,
    required this.onTap,
    this.badgeCount = 0,
    this.badgeColor,
  });

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final color = isSelected ? theme.colors.primary : theme.colors.mutedForeground;

    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                Icon(icon, size: 22, color: color),
                if (badgeCount > 0)
                  PositionedDirectional(
                    end: -8,
                    top: -4,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                      decoration: BoxDecoration(
                        color: badgeColor ?? theme.colors.destructive,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      constraints: const BoxConstraints(minWidth: 16),
                      child: AppText(
                        badgeCount > 99 ? '99+' : '$badgeCount',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 2),
            AppText(
              label,
              style: theme.typography.xs.copyWith(
                color: color,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// More nav item with menu icon
class _MoreNavItem extends StatelessWidget {
  final bool isSelected;
  final VoidCallback onTap;
  final String label;

  const _MoreNavItem({
    required this.isSelected,
    required this.onTap,
    required this.label,
  });

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final color = isSelected ? theme.colors.primary : theme.colors.mutedForeground;

    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.more_horiz, size: 22, color: color),
            const SizedBox(height: 2),
            AppText(
              label,
              style: theme.typography.xs.copyWith(
                color: color,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

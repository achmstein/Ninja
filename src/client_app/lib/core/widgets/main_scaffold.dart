import 'dart:io' show Platform;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../l10n/app_localizations.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import 'app_text.dart';
import 'branch_switcher.dart';
import 'destination_chip.dart';
import '../providers/current_place_provider.dart';
import '../../features/places/models/place.dart';
import '../../features/places/services/place_service.dart';


/// Tracks the current route for tab-aware refreshing
class CurrentRouteNotifier extends Notifier<String> {
  @override
  String build() => '/menu';

  void setRoute(String route) {
    state = route;
  }
}

final currentRouteProvider = NotifierProvider<CurrentRouteNotifier, String>(
  CurrentRouteNotifier.new,
);

/// Main scaffold with bottom navigation using Forui
class MainScaffold extends ConsumerStatefulWidget {
  final Widget child;

  const MainScaffold({super.key, required this.child});

  @override
  ConsumerState<MainScaffold> createState() => _MainScaffoldState();
}

class _MainScaffoldState extends ConsumerState<MainScaffold> {
  @override
  void initState() {
    super.initState();

    // Moving into a room means the customer left their table, so forget it.
    // Driven by the session appearing rather than by the join button, so it
    // also covers a session a cashier starts for a walk-in.
    ref.listenManual(myStaysProvider, (_, next) {
      final inRoom = next.whenOrNull(
            data: (sessions) =>
                sessions.any((s) => s.status == StayStatus.active),
          ) ??
          false;
      if (inRoom && ref.read(currentPlaceProvider) != null) {
        ref.read(currentPlaceProvider.notifier).clear();
      }
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final location = GoRouterState.of(context).matchedLocation;
    Future.microtask(() {
      if (mounted) {
        ref.read(currentRouteProvider.notifier).setRoute(location);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final currentIndex = _calculateSelectedIndex(context);
    final l10n = AppLocalizations.of(context)!;

    return FScaffold(
      footer: Padding(
        // FBottomNavigationBar already adds 2/3 of bottom view padding internally.
        // On Android, add the remaining 1/3 so the system nav bar doesn't overlap.
        // On iOS, the home indicator area is handled by FBottomNavigationBar itself.
        padding: EdgeInsets.only(
          bottom: Platform.isAndroid
              ? MediaQuery.viewPaddingOf(context).bottom / 3
              : 0,
        ),
        child: FBottomNavigationBar(
        index: currentIndex,
        onChange: (index) => _onItemTapped(index, context),
        children: [
          FBottomNavigationBarItem(
            icon: const Icon(FIcons.utensils),
            label: AppText(
              l10n.menu,
              style: TextStyle(
                fontWeight: currentIndex == 0 ? FontWeight.bold : FontWeight.normal,
              ),
            ),
          ),
          FBottomNavigationBarItem(
            icon: const Icon(FIcons.gamepad2),
            label: AppText(
              placesTabLabel(l10n, ref.watch(myStaysProvider).value ?? const []),
              style: TextStyle(
                fontWeight: currentIndex == 1 ? FontWeight.bold : FontWeight.normal,
              ),
            ),
          ),
          FBottomNavigationBarItem(
            icon: const Icon(FIcons.receipt),
            label: AppText(
              l10n.orders,
              style: TextStyle(
                fontWeight: currentIndex == 2 ? FontWeight.bold : FontWeight.normal,
              ),
            ),
          ),
          FBottomNavigationBarItem(
            icon: const Icon(FIcons.user),
            label: AppText(
              l10n.profile,
              style: TextStyle(
                fontWeight: currentIndex == 3 ? FontWeight.bold : FontWeight.normal,
              ),
            ),
          ),
        ],
      ),
      ),
      child: SafeArea(
        bottom: false,
        child: Column(
          children: [
            // Branch at the start, where the order is going at the end. Both
            // hide themselves when they have nothing to say, so the row
            // collapses to nothing on a single-branch setup with no table.
            const Row(
              children: [
                Expanded(child: BranchSwitcher()),
                DestinationChip(),
              ],
            ),
            Expanded(child: widget.child),
          ],
        ),
      ),
    );
  }

  int _calculateSelectedIndex(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    if (location.startsWith('/menu')) return 0;
    if (location.startsWith('/places')) return 1;
    if (location.startsWith('/orders')) return 2;
    if (location.startsWith('/profile')) return 3;
    return 0;
  }

  void _onItemTapped(int index, BuildContext context) {
    switch (index) {
      case 0:
        context.go('/menu');
        break;
      case 1:
        context.go('/places');
        break;
      case 2:
        context.go('/orders');
        break;
      case 3:
        context.go('/profile');
        break;
    }
  }
}

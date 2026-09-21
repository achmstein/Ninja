import 'dart:io' show Platform;
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../l10n/app_localizations.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import 'app_text.dart';
import 'branch_switcher.dart';
import 'destination_chip.dart';
import '../brand/brand_provider.dart';
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

/// One bottom tab: where it goes, how it looks
typedef _Tab = ({String route, IconData icon, String label});

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
    final l10n = AppLocalizations.of(context)!;
    // The rooms tab exists only for a tenant with rooms
    final rooms = ref.watch(featuresProvider).spaces;
    final tabs = <_Tab>[
      (route: '/menu', icon: FIcons.utensils, label: l10n.menu),
      if (rooms)
        (
          route: '/places',
          icon: FIcons.gamepad2,
          label: placesTabLabel(l10n, ref.watch(myStaysProvider).value ?? const []),
        ),
      (route: '/bills', icon: FIcons.receipt, label: l10n.bills),
      (route: '/profile', icon: FIcons.user, label: l10n.profile),
    ];
    final location = GoRouterState.of(context).matchedLocation;
    final currentIndex = math.max(0, tabs.indexWhere((t) => location.startsWith(t.route)));

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
          onChange: (index) => context.go(tabs[index].route),
          children: [
            for (final (index, tab) in tabs.indexed)
              FBottomNavigationBarItem(
                icon: Icon(tab.icon),
                label: AppText(
                  tab.label,
                  style: TextStyle(
                    fontWeight: currentIndex == index ? FontWeight.bold : FontWeight.normal,
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
}

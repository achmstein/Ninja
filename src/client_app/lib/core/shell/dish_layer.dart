import 'package:flutter/widgets.dart';

/// Where a dish opens in the app's frame (client_web's TuneLayer, inside the
/// menu): over the page, its top bar and the categories, under the dock, so
/// the tray stays in sight and in reach while a dish is open and a dish
/// added lands on it. The frame puts this round all of itself; a page pushed
/// over the frame (out of it) opens its dishes over everything instead.
class DishLayer extends InheritedWidget {
  final GlobalKey<NavigatorState> navigator;

  const DishLayer({super.key, required this.navigator, required super.child});

  /// The navigator a dish opened from [context] goes on, or null out of the frame
  static NavigatorState? maybeOf(BuildContext context) => context.getInheritedWidgetOfExactType<DishLayer>()?.navigator.currentState;

  /// Every dish shut at once, without its way back: the page under it changed
  static void closeAll(BuildContext context) {
    final navigator = maybeOf(context);
    if (navigator != null && navigator.canPop()) navigator.popUntil((route) => route.isFirst);
  }

  @override
  bool updateShouldNotify(DishLayer old) => navigator != old.navigator;
}

/// A dish is open on the frame's layer, over the page: the menu's
/// first-visit cues wait while one is (client_web's `tuning`)
final dishOpen = ValueNotifier<bool>(false);

/// The dishes' own navigator, a layer of the frame: with no dish open it
/// holds nothing and every touch goes through it to the page; a dish open
/// is a route on it. The phone's back closes the dish before anything else.
class DishNavigator extends StatelessWidget {
  final GlobalKey<NavigatorState> navigatorKey;

  const DishNavigator({super.key, required this.navigatorKey});

  @override
  Widget build(BuildContext context) => NavigatorPopHandler<Object?>(
    onPopWithResult: (_) => navigatorKey.currentState?.maybePop(),
    // Its own heroes or none: the app's navigator keeps its controller
    child: HeroControllerScope.none(
      child: Navigator(
        key: navigatorKey,
        observers: [_DishWatch()],
        onGenerateInitialRoutes: (_, _) => [_Nothing()],
      ),
    ),
  );
}

/// Keeps [dishOpen] to whether anything stands on the layer over its nothing
class _DishWatch extends NavigatorObserver {
  // Told after the frame, so those listening do not rebuild while the navigator is mid-change
  void _tell() => WidgetsBinding.instance.addPostFrameCallback((_) => dishOpen.value = navigator?.canPop() ?? false);

  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) => _tell();

  @override
  void didPop(Route<dynamic> route, Route<dynamic>? previousRoute) => _tell();

  @override
  void didRemove(Route<dynamic> route, Route<dynamic>? previousRoute) => _tell();

  @override
  void didReplace({Route<dynamic>? newRoute, Route<dynamic>? oldRoute}) => _tell();
}

/// The layer with no dish open: nothing drawn and nothing in the way (not a
/// modal route, which would stop the touches meant for the page under it)
class _Nothing extends OverlayRoute<void> {
  @override
  Iterable<OverlayEntry> createOverlayEntries() => [OverlayEntry(builder: (_) => const SizedBox.shrink())];
}

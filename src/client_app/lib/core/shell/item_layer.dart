import 'package:flutter/widgets.dart';

/// Where an item opens in the app's frame (client_web's TuneLayer, inside the
/// menu): over the page, its top bar and the categories, under the dock, so
/// the tray stays in sight and in reach while an item is open and an item
/// added lands on it. The frame puts this round all of itself; a page pushed
/// over the frame (out of it) opens its items over everything instead.
class ItemLayer extends InheritedWidget {
  final GlobalKey<NavigatorState> navigator;

  const ItemLayer({super.key, required this.navigator, required super.child});

  /// The navigator an item opened from [context] goes on, or null out of the frame
  static NavigatorState? maybeOf(BuildContext context) => context.getInheritedWidgetOfExactType<ItemLayer>()?.navigator.currentState;

  /// Every item shut at once, without its way back: the page under it changed
  static void closeAll(BuildContext context) {
    final navigator = maybeOf(context);
    if (navigator != null && navigator.canPop()) navigator.popUntil((route) => route.isFirst);
  }

  @override
  bool updateShouldNotify(ItemLayer old) => navigator != old.navigator;
}

/// An item is open on the frame's layer, over the page: the menu's
/// first-visit cues wait while one is (client_web's `tuning`)
final itemOpen = ValueNotifier<bool>(false);

/// The items' own navigator, a layer of the frame: with no item open it
/// holds nothing and every touch goes through it to the page; an item open
/// is a route on it. The phone's back closes the item before anything else.
class ItemNavigator extends StatelessWidget {
  final GlobalKey<NavigatorState> navigatorKey;

  const ItemNavigator({super.key, required this.navigatorKey});

  @override
  Widget build(BuildContext context) => NavigatorPopHandler<Object?>(
    onPopWithResult: (_) => navigatorKey.currentState?.maybePop(),
    // Its own heroes or none: the app's navigator keeps its controller
    child: HeroControllerScope.none(
      child: Navigator(
        key: navigatorKey,
        observers: [_ItemWatch()],
        onGenerateInitialRoutes: (_, _) => [_Nothing()],
      ),
    ),
  );
}

/// Keeps [itemOpen] to whether anything stands on the layer over its nothing
class _ItemWatch extends NavigatorObserver {
  // Told after the frame, so those listening do not rebuild while the navigator is mid-change
  void _tell() => WidgetsBinding.instance.addPostFrameCallback((_) => itemOpen.value = navigator?.canPop() ?? false);

  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) => _tell();

  @override
  void didPop(Route<dynamic> route, Route<dynamic>? previousRoute) => _tell();

  @override
  void didRemove(Route<dynamic> route, Route<dynamic>? previousRoute) => _tell();

  @override
  void didReplace({Route<dynamic>? newRoute, Route<dynamic>? oldRoute}) => _tell();
}

/// The layer with no item open: nothing drawn and nothing in the way (not a
/// modal route, which would stop the touches meant for the page under it)
class _Nothing extends OverlayRoute<void> {
  @override
  Iterable<OverlayEntry> createOverlayEntries() => [OverlayEntry(builder: (_) => const SizedBox.shrink())];
}

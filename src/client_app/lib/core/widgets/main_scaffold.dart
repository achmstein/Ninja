import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../l10n/app_localizations.dart';
import '../brand/brand_provider.dart';
import '../models/localized_text.dart';
import '../motion/motion.dart';
import '../providers/branch_provider.dart';
import '../providers/branch_switch.dart';
import 'nearest_branch_primer.dart';
import '../providers/current_place_provider.dart';
import '../shell/dish_layer.dart';
import '../shell/dock_bill.dart';
import '../shell/live_visit.dart';
import '../shell/top_bar.dart';
import '../shell/tuck.dart';
import '../theme/theme_provider.dart';
import '../ui/ui.dart';
import '../../features/cart/services/cart_service.dart';
import '../../features/cart/services/order_move.dart';
import '../../features/delivery/services/delivery_service.dart';
import '../../features/cart/widgets/tray.dart';
import '../../features/cart/widgets/tray_flights.dart';
import '../../features/cart/widgets/tray_model.dart';
import '../../features/menu/dish_link.dart';
import '../../features/orders/services/order_service.dart';
import '../../features/places/models/place.dart';
import '../../features/places/services/place_service.dart';
import '../../features/profile/providers/loyalty_provider.dart';

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

/// One of the app's tabs: where it goes, how it looks, and the place held
/// that the visit tab counts down for
typedef _Tab = ({String route, IconData icon, String label, Reservation? hold});

/// The app's frame in the Ninja style (client_web's routes/__root.tsx and
/// components/ninja/shell): the top bar over the page, and the dock
/// floating off the bottom edge, one dark slab holding the tabs and, above
/// them, the row of what can be acted on now: on the menu the order (the
/// tray, which opens into it), else the order on its way, the table or room
/// or the bill running. Scrolling down tucks the tabs away and sends the
/// top bar up. A dish opens between the two ([DishLayer]): over the page and
/// its bar, under the dock.
class MainScaffold extends ConsumerStatefulWidget {
  final Widget child;

  const MainScaffold({super.key, required this.child});

  @override
  ConsumerState<MainScaffold> createState() => _MainScaffoldState();
}

class _MainScaffoldState extends ConsumerState<MainScaffold> with TickerProviderStateMixin {
  late final TrayMotion _tray = TrayMotion(this);
  bool _wasExpanded = false;
  bool _primerScheduled = false;

  /// The dishes' layer, and the page it was opened on
  final _dishes = GlobalKey<NavigatorState>(debugLabel: 'dishes');
  String? _location;

  @override
  void initState() {
    super.initState();

    // Moving into a room means the customer left their table, so forget it.
    // Driven by the session appearing rather than by the join button, so it
    // also covers a session a cashier starts for a walk-in.
    ref.listenManual(myStaysProvider, (_, next) {
      final inRoom = next.whenOrNull(
            data: (sessions) => sessions.any((s) => s.status == StayStatus.active),
          ) ??
          false;
      if (inRoom && ref.read(currentPlaceProvider) != null) {
        ref.read(currentPlaceProvider.notifier).clear();
      }
    });

    // The address decides the branch: a delivery's order moves to the one that serves it
    // After the frame: switching the branch from inside the delivery state's own update would rebuild it
    // twice in one frame. Still wanted then, and not the branch already, it moves.
    ref.listenManual(deliveryStateProvider.select((d) => d.moveTo), (_, next) {
      if (next == null) return;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted || ref.read(deliveryStateProvider).moveTo != next) return;
        ref.read(branchProvider.notifier).selectBranch(next);
      });
    }, fireImmediately: true);

    // Why the app would like the customer's position, before the phone asks: once the branches are in
    // and the menu has settled, where there is more than one to choose between
    ref.listenManual(branchProvider.select((s) => s.branches.length), (_, count) {
      if (count < 2 || _primerScheduled) return;
      _primerScheduled = true;
      Future<void>.delayed(const Duration(milliseconds: 1200), () {
        if (mounted) maybeAskNearestBranch(context, ref);
      });
    }, fireImmediately: true);

    // The order moved to another branch and something in it changed: said on the island
    ref.listenManual(orderMoveProvider, (_, next) {
      if (next != null && mounted) sayOrderMoved(context, ref.read(branchProvider).branches, next);
    });

    trayFlights.addListener(_onFlights);

    // The order opened: what it will be checked against is fresh (points earned since, no stale error)
    _tray.addListener(() {
      if (_tray.expanded == _wasExpanded) return;
      _wasExpanded = _tray.expanded;
      ref.read(orderOpenProvider.notifier).set(_tray.expanded);
      if (!_tray.expanded) return;
      ref.read(checkoutProvider.notifier).reset();
      if (ref.read(featuresProvider).loyalty) ref.read(loyaltyProvider.notifier).loadLoyaltyInfo();
    });
  }

  void _onFlights() => setState(() {});

  @override
  void dispose() {
    trayFlights.removeListener(_onFlights);
    _tray.dispose();
    super.dispose();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final location = GoRouterState.of(context).matchedLocation;
    final moved = _location != null && _location != location;
    _location = location;
    Future.microtask(() {
      if (mounted) {
        ref.read(currentRouteProvider.notifier).setRoute(location);
        // Another page: it starts with its bar, and a dish open on the last one goes with it
        if (moved) {
          ref.read(topBarHiddenProvider.notifier).set(false);
          final dishes = _dishes.currentState;
          if (dishes != null && dishes.canPop()) dishes.popUntil((route) => route.isFirst);
        }
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final media = MediaQuery.of(context);
    final metrics = DockMetrics.of(media.size.height);
    final reduced = reduceMotion(context);
    trayKeepsOrder(ref, _tray);

    // The places tab exists only for a tenant with something to book or a clock to watch
    final features = ref.watch(featuresProvider);
    final rooms = features.reservations || features.timeBilling;
    // A business with rooms books rooms; a restaurant books tables — same tab, its own icon
    final branchId = ref.watch(selectedBranchIdProvider);
    final hasRooms = branchId != null && (ref.watch(placesProvider(branchId)).value?.any((p) => p.kind == PlaceKind.room) ?? true);
    // A place held while the customer walks over: the visit tab is named after it and counts its time down
    final hold = openReservationOf(ref.watch(myReservationsProvider).value ?? const []);
    final holdName = hold?.placeName.localized(context) ?? '';
    final tabs = <_Tab>[
      (route: '/menu', icon: LucideIcons.coffee, label: l10n.menu, hold: null),
      if (hold != null)
        (route: '/places', icon: hold.placeKind.icon, label: holdName.isEmpty ? l10n.reserved : holdName, hold: hold)
      else if (rooms)
        (
          route: '/places',
          icon: hasRooms ? LucideIcons.gamepad2 : LucideIcons.calendarClock,
          label: placesTabLabel(l10n, ref.watch(myStaysProvider).value ?? const []),
          hold: null,
        ),
      (route: '/profile', icon: LucideIcons.user, label: l10n.youTab, hold: null),
    ];
    final location = GoRouterState.of(context).matchedLocation;
    final active = math.max(0, tabs.indexWhere((t) => location.startsWith(t.route)));
    final onMenu = location.startsWith('/menu');

    // The dock's row: the order on the menu, else what is running
    final cartEmpty = ref.watch(cartProvider.select((c) => c.isEmpty));
    // A first dish on its way into an empty tray brings the row up under it
    final trayRow = onMenu && (!cartEmpty || trayFlights.inFlight);
    final billRow = !trayRow && ref.watch(dockRowShownProvider);
    final hasRow = trayRow || billRow;
    // Off the menu (or emptied) the order has nowhere to stand open
    if (!trayRow && _tray.expanded) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && _tray.expanded) _tray.setExpanded(false, reduced: true);
      });
    }

    final tucked = ref.watch(dockTuckProvider) && !_tray.expanded;
    // With no row to keep, tucking the tabs is the whole dock going; with one, the row settles onto the bottom edge
    final gone = tucked && !hasRow;
    final stuck = tucked && hasRow;
    final safeBottom = media.viewPadding.bottom;
    // Off the bottom edge by the dock's own inset, clear of the phone's: Android's gesture bar is its inset,
    // so the dock stands the inset above it there (a browser's own bottom bar gives the web that room);
    // iPhone's home indicator sits low in its inset, and the dock rests on the inset as on the web
    final floating = Theme.of(context).platform == TargetPlatform.android ? safeBottom + DockMetrics.inset : math.max(DockMetrics.inset, safeBottom);
    final dockBottom = stuck ? 0.0 : floating;
    final tabsHeight = stuck ? 0.0 : metrics.tabs;
    final rowHeight = hasRow ? metrics.row : 0.0;
    // How much of the page's bottom the dock covers now: the whole of it, its row alone on the bottom
    // edge while the tabs are tucked away, or nothing but the phone's own inset once it has gone
    final dockHeight = gone
        ? safeBottom
        : stuck
            ? rowHeight + safeBottom
            : rowHeight + metrics.tabs + floating;
    final c = context.theme.colors;

    final dock = AnimatedContainer(
      duration: tuckSettle,
      curve: Curves.easeOut,
      margin: EdgeInsets.symmetric(horizontal: stuck ? 0 : DockMetrics.inset),
      padding: EdgeInsets.only(bottom: stuck ? safeBottom : 0),
      decoration: BoxDecoration(
        color: c.slab,
        borderRadius: stuck ? const BorderRadius.vertical(top: Radius.circular(Ninja.cardRadius)) : BorderRadius.circular(Ninja.cardRadius),
        boxShadow: Ninja.slabShadow,
      ),
      child: SlabInk(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AnimatedSize(
              duration: tuckSettle,
              curve: Curves.easeOut,
              child: trayRow
                  ? Stack(
                      children: [
                        TrayRow(motion: _tray, height: metrics.row),
                        _Handle(motion: _tray),
                      ],
                    )
                  : billRow
                      ? Stack(children: [DockBill(height: metrics.row), const _Handle()])
                      : const SizedBox(width: double.infinity),
            ),
            AnimatedContainer(
              duration: tuckSettle,
              curve: Curves.easeOut,
              height: tabsHeight,
              decoration: BoxDecoration(
                border: hasRow ? Border(top: BorderSide(color: c.slabInk.withValues(alpha: 0.10))) : null,
              ),
              child: ClipRect(
                child: OverflowBox(
                  alignment: Alignment.topCenter,
                  minHeight: metrics.tabs,
                  maxHeight: metrics.tabs,
                  child: _DockTabs(
                    tabs: tabs,
                    active: active,
                    height: metrics.tabs,
                    pillHeight: metrics.pill,
                    onTap: (i) => context.go(tabs[i].route),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );

    // The order sheet: rising out of the dock, clipped at the row's top so it seems to come from inside it
    final sheetClipHeight = math.min(media.size.height * 0.68, 544.0);
    final sheetBottom = dockBottom + tabsHeight + metrics.row - DockMetrics.tuck;

    return Scaffold(
      resizeToAvoidBottomInset: false,
      // Filling the screen whatever is in it: the layers that are shut stand in as nothing
      body: DishLayer(
        navigator: _dishes,
        child: DishLink(
          onMenu: onMenu,
          child: Stack(
            fit: StackFit.expand,
            children: [
              // The page, with room at its end for the dock over it, and its bar going up as it scrolls down
              Positioned.fill(
                child: TuckOnScroll(
                  enabled: !_tray.expanded,
                  child: TopBarOnScroll(
                    enabled: !_tray.expanded,
                    child: SafeArea(
                      bottom: false,
                      child: Column(
                        children: [
                          const TopBarSlot(),
                          Expanded(
                            child: MediaQuery(
                              data: media.copyWith(padding: media.padding.copyWith(top: 0, bottom: dockHeight)),
                              child: Center(
                                child: ConstrainedBox(
                                  constraints: const BoxConstraints(maxWidth: Ninja.maxWidth),
                                  child: widget.child,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),

              // A dish open: over the page and its bar, clear of the dock, which stays over it with the tray in reach
              Positioned.fill(
                child: MediaQuery(
                  data: media.copyWith(padding: media.padding.copyWith(bottom: dockHeight)),
                  child: DishNavigator(navigatorKey: _dishes),
                ),
              ),

              // The page dimmed behind the open order; a tap on it closes the order
              if (trayRow)
                AnimatedBuilder(
                  animation: _tray,
                  builder: (context, _) {
                    final open = _tray.value;
                    if (open <= 0.001) return const SizedBox.shrink();
                    return Positioned.fill(
                      child: GestureDetector(
                        onTap: () => _tray.setExpanded(false, reduced: reduced),
                        child: ColoredBox(color: Ninja.trayScrim.withValues(alpha: Ninja.trayScrim.a * open)),
                      ),
                    );
                  },
                ),

              if (trayRow)
                AnimatedBuilder(
                  animation: _tray,
                  builder: (context, sheet) {
                    if (!_tray.sheetShown) return const SizedBox.shrink();
                    final h = _tray.sheetHeight > 0 ? _tray.sheetHeight : sheetClipHeight;
                    return Positioned(
                      left: DockMetrics.inset,
                      right: DockMetrics.inset,
                      bottom: sheetBottom,
                      height: sheetClipHeight,
                      child: Center(
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: Ninja.maxWidth - 2 * DockMetrics.inset),
                          child: ClipRRect(
                            borderRadius: const BorderRadius.vertical(top: Radius.circular(Ninja.sheetRadius)),
                            child: Align(
                              alignment: Alignment.bottomCenter,
                              child: Transform.translate(offset: Offset(0, (1 - _tray.value) * h), child: sheet),
                            ),
                          ),
                        ),
                      ),
                    );
                  },
                  child: _MeasureHeight(
                    onHeight: (h) => _tray.sheetHeight = h,
                    child: Container(
                      decoration: BoxDecoration(
                        color: c.slab,
                        borderRadius: const BorderRadius.vertical(top: Radius.circular(Ninja.sheetRadius)),
                      ),
                      padding: const EdgeInsets.only(bottom: DockMetrics.tuck),
                      child: SlabInk(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            // The open order's top edge: pulled down or tapped, it closes
                            GestureDetector(
                              behavior: HitTestBehavior.opaque,
                              onTap: () => _tray.setExpanded(false, reduced: reduced),
                              onVerticalDragStart: (_) => _tray.dragStart(),
                              onVerticalDragUpdate: (d) => _tray.dragUpdate(d.delta.dy),
                              onVerticalDragEnd: (d) => _tray.dragEnd(d.primaryVelocity ?? 0, reduced: reduced),
                              child: SizedBox(
                                height: 32,
                                child: Center(
                                  child: Container(
                                    width: 36,
                                    height: 4,
                                    decoration: BoxDecoration(color: c.slabInk.withValues(alpha: 0.3), borderRadius: BorderRadius.circular(2)),
                                  ),
                                ),
                              ),
                            ),
                            const Flexible(child: TraySheet()),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),

              // The dock
              AnimatedPositioned(
                duration: tuckSettle,
                curve: Curves.easeOut,
                left: 0,
                right: 0,
                bottom: gone ? -(rowHeight + metrics.tabs + DockMetrics.inset + floating) : dockBottom,
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: Ninja.maxWidth),
                    child: IgnorePointer(ignoring: gone, child: dock),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The dock's grab handle on its row: every row of the dock has it. On the
/// tray's it fades as the order rises, whose own edge then carries one.
class _Handle extends StatelessWidget {
  final TrayMotion? motion;

  const _Handle({this.motion});

  @override
  Widget build(BuildContext context) {
    final bar = Container(
      width: 36,
      height: 4,
      decoration: BoxDecoration(color: context.theme.colors.foreground.withValues(alpha: 0.3), borderRadius: BorderRadius.circular(2)),
    );
    return Positioned(
      top: 6,
      left: 0,
      right: 0,
      child: IgnorePointer(
        child: Center(
          child: motion == null
              ? bar
              : AnimatedBuilder(
                  animation: motion!,
                  builder: (context, child) => Opacity(opacity: (1 - motion!.value * 4).clamp(0.0, 1.0), child: child),
                  child: bar,
                ),
        ),
      ),
    );
  }
}

/// The app's tabs as the Ninja style draws them: a row inside the dark dock,
/// the active tab lifted by the liquid pill, its icon lifting a touch as the
/// pill slides under it
class _DockTabs extends StatelessWidget {
  final List<_Tab> tabs;
  final int active;
  final double height;
  final double pillHeight;
  final ValueChanged<int> onTap;

  const _DockTabs({required this.tabs, required this.active, required this.height, required this.pillHeight, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final c = theme.colors;
    return SizedBox(
      height: height,
      child: LiquidSlots(
        count: tabs.length,
        active: active,
        inset: 6,
        pillHeight: pillHeight,
        // color-mix(background 16%, foreground) in the slab: the ink a little over the slab
        pill: ShapeDecoration(color: Color.lerp(c.background, c.foreground, 0.16), shape: const StadiumBorder()),
        builder: (context, i, on) {
          final tab = tabs[i];
          final ink = on ? c.foreground : c.foreground.withValues(alpha: 0.55);
          final hold = tab.hold;
          return Semantics(
            selected: on,
            button: true,
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => onTap(i),
              child: hold != null
                  // A place held: its time running down round its icon
                  ? LiveVisit(icon: tab.icon, label: tab.label, made: hold.createdAt, until: hold.expiresAt, ink: ink)
                  : Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      AnimatedSlide(
                        offset: Offset(0, on ? -1 / 18 : 0),
                        duration: Motion.base,
                        curve: Motion.enter,
                        child: AnimatedScale(
                          scale: on ? 1.12 : 1,
                          duration: Motion.base,
                          curve: Motion.enter,
                          child: Icon(tab.icon, size: 18, color: ink),
                        ),
                      ),
                      const SizedBox(width: 6),
                      Flexible(
                        child: AnimatedDefaultTextStyle(
                          duration: const Duration(milliseconds: 200),
                          style: context.localeText(theme.typography.caption.copyWith(fontWeight: FontWeight.w600, color: ink)),
                          child: Text(tab.label, maxLines: 1, overflow: TextOverflow.ellipsis),
                        ),
                      ),
                    ],
                  ),
            ),
          );
        },
      ),
    );
  }
}

/// Reports its child's height after each layout: the order sheet grows and
/// shrinks while it is open, and the tray follows it
class _MeasureHeight extends SingleChildRenderObjectWidget {
  final ValueChanged<double> onHeight;

  const _MeasureHeight({required this.onHeight, required super.child});

  @override
  RenderObject createRenderObject(BuildContext context) => _RenderMeasureHeight(onHeight);

  @override
  void updateRenderObject(BuildContext context, _RenderMeasureHeight renderObject) => renderObject.onHeight = onHeight;
}

class _RenderMeasureHeight extends RenderProxyBox {
  ValueChanged<double> onHeight;

  _RenderMeasureHeight(this.onHeight);

  @override
  void performLayout() {
    super.performLayout();
    onHeight(size.height);
  }
}

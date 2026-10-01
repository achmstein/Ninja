import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:scrollable_positioned_list/scrollable_positioned_list.dart';
import '../../../core/brand/brand_style.dart';
import '../../../core/brand/styles.dart';
import '../../../core/motion/motion.dart';
import '../../../core/providers/branch_provider.dart';
import '../../../core/providers/locale_provider.dart';
import '../../../core/shell/deck_compact.dart';
import '../../../core/shell/tuck.dart';
import '../../../core/ui/gesture_hint.dart';
import '../../../core/ui/ui.dart';
import '../../../core/widgets/notice_card.dart';
import '../../../l10n/app_localizations.dart';
import '../../cart/widgets/tray_model.dart' show DockMetrics;
import '../models/menu_item.dart';
import '../paired_items.dart';
import '../services/menu_service.dart';
import '../widgets/deck.dart';
import '../widgets/dish.dart';
import '../widgets/pinch.dart';
import '../widgets/zoom_flight.dart';

/// One of the menu's sections: a category and its dishes
typedef MenuSection = ({String label, List<MenuItem> items});

/// The menu's sections: each category with anything in it, in the business's
/// order. The most popular are not repeated here: each of them is a dish in
/// its category (client_web's list shows the categories alone).
List<MenuSection> menuSections(Map<MenuCategory, List<MenuItem>> grouped, Locale locale) => [
  for (final MapEntry(key: category, value: items) in grouped.entries)
    if (category.id >= 0 && items.isNotEmpty) (label: category.name.getText(locale), items: items),
];

/// How long the deck must sit idle before a first-visit cue shows
const _cueAfter = Duration(milliseconds: 1400);

/// The menu tab as client_web draws it (components/menu/menu-screen.tsx), in
/// the style the business chose. A list, or the tiles, is one scrolling page
/// under the tab's large title, each category a heading over its dishes
/// (list/menu-grid.tsx). The deck is big cards, one column a category
/// (deck/deck.tsx); two fingers closing on it, a tap on the category in
/// view, or the grid button, zooms out to the whole menu as small tiles, the
/// photos of the cards in view flying to their tiles; two fingers opening
/// there, or the button, goes back to the cards the same way. Past the
/// deck's first card the chrome makes room for the cards. The categories are
/// chips above the dock, in the thumb's reach: on the cards they turn the
/// deck, on the page they follow the one in view and jump to one. A tap on a
/// dish opens its options; its plus, or a held press, puts it straight in the
/// tray. A first visit is shown the deck's gestures, once each.
class MenuScreen extends ConsumerStatefulWidget {
  const MenuScreen({super.key});

  @override
  ConsumerState<MenuScreen> createState() => _MenuScreenState();
}

class _MenuScreenState extends ConsumerState<MenuScreen> with TickerProviderStateMixin {
  final _scroll = ItemScrollController();
  final _positions = ItemPositionsListener.create();
  final _section = ValueNotifier(0);
  int _sections = 0;

  /// The deck's column in view, and whether the deck is zoomed out to the whole menu
  int _column = 0;
  bool _grid = false;
  bool _deckLayout = false;
  List<DeckColumn> _columns = const [];

  /// The card each column of the deck rests on, so zooming out finds it and back in lands on it
  final Map<int, int> _rows = {};

  /// The deck past its first card, and whether the last card swiped was back up one (the tabs asked back)
  bool _pastFirst = false;
  bool _tabsAsked = false;

  /// Between the deck and the whole menu both are on screen for the move: the one left fades out as
  /// the one arrived fades in, and the photos of the cards in view fly to their tiles (or back from
  /// them), all on the one spring. [_leaving] is the view being left, gone once it settles
  final _stage = GlobalKey();
  ZoomView? _leaving;
  List<ZoomFlight> _flights = const [];
  late final AnimationController _zoom;
  late final Animation<double> _zoomed;

  /// The chips' own height, measured: the deck runs under them while they are over its peek
  final _chips = GlobalKey();
  double _chipsHeight = 48;

  /// First visit: each gesture shown once, one after another, while nothing else is going on
  final _swipeHint = Hint(HintKey.swipe);
  final _zoomHint = Hint(HintKey.zoom);
  final _holdHint = Hint(HintKey.holdAdd);
  late final AnimationController _demo;
  HintKey? _demoOf;
  Timer? _cueTimer;
  String? _cueTimerFor;

  /// The shell's chrome, which the deck moves
  late final DeckCompact _compactChrome;
  late final DockTuck _tuck;

  /// The category a chip was tapped for: lit while the scroll runs there and after it, until the
  /// customer scrolls themselves (near the end the list cannot bring its heading to the top, and
  /// the spy alone would light another)
  int? _held;

  /// The tapped chip's own scroll is running: its movement does not let go of the chip
  bool _jumping = false;

  @override
  void initState() {
    super.initState();
    _zoom = AnimationController(vsync: this, value: 1, duration: zoomSpring.duration);
    _zoomed = CurvedAnimation(parent: _zoom, curve: zoomSpring);
    _demo = AnimationController(vsync: this);
    _compactChrome = ref.read(deckCompactProvider.notifier);
    _tuck = ref.read(dockTuckProvider.notifier);
    _positions.itemPositions.addListener(_spy);
    for (final hint in [_swipeHint, _zoomHint, _holdHint]) {
      hint.addListener(_onHints);
    }
    cueOnScreen.addListener(_onHints);
  }

  @override
  void dispose() {
    _positions.itemPositions.removeListener(_spy);
    _section.dispose();
    cueOnScreen.removeListener(_onHints);
    for (final hint in [_swipeHint, _zoomHint, _holdHint]) {
      hint.removeListener(_onHints);
      hint.dispose();
    }
    _cueTimer?.cancel();
    _demo.dispose();
    _zoom.dispose();
    // Off the menu the chrome is whole again (told once the tree is done changing)
    final compact = _compactChrome;
    final tuck = _tuck;
    final drove = _pastFirst;
    scheduleMicrotask(() {
      try {
        compact.set(false);
        if (drove) tuck.set(false);
      } catch (_) {
        // The app itself is closing
      }
    });
    super.dispose();
  }

  /// The deck past its first card: the chrome makes room for the cards. By where the customer is
  /// rather than which way they last swiped, so going back a card to compare two dishes keeps the
  /// room; the first card brings the chrome back. Held as it was while the deck is being left, so
  /// its cards do not change size under their flying photos
  bool get _compact => _deckLayout && _columns.isNotEmpty && (!_grid || _leaving == ZoomView.deck) && _pastFirst;

  /// Asked back on the compact deck, the dock's tabs come up over the next card's peek rather than
  /// taking the cards' room: the categories and the dock rise over the deck's bottom, the cards unmoved
  bool get _tabsOver => _compact && _tabsAsked;

  /// Tells the shell how the chrome stands: compact (the top bar up), and the dock's tabs folded
  /// while the deck is past its first card and was not swiped back
  void _syncChrome() {
    void tell() {
      if (!mounted) return;
      _compactChrome.set(_compact);
      if (_deckLayout && !_grid) _tuck.set(_compact && !_tabsAsked);
    }

    if (SchedulerBinding.instance.schedulerPhase == SchedulerPhase.persistentCallbacks) {
      WidgetsBinding.instance.addPostFrameCallback((_) => tell());
    } else {
      tell();
    }
  }

  void _onHints() {
    if (!mounted) return;
    // The deck acts the swipe or the pinch out with the fingertip, twice
    final showing = _swipeHint.showing
        ? HintKey.swipe
        : _zoomHint.showing
        ? HintKey.zoom
        : null;
    if (showing != _demoOf) {
      _demoOf = showing;
      if (showing != null && !reduceMotion(context)) {
        _demo.duration = gestureRun(showing == HintKey.swipe ? GestureKind.swipe : GestureKind.pinch);
        _demo.forward(from: 0);
      } else {
        _demo.value = 0;
      }
    }
    setState(() {});
  }

  /// Which category is in view: the last one whose heading has reached the
  /// top of the page; at the end of the page the last one, however short
  void _spy() {
    if (_sections == 0) return;
    // A tapped chip stays lit until the customer scrolls themselves
    final held = _held;
    if (held != null) {
      if (_section.value != held) _section.value = held;
      return;
    }
    final positions = _positions.itemPositions.value;
    if (positions.isEmpty) return;
    // The line a heading must reach to light its chip: near the top, until the last half-screen of the
    // list, over which it slides down to the bottom. The last categories, whose headings can never reach
    // the top, each light in turn as the list's end comes up, the last one at the end itself
    final last = positions.where((p) => p.index == _sections).firstOrNull;
    final left = last == null ? double.infinity : (last.itemTrailingEdge - 1).clamp(0.0, double.infinity);
    final ramp = (1 - left / 0.5).clamp(0.0, 1.0);
    final line = 0.08 + (0.92 - 0.08) * ramp;
    var index = 0;
    for (final p in positions) {
      // Item 0 is the title; the sections follow it
      if (p.index > 0 && p.itemLeadingEdge <= line && p.index - 1 > index) index = p.index - 1;
    }
    if (_section.value != index) _section.value = index;
  }

  /// A category turned to on the deck (a swipe sideways, a chip, the "up next" card)
  void _selectColumn(int column) {
    setState(() => _column = column);
    if (_swipeHint.pending) _swipeHint.done();
  }

  /// A column of the deck came to rest on a card. Only a swipe through the cards moves the chrome:
  /// turning to another category (which opens where it was) keeps it as it was
  void _onRowChange(int column, int row) {
    final was = _rows[column] ?? 0;
    _rows[column] = row;
    if (column != _column || row == was) return;
    setState(() {
      _pastFirst = row > 0;
      _tabsAsked = row < was;
    });
    if (row > 0 && _swipeHint.pending) _swipeHint.done();
    _syncChrome();
  }

  /// Starts a move away from [from]; false while one is still under way (they go one at a time).
  /// Under reduced motion the other view is simply there
  bool _beginZoom(ZoomView from) {
    if (_leaving != null) return false;
    if (!reduceMotion(context)) {
      _leaving = from;
      _flights = const [];
      // Held at the start until the flights are planned: the one arriving is not seen yet
      _zoom.value = 0;
      // Planned once the view arrived is laid out (and the whole menu has scrolled to where the deck
      // was): the photos of the deck's cards in view, each with its tile, measured where both are now
      WidgetsBinding.instance.addPostFrameCallback((_) {
        WidgetsBinding.instance.addPostFrameCallback((_) => _fly(from));
        WidgetsBinding.instance.scheduleFrame();
      });
    }
    return true;
  }

  void _fly(ZoomView from) {
    if (!mounted || _leaving != from) return;
    final room = _stage.currentContext?.findRenderObject() as RenderBox?;
    setState(() => _flights = room == null ? const [] : ZoomPhotos.plan(from, room));
    _zoom.forward(from: 0).whenCompleteOrCancel(() {
      if (!mounted) return;
      setState(() {
        _leaving = null;
        _flights = const [];
      });
      _syncChrome();
    });
  }

  /// The deck zoomed out: the whole menu, at the category the deck was on
  void _zoomOut() {
    if (_grid || !_beginZoom(ZoomView.deck)) return;
    final col = _columns.elementAtOrNull(_column);
    final category = col == null || col.usuals ? 0 : _column - (_columns.first.usuals ? 1 : 0);
    setState(() => _grid = true);
    _section.value = category;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.isAttached && category > 0) _scroll.jumpTo(index: category + 1);
    });
    if (_zoomHint.pending) _zoomHint.done();
    // The whole menu is a page of its own, its scroll tucking the dock
    _tuck.set(false);
    _syncChrome();
  }

  /// Back to the cards, where the deck was: [column] and [row] for elsewhere
  void _zoomIn({int? column, int? row}) {
    if (!_grid || _columns.isEmpty || !_beginZoom(ZoomView.grid)) return;
    final c = (column ?? _column).clamp(0, _columns.length - 1);
    if (row != null) _rows[c] = row;
    final at = _rows[c] ?? 0;
    setState(() {
      _grid = false;
      _column = c;
      _pastFirst = at > 0;
      // Back from the whole menu is a page opened afresh, which starts with its tabs
      _tabsAsked = true;
    });
    _syncChrome();
  }

  /// Back to the cards at the category in view, or where the deck was if that is the one
  void _backToCards() {
    final offset = _columns.isNotEmpty && _columns.first.usuals ? 1 : 0;
    final shown = (_section.value + offset).clamp(0, _columns.length - 1);
    shown == _column ? _zoomIn() : _zoomIn(column: shown, row: 0);
  }

  /// A chip tapped: its category scrolled to the top (as far as the list goes) and its chip held lit
  Future<void> _jump(int index) async {
    _held = index;
    _section.value = index;
    _jumping = true;
    try {
      await _scroll.scrollTo(index: index + 1, duration: const Duration(milliseconds: 450), curve: Curves.easeInOutCubic);
      // The last frames of the scroll land after it says it is done
      await Future<void>.delayed(const Duration(milliseconds: 80));
    } finally {
      _jumping = false;
    }
  }

  /// One timer for the cues: waiting for the deck to sit idle before one shows, or for one shown to
  /// run its course. Asked for on every build; a new ask replaces the old, the same one carries on
  void _cue(String? what, Duration after, VoidCallback run) {
    if (what == _cueTimerFor) return;
    _cueTimer?.cancel();
    _cueTimerFor = what;
    if (what != null) {
      _cueTimer = Timer(after, () {
        _cueTimerFor = null;
        if (mounted) run();
      });
    }
  }

  /// The cues, from where the deck is now: which one is next, whether it may show, and the card a
  /// "hold to add" sits on
  int? _hints({required bool ready}) {
    final current = _swipeHint.pending
        ? _swipeHint
        : _zoomHint.pending
        ? _zoomHint
        : _holdHint.pending
        ? _holdHint
        : null;
    if (current == null) {
      _cue(null, Duration.zero, () {});
      return null;
    }
    // A dish open over the menu, or another tab in front, is something going on
    final covered = !(ModalRoute.of(context)?.isCurrent ?? true) || !TickerMode.valuesOf(context).enabled;
    final idle = ready && !_grid && _leaving == null && !covered;
    final col = _columns.elementAtOrNull(_column);
    final active = col?.items.elementAtOrNull(_rows[_column] ?? 0);
    // "Hold to add" waits for a card a long press would add straight away
    final fits = current != _holdHint || (active != null && canQuickAdd(active));
    final kind = current == _swipeHint
        ? GestureKind.swipe
        : current == _zoomHint
        ? GestureKind.pinch
        : GestureKind.hold;
    if (current.showing) {
      // One showing as a dish opens (or the deck is left) is over, so nothing is left over what opened
      if (!idle) {
        _cue(null, Duration.zero, () {});
        WidgetsBinding.instance.addPostFrameCallback((_) => current.done());
      } else {
        _cue('done:${current.key.name}', gestureShown(kind), current.done);
      }
    } else if (idle && cueOnScreen.value == null && fits) {
      _cue('show:${current.key.name}', _cueAfter, current.show);
    } else {
      _cue(null, Duration.zero, () {});
    }
    return _holdHint.showing && active != null && canQuickAdd(active) ? active.id : null;
  }

  /// The deck's own demo of the cue showing: a nudge up for the swipe, a breath out for the pinch
  Widget _demoOver(Widget child) => AnimatedBuilder(
    animation: _demo,
    child: child,
    builder: (context, child) {
      final key = _demoOf;
      if (key == null || _demo.duration == null) return child!;
      final kind = key == HintKey.swipe ? GestureKind.swipe : GestureKind.pinch;
      final p = gesturePassAt(kind, _demo.duration! * _demo.value);
      return key == HintKey.swipe
          ? Transform.translate(offset: Offset(0, keyframes(const [0, -56, 0, -28, 0], const [0, 0.3, 0.55, 0.75, 1], p)), child: child)
          : Transform.scale(scale: keyframes(const [1, 0.9, 0.9, 1], const [0, 0.3, 0.7, 1], p), child: child);
    },
  );

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final locale = ref.watch(localeProvider);
    final branchId = ref.watch(selectedBranchIdProvider);
    final ordering = ref.watch(branchProvider).selectedBranch?.isOrderingEnabled ?? true;
    final layout = BrandStyle.of(context).layout.menuItem;
    final c = context.theme.colors;
    if (branchId == null) return const _Loading();

    final grouped = ref.watch(groupedMenuItemsProvider((locale, branchId)));
    final sections = menuSections(grouped.value ?? const {}, locale);
    _sections = sections.length;
    // The deck: the customer's usuals first, then each category
    final deck = layout == MenuItemLayout.deck;
    _deckLayout = deck;
    _columns = deck ? buildDeck(usualsLabel: l10n.yourUsuals, usuals: ref.watch(topMenuItemsProvider).value ?? const [], categories: sections) : const [];
    final staged = deck && _columns.isNotEmpty;
    final cards = staged && !_grid;
    final showDeck = staged && (!_grid || _leaving == ZoomView.deck);
    final showGrid = !staged || _grid || _leaving == ZoomView.grid;
    final compact = _compact;
    final tabsOver = _tabsOver;
    final holdHintId = deck ? _hints(ready: staged && grouped.hasValue) : null;
    // The dock over the bottom of the page: the categories sit on it
    final dock = MediaQuery.paddingOf(context).bottom;

    final body = grouped.when(
      skipLoadingOnRefresh: true,
      loading: () => const _Loading(),
      error: (error, _) => Center(
        child: EmptyState(
          icon: LucideIcons.circleAlert,
          title: l10n.failedToLoadMenu(error.toString()),
          action: NinjaButton(
            mainAxisSize: MainAxisSize.min,
            onPress: () => ref.invalidate(groupedMenuItemsProvider((locale, branchId))),
            child: Text(l10n.retry),
          ),
        ),
      ),
      data: (_) => sections.isEmpty
          ? Center(
              child: EmptyState(icon: LucideIcons.utensilsCrossed, title: l10n.noItemsAvailable),
            )
          : RefreshIndicator(
              color: c.foreground,
              backgroundColor: c.background,
              onRefresh: () async {
                ref.invalidate(groupedMenuItemsProvider((locale, branchId)));
                await ref.read(groupedMenuItemsProvider((locale, branchId)).future);
              },
              child: MediaQuery.removePadding(
                context: context,
                removeBottom: true,
                // The customer's own scrolling (a finger, a wheel, a trackpad) lets go of the chip they tapped
                child: NotificationListener<ScrollUpdateNotification>(
                  onNotification: (n) {
                    if (!_jumping && _held != null) {
                      _held = null;
                      _spy();
                    }
                    return false;
                  },
                  child: ScrollablePositionedList.builder(
                    itemScrollController: _scroll,
                    itemPositionsListener: _positions,
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                    itemCount: sections.length + 1,
                    itemBuilder: (context, index) {
                      if (index == 0) {
                        // The deck zoomed out has the way back to its cards by its title
                        return deck ? _Head(title: l10n.ninjaWholeMenu, paused: !ordering, onBack: _zoomIn) : _Head(title: l10n.menu, paused: !ordering);
                      }
                      return _Section(section: sections[index - 1], layout: layout);
                    },
                  ),
                ),
              ),
            ),
    );

    Widget fade(ZoomView view, Widget child) => IgnorePointer(
      ignoring: _leaving == view,
      child: AnimatedBuilder(
        animation: _zoomed,
        child: child,
        builder: (context, child) {
          final p = _zoomed.value;
          // The one left fades out over the first two fifths, the one arrived in over the first half
          final opacity = _leaving == view ? 1 - (p / 0.4).clamp(0.0, 1.0) : (_leaving == null ? 1.0 : (p / 0.5).clamp(0.0, 1.0));
          return Opacity(opacity: opacity, child: child);
        },
      ),
    );

    final Widget content = staged
        ? KeyedSubtree(
            key: const ValueKey('stage'),
            child: Stack(
              fit: StackFit.expand,
              children: [
                ClipRect(
                  key: _stage,
                  child: _demoOver(
                    Stack(
                      fit: StackFit.expand,
                      children: [
                        if (showGrid)
                          fade(
                            ZoomView.grid,
                            // Two fingers opening on the whole menu go back to the cards
                            PinchWatch(watch: Pinch.open, onPinch: _zoomIn, child: body),
                          ),
                        if (showDeck)
                          fade(
                            ZoomView.deck,
                            Column(
                              children: [
                                // On the cards, over the first one, and gone with the chrome past there
                                if (!ordering)
                                  AnimatedSize(
                                    duration: tuckSettle,
                                    curve: Curves.easeOut,
                                    child: AnimatedOpacity(
                                      opacity: compact ? 0 : 1,
                                      duration: tuckSettle,
                                      child: compact ? const SizedBox(width: double.infinity) : PausedNotice(title: l10n.orderingPausedTitle),
                                    ),
                                  ),
                                Expanded(
                                  // The deck moves the dock itself (by the card it is on), not by how far it has scrolled
                                  child: NotificationListener<ScrollNotification>(
                                    onNotification: (_) => true,
                                    // Two fingers closing on the cards zoom out to the whole menu
                                    child: PinchWatch(
                                      watch: Pinch.close,
                                      onPinch: _zoomOut,
                                      child: Deck(
                                        columns: _columns,
                                        column: _column.clamp(0, _columns.length - 1),
                                        onColumnChange: _selectColumn,
                                        rows: _rows,
                                        onRowChange: _onRowChange,
                                        holdHintId: holdHintId,
                                        onQuickAdd: (_) {
                                          if (_holdHint.pending) _holdHint.done();
                                        },
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        if (_flights.isNotEmpty)
                          Positioned.fill(
                            child: ZoomFlights(flights: _flights, progress: _zoomed),
                          ),
                      ],
                    ),
                  ),
                ),
                // The fingertip acting the cue out over the cards, and its words under the top
                Positioned.fill(
                  child: AnimatedSwitcher(
                    duration: const Duration(milliseconds: 180),
                    child: _swipeHint.showing
                        ? const GestureHint(key: ValueKey('swipe-tip'), kind: GestureKind.swipe)
                        : _zoomHint.showing
                        ? const GestureHint(key: ValueKey('pinch-tip'), kind: GestureKind.pinch)
                        : holdHintId != null
                        ? const GestureHint(key: ValueKey('hold-tip'), kind: GestureKind.hold)
                        : const SizedBox.shrink(),
                  ),
                ),
                Positioned(
                  top: 12,
                  left: 0,
                  right: 0,
                  child: Center(
                    child: AnimatedSwitcher(
                      duration: const Duration(milliseconds: 180),
                      child: _swipeHint.showing
                          ? HintBubble(key: const ValueKey('swipe'), icon: LucideIcons.moveVertical, text: l10n.ninjaHintSwipe)
                          : _zoomHint.showing
                          ? HintBubble(key: const ValueKey('zoom'), icon: LucideIcons.layoutGrid, text: l10n.ninjaHintZoom)
                          : const SizedBox.shrink(),
                    ),
                  ),
                ),
              ],
            ),
          )
        : KeyedSubtree(key: const ValueKey('page'), child: body);

    if (sections.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        final h = _chips.currentContext?.size?.height;
        if (mounted && h != null && h != _chipsHeight) setState(() => _chipsHeight = h);
      });
    }
    // Over the cards' peek while the tabs are asked back on the compact deck; else the deck stops above them
    final under = sections.isEmpty ? 0.0 : (tabsOver ? _chipsHeight - DockMetrics.of(MediaQuery.sizeOf(context).height).tabs : _chipsHeight);

    return Stack(
      fit: StackFit.expand,
      children: [
        // Between the loading page and the menu, one fades out as the other fades in
        AnimatedPositioned(
          duration: tuckSettle,
          curve: Curves.easeOut,
          left: 0,
          right: 0,
          top: 0,
          bottom: sections.isEmpty ? 0 : dock + under,
          child: AnimatedSwitcher(duration: Motion.base, switchInCurve: Motion.enter, switchOutCurve: Motion.exit, child: content),
        ),
        if (sections.isNotEmpty)
          // The categories, just above the dock; they come down with it as it tucks away
          AnimatedPositioned(
            duration: tuckSettle,
            curve: Curves.easeOut,
            left: 0,
            right: 0,
            bottom: dock,
            child: DecoratedBox(
              key: _chips,
              decoration: BoxDecoration(
                color: c.background,
                boxShadow: const [BoxShadow(color: Color(0x59000000), offset: Offset(0, -10), blurRadius: 18, spreadRadius: -14)],
              ),
              child: Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: cards
                    // On the cards the chips turn the deck; the one in view again, or the button, zooms out
                    ? LiquidChips(
                        labels: [for (final c in _columns) c.label],
                        active: _column.clamp(0, _columns.length - 1),
                        onSelect: (i) => i == _column ? _zoomOut() : _selectColumn(i),
                        trailing: NinjaIconButton(size: 36, semanticLabel: l10n.ninjaWholeMenu, onPress: _zoomOut, child: const Icon(LucideIcons.layoutGrid)),
                      )
                    : ValueListenableBuilder<int>(
                        valueListenable: _section,
                        builder: (context, active, _) => LiquidChips(
                          labels: [for (final s in sections) s.label],
                          active: active.clamp(0, sections.length - 1),
                          onSelect: _jump,
                          trailing: deck
                              ? NinjaIconButton(
                                  size: 36,
                                  semanticLabel: l10n.ninjaBackToCards,
                                  onPress: _backToCards,
                                  child: const Icon(LucideIcons.galleryVertical),
                                )
                              : null,
                        ),
                      ),
              ),
            ),
          ),
      ],
    );
  }
}

class _Loading extends StatelessWidget {
  const _Loading();

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
    child: DecoratedBox(
      decoration: BoxDecoration(color: context.theme.colors.muted, borderRadius: BorderRadius.circular(Ninja.cardRadius)),
      child: const SizedBox.expand(),
    ),
  );
}

/// The page's large title, and a word over the whole menu while ordering is paused
class _Head extends StatelessWidget {
  final String title;
  final bool paused;

  /// A way back before the title (the deck zoomed out: back to its cards)
  final VoidCallback? onBack;

  const _Head({required this.title, required this.paused, this.onBack});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final theme = context.theme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (onBack != null)
            Row(
              children: [
                NinjaIconButton(
                  onPress: onBack,
                  semanticLabel: l10n.ninjaBackToCards,
                  child: Icon(Directionality.of(context) == TextDirection.rtl ? LucideIcons.arrowRight : LucideIcons.arrowLeft),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: BrandHeading(title, style: theme.typography.headline.copyWith(color: theme.colors.foreground)),
                ),
              ],
            )
          else
            BrandHeading(title, style: theme.typography.title.copyWith(color: theme.colors.foreground)),
          if (paused) ...[const SizedBox(height: 20), PausedNotice(title: l10n.orderingPausedTitle, margin: EdgeInsets.zero)],
        ],
      ),
    );
  }
}

/// A category: its heading, then its dishes as the style lays them out
class _Section extends StatelessWidget {
  final MenuSection section;
  final MenuItemLayout layout;

  const _Section({required this.section, required this.layout});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final items = section.items;
    final Widget dishes = switch (layout) {
      // Small tiles, three a row: the tiles, and the deck zoomed out
      MenuItemLayout.deck || MenuItemLayout.tiles => Column(
        children: [
          for (var i = 0; i < items.length; i += 3) ...[
            if (i > 0) const SizedBox(height: 10),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (var j = i; j < i + 3; j++) ...[
                  if (j > i) const SizedBox(width: 10),
                  Expanded(child: j < items.length ? Rise(child: dishFor(layout, items[j])) : const SizedBox()),
                ],
              ],
            ),
          ],
        ],
      ),
      MenuItemLayout.card => Column(
        children: [
          for (var i = 0; i < items.length; i += 2) ...[
            if (i > 0) const SizedBox(height: 20),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(child: Rise(child: dishFor(layout, items[i]))),
                const SizedBox(width: 12),
                Expanded(child: i + 1 < items.length ? Rise(child: dishFor(layout, items[i + 1])) : const SizedBox()),
              ],
            ),
          ],
        ],
      ),
      MenuItemLayout.compact => Column(
        children: [
          for (final (i, item) in items.indexed) ...[
            if (i > 0) Divider(height: 1, thickness: 1, color: theme.colors.border.withValues(alpha: 0.6)),
            Rise(child: dishFor(layout, item)),
          ],
        ],
      ),
      _ => Column(
        children: [
          for (final (i, item) in items.indexed) ...[if (i > 0) const SizedBox(height: 16), Rise(child: dishFor(layout, item))],
        ],
      ),
    };
    return Padding(
      padding: const EdgeInsets.only(bottom: 28),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          BrandHeading(section.label, style: theme.typography.headline.copyWith(color: theme.colors.foreground)),
          const SizedBox(height: 12),
          dishes,
        ],
      ),
    );
  }
}

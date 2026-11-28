import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';
import '../../../core/brand/brand_provider.dart';
import '../../../core/layout/breakpoints.dart';
import 'package:ninja_app_core/models/localized_text.dart';
import 'package:ninja_app_core/motion/motion.dart';
import '../../../core/widgets/skeleton.dart';
import '../../../core/network/api_errors.dart';
import 'package:ninja_app_core/theme/app_theme.dart';
import '../../../core/widgets/pos_toast.dart';
import '../../../core/utils/natural_order.dart';
import '../../../l10n/app_localizations.dart';
import '../../customers/dialogs/customer_card_dialog.dart';
import '../../orders/providers/pending_orders_provider.dart';
import '../../orders/widgets/pending_orders.dart';
import '../../places/dialogs/place_panel.dart';
import '../../places/dialogs/start_stay_dialog.dart';
import '../../places/models/place.dart';
import '../../places/providers/places_provider.dart';
import '../../places/status.dart';
import '../../service_requests/widgets/service_requests_strip.dart';
import '../../tickets/models/enums.dart';
import '../../tickets/models/open_ticket.dart';
import '../../tickets/models/ticket_summary.dart';
import '../../tickets/providers/tickets_provider.dart';
import '../../tickets/services/tickets_service.dart';
import '../../sale/bill_route.dart';
import '../../sale/providers/sale_provider.dart';
import '../../sale/widgets/customer_dialog.dart';
import '../../deliveries/widgets/deliveries_summary.dart';
import '../dialogs/new_ticket_dialog.dart';
import '../just_settled.dart';
import '../widgets/bill_card.dart';
import '../widgets/place_list.dart';
import '../../../core/theme/type_roles.dart';

enum _Filter { all, room, table, counter }

const _placesPrefsKey = 'pos.floor.places';
const _placesWidth = 240.0;

/// Two columns. The narrow one is the searchable list of places with no
/// bill yet, always in reach so opening one is a single tap. The wide one
/// is what is happening: the open bills by last activity (app orders and
/// reservations join it in the next phase). Neither grows with the size of
/// the building — the list scrolls and searches, the bills are only the
/// open ones.
// A bill card's shape while the floor loads: a bordered card with a name
// line, a short line, and a total.
Widget _billCardSkeleton(BuildContext context) {
  final theme = context.theme;
  return Container(
    height: 112,
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(border: Border.all(color: theme.colors.border), borderRadius: BorderRadius.circular(Sizes.radiusCard)),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        skeletonBar(context, widthFactor: 0.7, height: 14),
        skeletonBar(context, widthFactor: 0.4),
        skeletonBar(context, widthFactor: 0.5, height: 18),
      ],
    ),
  );
}

// The open-places column while rooms and tables load: rows shaped like the
// place cards (an icon, a name, a status).
Widget _placesSkeleton(BuildContext context) {
  final theme = context.theme;
  return Skeleton(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < 6; i++) ...[
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(border: Border.all(color: theme.colors.border), borderRadius: BorderRadius.circular(Sizes.radiusCard)),
            child: Row(
              children: [
                skeletonBox(context, width: 36, height: 36),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      skeletonBar(context, widthFactor: 0.5, height: 13),
                      const SizedBox(height: 8),
                      skeletonBar(context, widthFactor: 0.3, height: 11),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
        ],
      ],
    ),
  );
}

class FloorScreen extends ConsumerStatefulWidget {
  const FloorScreen({super.key});

  @override
  ConsumerState<FloorScreen> createState() => _FloorScreenState();
}

class _FloorScreenState extends ConsumerState<FloorScreen> {
  _Filter _filter = _Filter.all;
  // The places column collapses so a busy floor gets the whole width; the
  // choice is remembered on this till
  bool _placesOpen = true;

  /// The places' search, drawn as the column's header
  final _placeSearch = TextEditingController();
  bool _openingTable = false;
  // A second-hand, only while a session runs or a reservation counts down
  Timer? _clock;
  // The bill just settled stays a moment, then folds away
  Timer? _fold;

  void _scheduleFold(Duration after) {
    _fold ??= Timer(after, () {
      _fold = null;
      if (mounted) ref.read(justSettledProvider.notifier).shown();
    });
  }

  void _syncClock(bool running) {
    if (running && _clock == null) {
      _clock = Timer.periodic(const Duration(seconds: 1), (_) => setState(() {}));
    } else if (!running && _clock != null) {
      _clock!.cancel();
      _clock = null;
    }
  }

  @override
  void dispose() {
    _clock?.cancel();
    _fold?.cancel();
    _placeSearch.dispose();
    super.dispose();
  }

  @override
  void initState() {
    super.initState();
    SharedPreferences.getInstance().then((prefs) {
      if (mounted && prefs.getString(_placesPrefsKey) == 'closed') setState(() => _placesOpen = false);
    });
  }

  Future<void> _togglePlaces() async {
    setState(() => _placesOpen = !_placesOpen);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_placesPrefsKey, _placesOpen ? 'open' : 'closed');
  }

  Future<void> _newTab() async {
    final ticketId = await showNewTicketDialog(context);
    // A new bill has nothing on it yet: straight to the pad, pointed at it
    if (ticketId != null && mounted) context.go('/order/$ticketId');
  }

  // Search, then the card: no sale, no list of everyone
  Future<void> _findCustomer() async {
    final l10n = AppLocalizations.of(context)!;
    final picked = await showCustomerDialog(context, accountsOnly: true, title: l10n.findCustomer);
    final id = picked?.id;
    if (id == null || id.isEmpty || !mounted) return;
    await showCustomerCard(context, id: id, name: picked!.name, phone: picked.phone, addedAtCounter: picked.addedAtCounter);
  }

  // A table with a bill is among the bills; the list only offers the free
  // ones, but the floor can be stale by a poll — go to the bill if one exists
  Future<void> _pickTable(Place table) async {
    final existing = (ref.read(openTicketsProvider).value ?? const [])
        .where((t) => t.type == TicketType.table && t.sessionId == null && t.placeId == table.id)
        .firstOrNull;
    if (existing != null) {
      context.go(billRoute(existing.id, label: existing.label));
      return;
    }
    setState(() => _openingTable = true);
    try {
      final ticketId = await ref.read(ticketsRepositoryProvider).openTicket(
            OpenTicketRequest(type: TicketType.table, placeId: table.id),
            // A retry on business Wi-Fi must not become a second command
            requestId: const Uuid().v4(),
          );
      unawaited(ref.read(openTicketsProvider.notifier).refresh());
      if (!mounted) return;
      // A new bill has nothing on it yet: straight to the pad, pointed at it
      context.go('/order/$ticketId');
    } catch (e) {
      if (!mounted) return;
      showPosToast(context, PosToastType.error, describeError(e, AppLocalizations.of(context)!));
    } finally {
      if (mounted) setState(() => _openingTable = false);
    }
  }

  // A free timed place has one thing to do: start the clock. Straight to
  // the rate choice, no panel in between; the panel still opens for a
  // place with a running clock or a hold, where there is more to see. A
  // place with no clock opens a bill.
  Future<void> _pickPlace(int placeId) async {
    final room = ref.read(placesProvider).places.where((r) => r.id == placeId).firstOrNull;
    final reservedNow = ref.read(placesProvider.notifier).reservationHolding(placeId) != null;
    // A party seated on their reservation: the panel, where the till clears the table or opens its bill
    final seatedNow = room?.seatedReservation != null;
    // With the clock off, a place that kept its tariff from a bigger plan is a plain table here
    final timed = room != null && room.isTimed && ref.read(featuresProvider).timeBilling;
    if (room != null && !timed && !reservedNow && !seatedNow) {
      await _pickTable(room);
      return;
    }
    final bool started;
    if (room != null && room.status == PlaceStatus.available && !reservedNow) {
      final outcome = await showStartStayDialog(context, room);
      if (outcome == StartOutcome.billOnly) {
        if (mounted) await _pickTable(room);
        return;
      }
      started = outcome == StartOutcome.started;
    } else {
      final outcome = await showPlacePanel(context, placeId);
      if (outcome == PlacePanelOutcome.bill && room != null) {
        if (mounted) await _pickTable(room);
        return;
      }
      started = outcome == PlacePanelOutcome.started;
    }
    if (started && mounted) await _openStartedPlaceTicket(placeId);
  }

  // A session just started in this room: Sales opens its bill on the event,
  // so it is not there the instant the start returns. Poll quickly until it
  // shows up and go there; give up after a while (Sales down, event lost)
  // and leave the cashier on the floor, where the room now shows occupied.
  Future<void> _openStartedPlaceTicket(int placeId) async {
    final deadline = DateTime.now().add(const Duration(seconds: 15));
    while (mounted && DateTime.now().isBefore(deadline)) {
      await ref.read(openTicketsProvider.notifier).refresh();
      if (!mounted) return;
      final bill = (ref.read(openTicketsProvider).value ?? const [])
          .where((t) => t.placeId == placeId && t.sessionId != null)
          .firstOrNull;
      if (bill != null) {
        context.go(billRoute(bill.id, label: bill.label));
        return;
      }
      await Future<void>.delayed(const Duration(milliseconds: 600));
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final rtl = Directionality.of(context) == TextDirection.rtl;
    final l10n = AppLocalizations.of(context)!;
    final tickets = ref.watch(openTicketsProvider);
    final placesState = ref.watch(placesProvider);
    // Places in the order people count them — Room 2 before Room 10 —
    // rooms first, then tables, then stations; and bills in the order of
    // their places, counter tabs last
    final sortedRooms = [...placesState.places]
      ..sort((a, b) {
        final byKind = a.kind.value.compareTo(b.kind.value);
        // By one name whatever the till's language, as the server orders them: by the screen's own the
        // order changed with the language (Arabic names sort apart from the English ones)
        return byKind != 0 ? byKind : naturalCompare(a.name.primary, b.name.primary);
      });
    final placeOrder = {for (final (i, place) in sortedRooms.indexed) place.id: i};
    int placeRank(TicketSummary b) => switch (b.type) {
          TicketType.counter => 0,
          _ => placeOrder[b.placeId ?? b.placeId] ?? sortedRooms.length,
        };
    int compareBills(TicketSummary a, TicketSummary b) {
      final byType = (a.type?.index ?? 99).compareTo(b.type?.index ?? 99);
      if (byType != 0) return byType;
      final byPlace = placeRank(a).compareTo(placeRank(b));
      if (byPlace != 0) return byPlace;
      return (a.openedAt ?? DateTime(0)).compareTo(b.openedAt ?? DateTime(0));
    }
    // First load of the room/table list: shimmer the column, not blank
    final placesLoading = placesState.isLoading && placesState.places.isEmpty;
    final pending = ref.watch(pendingOrdersProvider).value ?? const [];
    final sessions = placesState.openStays;
    final features = ref.watch(featuresProvider);
    // No tables to open or seat: the till is the open bills and the counter
    final cloudKitchen = ref.watch(isCloudKitchenProvider);
    // A tenant without the clock has no room bills to filter
    final rooms = features.timeBilling;
    // Reservations are the one thing not yet a bill that the cashier must
    // not miss: somebody is on their way, or due later today
    final reserved = features.reservations && !cloudKitchen ? placesState.openReservations.where((r) => r.isOpen).toList() : const <Reservation>[];
    final now = DateTime.now();
    Stay? stayForTicket(TicketSummary t) =>
        t.sessionId == null ? null : sessions.where((s) => s.id == t.sessionId && s.isRunning).firstOrNull;
    final bills = tickets.value ?? const <TicketSummary>[];
    // The bill settled on the ticket screen is gone from the list by now:
    // drawn once more where it was, it folds away and the grid closes up
    final justSettled = ref.watch(justSettledProvider);
    final leaving = justSettled != null && justSettled.fresh && tickets.hasValue && !bills.any((b) => b.id == justSettled.ticket.id)
        ? justSettled.ticket
        : null;
    if (justSettled != null && (leaving != null || !justSettled.fresh)) {
      _scheduleFold(leaving != null ? const Duration(milliseconds: 450) : Duration.zero);
    }
    _syncClock(reserved.isNotEmpty || bills.any((b) => stayForTicket(b) != null));
    final above = <Widget>[
      // A customer in a room is waiting on each of these, so they lead the
      // floor; app orders waiting for a tap come next. Both strips are
      // gone when nothing is pending.
      const ServiceRequestsStrip(),
      const PendingOrdersStrip(),
      // Deliveries out, one row however many: each lane's count, a tap from the board
      const DeliveriesSummary(),
      if (reserved.isNotEmpty)
        _HoldsRow(
          reserved: reserved,
          places: placesState.places,
          now: now,
          onPick: (reservation) => _pickPlace(reservation.placeId),
        ),
    ];

    // A 64 header over each column, ruled off like the sale pad's: the
    // places' rule and the bills' meet in one line, and a rule on the side
    // the places meet the bills
    BoxDecoration headerRule() => BoxDecoration(border: Border(bottom: BorderSide(color: theme.colors.border)));

    final toggle = SizedBox.square(
      dimension: Sizes.controlSmall,
      child: FButton.icon(
        variant: FButtonVariant.ghost,
        onPress: _togglePlaces,
        child: Icon(
          // Lucide's panel icons do not mirror with the text
          // direction (the arrows do), so pick the side by hand:
          // the places list sits at the start, which is the
          // right in Arabic
          _placesOpen
              ? (rtl ? FIcons.panelRightClose : FIcons.panelLeftClose)
              : (rtl ? FIcons.panelRightOpen : FIcons.panelLeftOpen),
          size: Sizes.icon,
          color: theme.colors.mutedForeground,
        ),
      ),
    );
    final title = Text(l10n.openBills, style: theme.type.title);
    // On a tablet the two worded buttons are as wide as their words; on a
    // phone they stretch over the row the icon buttons leave them
    Widget saleButton({bool stretch = false}) => SizedBox(
          height: Sizes.control,
          child: FButton(
            mainAxisSize: stretch ? MainAxisSize.max : MainAxisSize.min,
            // A new sale always starts empty, with nobody on it
            onPress: () {
              ref.read(saleProvider.notifier).clear();
              context.go('/sale');
            },
            prefix: const Icon(FIcons.shoppingCart, size: Sizes.icon),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: Text(l10n.newSale, style: theme.type.button),
            ),
          ),
        );
    Widget tabButton({bool stretch = false}) => SizedBox(
          height: Sizes.control,
          child: FButton(
            variant: FButtonVariant.outline,
            mainAxisSize: stretch ? MainAxisSize.max : MainAxisSize.min,
            onPress: _newTab,
            prefix: const Icon(FIcons.plus, size: Sizes.icon),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: Text(l10n.newTab, style: theme.type.button),
            ),
          ),
        );
    final receipts = SizedBox.square(
      dimension: Sizes.control,
      child: FButton.icon(
        variant: FButtonVariant.outline,
        onPress: () => context.go('/receipts'),
        child: const Icon(FIcons.receiptText, size: Sizes.icon),
      ),
    );
    // The customer who walked in only to pay their tab:
    // search, then their card — no sale, no list of everyone
    final findCustomer = SizedBox.square(
      dimension: Sizes.control,
      child: FButton.icon(
        variant: FButtonVariant.outline,
        onPress: _findCustomer,
        child: const Icon(FIcons.idCard, size: Sizes.icon),
      ),
    );
    final availability = SizedBox.square(
      dimension: Sizes.control,
      child: FButton.icon(
        variant: FButtonVariant.outline,
        onPress: () => context.go('/availability'),
        child: const Icon(FIcons.packageCheck, size: Sizes.icon),
      ),
    );
    final billsHeader = Row(
      children: [
        if (!cloudKitchen) toggle,
        if (!cloudKitchen) const SizedBox(width: 8),
        title,
        const Spacer(),
        saleButton(),
        // The places column is where a named counter tab opens;
        // with no places it opens from here
        if (cloudKitchen) ...[
          const SizedBox(width: 8),
          tabButton(),
        ],
        const SizedBox(width: 8),
        receipts,
        const SizedBox(width: 8),
        // Their card holds a tab and points: nothing to find them for without either
        if (features.tabs || features.loyalty) ...[
          findCustomer,
          const SizedBox(width: 8),
        ],
        availability,
      ],
    );

    final placeList = placesLoading
        ? _placesSkeleton(context)
        : PlaceList(
            places: sortedRooms,
            sessions: placesState.openStays,
            reservations: placesState.openReservations,
            // Its place frees up as the card folds
            tickets: [...?tickets.value, ?leaving],
            busy: _openingTable,
            timeBilling: features.timeBilling,
            onNewTab: _newTab,
            onPick: (place) => _pickPlace(place.id),
            search: _placeSearch,
          );

    // The bills scroll by themselves beside the places; on a phone they are
    // one part of a page that scrolls as a whole
    Widget billsBody({required bool scrolls}) => tickets.when(
          loading: () => Skeleton(
            child: LayoutBuilder(
              builder: (context, constraints) {
                final (columns, width) = _billColumns(context, constraints.maxWidth);
                return Wrap(
                  spacing: _billGap,
                  runSpacing: _billGap,
                  children: [
                    for (var i = 0; i < columns * 2; i++) SizedBox(width: width, child: _billCardSkeleton(context)),
                  ],
                );
              },
            ),
          ),
          error: (e, _) => Center(
            child: Text(l10n.somethingWentWrong, style: theme.type.body.copyWith(color: theme.colors.mutedForeground)),
          ),
          data: (list) => _Bills(
            bills: [...list, ?leaving]..sort(compareBills),
            above: above,
            // An order still waiting lights the bill it will land on
            waitingIds: {
              for (final b in list)
                if (pendingForTicket(pending, sessionId: b.sessionId, placeId: b.placeId).isNotEmpty) b.id,
            },
            // A running room shows its clock on the bill
            clocks: {
              for (final b in list)
                if (stayForTicket(b) case final s?) b.id: formatClock(s.elapsedSeconds(now)),
            },
            filter: _filter,
            onFilter: (filter) => setState(() => _filter = filter),
            rooms: rooms,
            scrolls: scrolls,
          ),
        );

    // No room for the places beside the bills: one page, the bills first
    // because they are what the screen is for, the places under them
    // (pos_web below `md`). The toggle still puts the places away.
    if (context.isNarrow) {
      final compact = context.isCompact;
      return SingleChildScrollView(
        padding: EdgeInsets.all(compact ? 12 : 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // A phone puts the buttons on a row of their own under the title
            if (compact) ...[
              Row(
                children: [
                  if (!cloudKitchen) toggle,
                  if (!cloudKitchen) const SizedBox(width: 8),
                  Expanded(child: title),
                ],
              ),
              const SizedBox(height: 12),
              if (cloudKitchen) ...[
                // Two worded buttons and three icons are more than one row holds
                Row(
                  children: [
                    Expanded(child: saleButton(stretch: true)),
                    const SizedBox(width: 8),
                    Expanded(child: tabButton(stretch: true)),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    receipts,
                    const SizedBox(width: 8),
                    findCustomer,
                    const SizedBox(width: 8),
                    availability,
                  ],
                ),
              ] else
                Row(
                  children: [
                    Expanded(child: saleButton(stretch: true)),
                    const SizedBox(width: 8),
                    receipts,
                    const SizedBox(width: 8),
                    findCustomer,
                    const SizedBox(width: 8),
                    availability,
                  ],
                ),
            ] else
              billsHeader,
            const SizedBox(height: 20),
            billsBody(scrolls: false),
            if (_placesOpen && !cloudKitchen) ...[
              const SizedBox(height: 24),
              PlaceSearchField(controller: _placeSearch),
              const SizedBox(height: 8),
              placeList,
            ],
          ],
        ),
      );
    }

    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Places with no bill yet — scrolling on its own, collapsed away
        // when the cashier wants the full width
        if (_placesOpen && !cloudKitchen)
          Container(
            width: _placesWidth + 32,
            decoration: BoxDecoration(border: BorderDirectional(end: BorderSide(color: theme.colors.border))),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // The search is the column's header: the list needs no title
                Container(
                  height: Sizes.header,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  alignment: Alignment.center,
                  decoration: headerRule(),
                  child: PlaceSearchField(controller: _placeSearch),
                ),
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(16),
                    child: placeList,
                  ),
                ),
              ],
            ),
          ),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(
                height: Sizes.header,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                decoration: headerRule(),
                child: billsHeader,
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: billsBody(scrolls: true),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

const _billGap = 12.0;

/// How many bill cards stand in a row of [maxWidth], and how wide each is.
/// From `sm` up as many as fit at 180 dp or more, none wider than 220 so a
/// lone bill stays a normal card, not a full-width banner; a phone shows two
/// across whatever its width (pos_web's `grid-cols-2`).
(int, double) _billColumns(BuildContext context, double maxWidth) {
  // Rounded down, so the two never add up to a hair more than the row
  if (context.isCompact) return (2, ((maxWidth - _billGap) / 2).floorToDouble());
  final columns = math.max(1, ((maxWidth + _billGap) / (180 + _billGap)).floor());
  return (columns, math.min(220.0, (maxWidth - _billGap * (columns - 1)) / columns));
}

class _Bills extends StatefulWidget {
  final List<TicketSummary> bills;
  final List<Widget> above;
  final Set<int> waitingIds;
  final Map<int, String> clocks;
  final _Filter filter;
  final ValueChanged<_Filter> onFilter;

  /// Whether this tenant has rooms; without them there is no Room filter
  final bool rooms;

  /// Whether the bills scroll by themselves; not on a phone, where the page they are part of does
  final bool scrolls;

  const _Bills({
    required this.bills,
    required this.above,
    required this.waitingIds,
    required this.clocks,
    required this.filter,
    required this.onFilter,
    required this.rooms,
    this.scrolls = true,
  });

  @override
  State<_Bills> createState() => _BillsState();
}

class _BillsState extends State<_Bills> {
  bool _searchOpen = false;
  final _search = TextEditingController();

  @override
  void initState() {
    super.initState();
    _search.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  void _closeSearch() {
    _search.clear();
    setState(() => _searchOpen = false);
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final bills = widget.bills;
    final above = widget.above;
    final waitingIds = widget.waitingIds;
    final clocks = widget.clocks;
    final filter = widget.filter;
    final onFilter = widget.onFilter;
    // Already in place order: rooms, tables, then counter tabs
    final sorted = bills;
    Widget page(List<Widget> children) {
      final column = Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: children);
      return widget.scrolls ? SingleChildScrollView(child: column) : column;
    }

    if (sorted.isEmpty) return page([...above, _EmptyFloor(l10n: l10n)]);

    final counts = {
      _Filter.all: sorted.length,
      _Filter.room: sorted.where((b) => b.type == TicketType.room).length,
      _Filter.table: sorted.where((b) => b.type == TicketType.table).length,
      _Filter.counter: sorted.where((b) => b.type == TicketType.counter).length,
    };
    final byType = switch (filter) {
      _Filter.all => sorted,
      _Filter.room => sorted.where((b) => b.type == TicketType.room).toList(),
      _Filter.table => sorted.where((b) => b.type == TicketType.table).toList(),
      _Filter.counter => sorted.where((b) => b.type == TicketType.counter).toList(),
    };
    final q = _search.text.trim().toLowerCase();
    // A phone's open search hides the filters, so it looks through every
    // open bill: a filter left on out of sight would hide a match with no
    // sign why. A tablet's filters stay in view beside it, and still apply
    final searchesAll = context.isCompact && _searchOpen;
    final shown = q.isEmpty
        ? byType
        : (searchesAll ? sorted : byType).where((b) {
            final name = (b.locationName?.localized(context) ?? b.label ?? '').toLowerCase();
            return name.contains(q) || '${b.id}'.contains(q);
          }).toList();

    final compact = context.isCompact;
    final searchField = FTextField(
      control: FTextFieldControl.managed(controller: _search),
      hint: l10n.searchBills,
      autofocus: true,
      maxLines: 1,
      prefixBuilder: (context, style, _) => Padding(
        padding: const EdgeInsetsDirectional.only(start: 12),
        child: Icon(FIcons.search, size: Sizes.icon, color: theme.colors.mutedForeground),
      ),
      suffixBuilder: (context, style, _) => FTappable(
        onPress: _closeSearch,
        child: Padding(
          padding: const EdgeInsetsDirectional.only(end: 12),
          child: Icon(FIcons.x, size: Sizes.icon, color: theme.colors.mutedForeground),
        ),
      ),
    );

    // The filters, and the search after them. A tablet wraps them; a phone
    // keeps them on one line that slides sideways, as pos_web's do: wrapped,
    // they took two rows of a screen that has few to give. A phone's open
    // search takes the whole line in place of the filters, as the sale pad's
    // takes the categories' place, and closing it brings them back
    final filters = <Widget>[
              for (final f in _Filter.values)
                if ((f == _Filter.all || counts[f]! > 0) && (f != _Filter.room || widget.rooms))
                  _FilterPill(
                    label: switch (f) {
                      _Filter.all => l10n.allBills,
                      _Filter.room => l10n.rooms,
                      _Filter.table => l10n.tables,
                      _Filter.counter => l10n.counter,
                    },
                    count: counts[f]!,
                    selected: filter == f,
                    onTap: () => onFilter(f),
                  ),
              // Many bills open? A search that expands from an icon and takes
              // the keyboard straight away, right after the filters.
              if (sorted.length > 6)
                _searchOpen
                    ? SizedBox(width: 220, child: searchField)
                    : SizedBox.square(
                        dimension: Sizes.controlSmall,
                        child: FButton.icon(
                          variant: FButtonVariant.outline,
                          onPress: () => setState(() => _searchOpen = true),
                          child: Icon(FIcons.search, size: Sizes.icon, color: theme.colors.mutedForeground),
                        ),
                      ),
    ];

    return page([
          ...above,
          if (compact && _searchOpen && sorted.length > 6)
            searchField
          else if (compact)
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  for (final (index, child) in filters.indexed) ...[
                    if (index > 0) const SizedBox(width: 8),
                    child,
                  ],
                ],
              ),
            )
          else
            Wrap(spacing: 8, runSpacing: 8, children: filters),
          const SizedBox(height: 12),
          LayoutBuilder(
            builder: (context, constraints) {
              const gap = _billGap;
              final (columns, width) = _billColumns(context, constraints.maxWidth);
              // Each row as tall as its tallest card, as pos_web's grid rows are: one with a two-line name or a
              // room's clock grows its row, the rest keep the card's least height
              final needs = [
                for (final ticket in shown)
                  BillCard.heightFor(context, ticket, width: width, clock: clocks[ticket.id] != null, waiting: waitingIds.contains(ticket.id)),
              ];
              double rowHeight(int index) {
                final start = index ~/ columns * columns;
                return needs.sublist(start, math.min(start + columns, needs.length)).reduce(math.max);
              }
              // A bill that closes folds away and the others slide up into
              // its place; one that opens slides in. A filter or a search
              // just redraws.
              return ReflowScope(
                child: Presence(
                  epoch: (filter, q),
                  exitDuration: Motion.slow,
                  enter: (context, key, child) => SlideInItem(child: child),
                  exit: (context, key, child, exit) => _FoldAway(animation: exit, child: child),
                  builder: (context, children) => Wrap(spacing: gap, runSpacing: gap, children: children),
                  children: [
                    for (final (index, ticket) in shown.indexed)
                      SizedBox(
                        key: ValueKey(ticket.id),
                        width: width,
                        child: ArrivedPop(
                          count: ticket.lineCount,
                          child: BillCard(
                            ticket: ticket,
                            clock: clocks[ticket.id],
                            waiting: waitingIds.contains(ticket.id),
                            height: rowHeight(index),
                            // An open bill opens as the order screen, its lines beside the menu; a
                            // delivery's bill, never added to, on its own page
                            onTap: () => context.go(billRoute(ticket.id, label: ticket.label)),
                          ),
                        ),
                      ),
                  ],
                ),
              );
            },
          ),
    ]);
  }
}

/// Reservations about to arrive: the place, who for, and the minutes left
/// before the reservation lapses (or, for one due later, when). A tap
/// opens the place to seat or cancel it.
class _HoldsRow extends StatelessWidget {
  final List<Reservation> reserved;
  final List<Place> places;
  final DateTime now;
  final ValueChanged<Reservation> onPick;

  const _HoldsRow({required this.reserved, required this.places, required this.now, required this.onPick});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final amber = AppColors.amber(theme.colors.brightness);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TypeLabel(l10n.statusReserved),
        const SizedBox(height: 8),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.only(bottom: 4),
          child: Row(
            children: [
              for (final (index, session) in reserved.indexed) ...[
                if (index > 0) const SizedBox(width: 12),
                FTappable(
                  onPress: () => onPick(session),
                  child: Container(
                    width: 240,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: theme.colors.background,
                      border: Border.all(color: theme.colors.border),
                      borderRadius: BorderRadius.circular(Sizes.radiusCard),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(color: AppColors.amber500.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(Sizes.radius)),
                          child: Icon(session.startOnConfirm ? FIcons.timerReset : FIcons.clock, size: Sizes.icon, color: amber),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                (places.where((r) => r.id == session.placeId).firstOrNull?.name ?? session.placeName).localized(context),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: theme.type.heading,
                              ),
                              Text(
                                (session.customerName ?? '').isNotEmpty ? session.customerName! : l10n.statusReserved,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: theme.type.detail.copyWith(color: theme.colors.mutedForeground),
                              ),
                            ],
                          ),
                        ),
                        if (session.isHolding ? session.secondsUntilExpiry(now) : null case final left?) ...[
                          const SizedBox(width: 8),
                          Text(formatCountdown(left),
                              style: theme.type.detail.copyWith(color: amber, fontFeatures: const [FontFeature.tabularFigures()])),
                        ] else if (!session.isHolding && session.forTime != null) ...[
                          const SizedBox(width: 8),
                          Text(TimeOfDay.fromDateTime(session.forTime!.toLocal()).format(context),
                              style: theme.type.detail
                                  .copyWith(color: theme.colors.mutedForeground, fontFeatures: const [FontFeature.tabularFigures()])),
                        ],
                      ],
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 16),
      ],
    );
  }
}

class _FilterPill extends StatelessWidget {
  final String label;
  final int count;
  final bool selected;
  final VoidCallback onTap;

  const _FilterPill({required this.label, required this.count, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: Sizes.controlSmall),
      child: FButton(
        variant: selected ? null : FButtonVariant.outline,
        mainAxisSize: MainAxisSize.min,
        onPress: onTap,
        suffix: FBadge(
          variant: FBadgeVariant.secondary,
          child: Text('$count', style: const TextStyle(fontFeatures: [FontFeature.tabularFigures()])),
        ),
        child: Text(label, style: theme.type.button),
      ),
    );
  }
}

class _EmptyFloor extends StatelessWidget {
  final AppLocalizations l10n;
  const _EmptyFloor({required this.l10n});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 80),
      child: Column(
        children: [
          Text(l10n.noOpenBills,
              style: theme.type.body.copyWith(fontWeight: FontWeight.w500, color: theme.colors.mutedForeground)),
        ],
      ),
    );
  }
}

/// A settled bill leaving the floor: it folds down from its top edge as it
/// fades, then gives up its place
class _FoldAway extends StatelessWidget {
  final Animation<double> animation;
  final Widget child;
  const _FoldAway({required this.animation, required this.child});

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: animation,
      child: child,
      builder: (context, child) {
        final t = Motion.exit.transform(animation.value);
        return Opacity(
          opacity: 1 - t,
          child: Transform(
            alignment: Alignment.topCenter,
            transform: Matrix4.identity()
              ..setEntry(3, 2, 0.0015)
              ..rotateX(-t * 0.9)
              ..scaleByDouble(1 - 0.06 * t, 1 - 0.06 * t, 1, 1),
            child: child,
          ),
        );
      },
    );
  }
}

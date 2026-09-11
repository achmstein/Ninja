import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';
import '../../../core/models/localized_text.dart';
import '../../../core/widgets/skeleton.dart';
import '../../../core/network/api_errors.dart';
import '../../../core/theme/text_styles.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/heading.dart';
import '../../../core/widgets/pos_toast.dart';
import '../../../l10n/app_localizations.dart';
import '../../customers/dialogs/customer_card_dialog.dart';
import '../../orders/providers/pending_orders_provider.dart';
import '../../orders/widgets/pending_orders.dart';
import '../../rooms/dialogs/room_panel.dart';
import '../../rooms/dialogs/start_session_dialog.dart';
import '../../rooms/models/room.dart';
import '../../rooms/providers/rooms_provider.dart';
import '../../rooms/status.dart';
import '../../tables/models/cafe_table.dart';
import '../../service_requests/widgets/service_requests_strip.dart';
import '../../tables/services/tables_service.dart';
import '../../tickets/models/enums.dart';
import '../../tickets/models/open_ticket.dart';
import '../../tickets/models/ticket_summary.dart';
import '../../tickets/providers/tickets_provider.dart';
import '../../tickets/services/tickets_service.dart';
import '../../sale/widgets/customer_dialog.dart';
import '../dialogs/new_ticket_dialog.dart';
import '../widgets/bill_card.dart';
import '../widgets/place_list.dart';

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
    decoration: BoxDecoration(border: Border.all(color: theme.colors.border), borderRadius: BorderRadius.circular(14)),
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
            decoration: BoxDecoration(border: Border.all(color: theme.colors.border), borderRadius: BorderRadius.circular(14)),
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
  bool _openingTable = false;
  // A second-hand, only while a session runs or a reservation counts down
  Timer? _clock;

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
    if (ticketId != null && mounted) context.go('/ticket/$ticketId');
  }

  // Search, then the card: no sale, no list of everyone
  Future<void> _findCustomer() async {
    final l10n = AppLocalizations.of(context)!;
    final picked = await showCustomerDialog(context, accountsOnly: true, title: l10n.findCustomer);
    final id = picked?.id;
    if (id == null || id.isEmpty || !mounted) return;
    await showCustomerCard(context, id: id, name: picked!.name, phone: picked.phone);
  }

  // A table with a bill is among the bills; the list only offers the free
  // ones, but the floor can be stale by a poll — go to the bill if one exists
  Future<void> _pickTable(CafeTable table) async {
    final existing = (ref.read(openTicketsProvider).value ?? const [])
        .where((t) => t.type == TicketType.table && t.tableId == table.id)
        .firstOrNull;
    if (existing != null) {
      context.go('/ticket/${existing.id}');
      return;
    }
    setState(() => _openingTable = true);
    try {
      final ticketId = await ref.read(ticketsRepositoryProvider).openTicket(
            OpenTicketRequest(type: TicketType.table, tableId: table.id, tableName: table.name),
            // A retry on café Wi-Fi must not become a second command
            requestId: const Uuid().v4(),
          );
      ref.read(openTicketsProvider.notifier).refresh();
      if (!mounted) return;
      context.go('/ticket/$ticketId');
    } catch (e) {
      if (!mounted) return;
      showPosToast(context, PosToastType.error, describeError(e, AppLocalizations.of(context)!));
    } finally {
      if (mounted) setState(() => _openingTable = false);
    }
  }

  // A free room has one thing to do: start the clock. Straight to the
  // single/multi choice, no panel in between; the panel still opens for
  // a room with a session or a reservation, where there is more to see.
  Future<void> _pickRoom(int roomId) async {
    final room = ref.read(roomsProvider).rooms.where((r) => r.id == roomId).firstOrNull;
    final bool started;
    if (room != null && room.status == RoomStatus.available) {
      started = await showStartSessionDialog(context, room);
    } else {
      started = await showRoomPanel(context, roomId);
    }
    if (started && mounted) await _openStartedRoomTicket(roomId);
  }

  // A session just started in this room: Sales opens its bill on the event,
  // so it is not there the instant the start returns. Poll quickly until it
  // shows up and go there; give up after a while (Sales down, event lost)
  // and leave the cashier on the floor, where the room now shows occupied.
  Future<void> _openStartedRoomTicket(int roomId) async {
    final deadline = DateTime.now().add(const Duration(seconds: 15));
    while (mounted && DateTime.now().isBefore(deadline)) {
      await ref.read(openTicketsProvider.notifier).refresh();
      if (!mounted) return;
      final bill = (ref.read(openTicketsProvider).value ?? const [])
          .where((t) => t.roomId == roomId && t.sessionId != null)
          .firstOrNull;
      if (bill != null) {
        context.go('/ticket/${bill.id}');
        return;
      }
      await Future.delayed(const Duration(milliseconds: 600));
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final rtl = Directionality.of(context) == TextDirection.rtl;
    final l10n = AppLocalizations.of(context)!;
    final tickets = ref.watch(openTicketsProvider);
    final rooms = ref.watch(roomsProvider);
    final tablesAsync = ref.watch(tablesProvider);
    final tables = tablesAsync.value ?? const <CafeTable>[];
    // First load of the room/table list: shimmer the column, not blank
    final placesLoading = (rooms.isLoading && rooms.rooms.isEmpty) || !tablesAsync.hasValue;
    final pending = ref.watch(pendingOrdersProvider).value ?? const [];
    final sessions = rooms.activeSessions;
    // Reservations are the one thing not yet a bill that the cashier must
    // not miss: somebody is on their way
    final reserved = sessions.where((s) => s.isReserved).toList();
    final now = DateTime.now();
    RoomSession? sessionForTicket(TicketSummary t) =>
        t.sessionId == null ? null : sessions.where((s) => s.id == t.sessionId && s.isActive).firstOrNull;
    final bills = tickets.value ?? const <TicketSummary>[];
    _syncClock(reserved.isNotEmpty || bills.any((b) => sessionForTicket(b) != null));
    final above = <Widget>[
      // A customer in a room is waiting on each of these, so they lead the
      // floor; app orders waiting for a tap come next. Both strips are
      // gone when nothing is pending.
      const ServiceRequestsStrip(),
      const PendingOrdersStrip(),
      if (reserved.isNotEmpty)
        _ReservationsRow(
          reserved: reserved,
          rooms: rooms.rooms,
          now: now,
          onPick: (session) => _pickRoom(session.roomId),
        ),
    ];

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Places with no bill yet — scrolling on its own, collapsed away
          // when the cashier wants the full width
          if (_placesOpen) ...[
            SizedBox(
              width: _placesWidth,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Padding(padding: const EdgeInsets.only(top: 8), child: Heading(l10n.openPlace)),
                  const SizedBox(height: 8),
                  Expanded(
                    child: SingleChildScrollView(
                      child: placesLoading
                          ? _placesSkeleton(context)
                          : PlaceList(
                              rooms: rooms.rooms,
                              sessions: rooms.activeSessions,
                              tables: tables,
                              tickets: tickets.value ?? const [],
                              busy: _openingTable,
                              onNewTab: _newTab,
                              onPickRoom: (room) => _pickRoom(room.id),
                              onPickTable: _pickTable,
                            ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 24),
          ],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    SizedBox.square(
                      dimension: 40,
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
                          size: 20,
                          color: theme.colors.mutedForeground,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(l10n.openBills, style: theme.typography.xl.copyWith(fontWeight: FontWeight.w700)),
                    const Spacer(),
                    SizedBox(
                      height: 48,
                      child: FButton(
                        mainAxisSize: MainAxisSize.min,
                        onPress: () => context.go('/sale'),
                        prefix: const Icon(FIcons.shoppingCart, size: 20),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 4),
                          child: Text(l10n.newSale, style: theme.typography.base.forButton),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    SizedBox.square(
                      dimension: 48,
                      child: FButton.icon(
                        variant: FButtonVariant.outline,
                        onPress: () => context.go('/receipts'),
                        child: const Icon(FIcons.receiptText, size: 20),
                      ),
                    ),
                    const SizedBox(width: 8),
                    // The customer who walked in only to pay their tab:
                    // search, then their card — no sale, no list of everyone
                    SizedBox.square(
                      dimension: 48,
                      child: FButton.icon(
                        variant: FButtonVariant.outline,
                        onPress: _findCustomer,
                        child: const Icon(FIcons.idCard, size: 20),
                      ),
                    ),
                    const SizedBox(width: 8),
                    SizedBox.square(
                      dimension: 48,
                      child: FButton.icon(
                        variant: FButtonVariant.outline,
                        onPress: () => context.go('/availability'),
                        child: const Icon(FIcons.packageCheck, size: 20),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                Expanded(
                  child: tickets.when(
                    loading: () => Skeleton(
                      child: LayoutBuilder(
                        builder: (context, constraints) {
                          const gap = 12.0;
                          final columns = math.max(1, ((constraints.maxWidth + gap) / (180 + gap)).floor());
                          final width = math.min(220.0, (constraints.maxWidth - gap * (columns - 1)) / columns);
                          return Wrap(
                            spacing: gap,
                            runSpacing: gap,
                            children: [
                              for (var i = 0; i < columns * 2; i++)
                                SizedBox(width: width, child: _billCardSkeleton(context)),
                            ],
                          );
                        },
                      ),
                    ),
                    error: (e, _) => Center(
                      child: Text(l10n.somethingWentWrong,
                          style: theme.typography.base.copyWith(color: theme.colors.mutedForeground)),
                    ),
                    data: (list) => _Bills(
                      bills: list,
                      above: above,
                      // An order still waiting lights the bill it will land on
                      waitingIds: {
                        for (final b in list)
                          if (pendingForTicket(pending, sessionId: b.sessionId, tableId: b.tableId).isNotEmpty) b.id,
                      },
                      // A running room shows its clock on the bill
                      clocks: {
                        for (final b in list)
                          if (sessionForTicket(b) case final s?) b.id: formatClock(s.elapsedSeconds(now)),
                      },
                      filter: _filter,
                      onFilter: (filter) => setState(() => _filter = filter),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Bills extends StatefulWidget {
  final List<TicketSummary> bills;
  final List<Widget> above;
  final Set<int> waitingIds;
  final Map<int, String> clocks;
  final _Filter filter;
  final ValueChanged<_Filter> onFilter;

  const _Bills({
    required this.bills,
    required this.above,
    required this.waitingIds,
    required this.clocks,
    required this.filter,
    required this.onFilter,
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
    // Bills by last activity: what just happened is what the cashier is
    // about to be asked about
    final sorted = [...bills]
      ..sort((a, b) => (b.lastActivityAt ?? DateTime(0)).compareTo(a.lastActivityAt ?? DateTime(0)));
    if (sorted.isEmpty) {
      return SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [...above, _EmptyFloor(l10n: l10n)],
        ),
      );
    }

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
    final shown = q.isEmpty
        ? byType
        : byType.where((b) {
            final name = (b.locationName?.localized(context) ?? b.label ?? '').toLowerCase();
            return name.contains(q) || '${b.id}'.contains(q);
          }).toList();

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ...above,
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final f in _Filter.values)
                if (f == _Filter.all || counts[f]! > 0)
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
                    ? SizedBox(
                        width: 220,
                        child: FTextField(
                          control: FTextFieldControl.managed(controller: _search),
                          hint: l10n.searchBills,
                          autofocus: true,
                          maxLines: 1,
                          prefixBuilder: (context, style, _) => Padding(
                            padding: const EdgeInsetsDirectional.only(start: 12),
                            child: Icon(FIcons.search, size: 18, color: theme.colors.mutedForeground),
                          ),
                          suffixBuilder: (context, style, _) => FTappable(
                            onPress: _closeSearch,
                            child: Padding(
                              padding: const EdgeInsetsDirectional.only(end: 12),
                              child: Icon(FIcons.x, size: 18, color: theme.colors.mutedForeground),
                            ),
                          ),
                        ),
                      )
                    : SizedBox.square(
                        dimension: 40,
                        child: FButton.icon(
                          variant: FButtonVariant.outline,
                          onPress: () => setState(() => _searchOpen = true),
                          child: Icon(FIcons.search, size: 20, color: theme.colors.mutedForeground),
                        ),
                      ),
            ],
          ),
          const SizedBox(height: 12),
          // Cards cap at ~220 dp so a lone bill stays a normal card, not a
          // full-width banner
          LayoutBuilder(
            builder: (context, constraints) {
              const gap = 12.0;
              final columns = math.max(1, ((constraints.maxWidth + gap) / (180 + gap)).floor());
              final width = math.min(220.0, (constraints.maxWidth - gap * (columns - 1)) / columns);
              return Wrap(
                spacing: gap,
                runSpacing: gap,
                children: [
                  for (final ticket in shown)
                    SizedBox(
                      width: width,
                      child: BillCard(ticket: ticket, clock: clocks[ticket.id], waiting: waitingIds.contains(ticket.id), onTap: () => context.go('/ticket/${ticket.id}')),
                    ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}

/// Reservations about to arrive: the room, who for, and the minutes left
/// before the hold lapses. A tap opens the room to start or cancel it.
class _ReservationsRow extends StatelessWidget {
  final List<RoomSession> reserved;
  final List<Room> rooms;
  final DateTime now;
  final ValueChanged<RoomSession> onPick;

  const _ReservationsRow({required this.reserved, required this.rooms, required this.now, required this.onPick});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final amber = AppColors.amber(theme.colors.brightness);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Heading(l10n.statusReserved),
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
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(color: AppColors.amber500.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(10)),
                          child: Icon(FIcons.clock, size: 20, color: amber),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                (rooms.where((r) => r.id == session.roomId).firstOrNull?.name ?? session.roomName).localized(context),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: theme.typography.base.copyWith(fontWeight: FontWeight.w600),
                              ),
                              Text(
                                (session.userName ?? '').isNotEmpty ? session.userName! : l10n.statusReserved,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground),
                              ),
                            ],
                          ),
                        ),
                        if (session.secondsUntilExpiry(now) case final left?) ...[
                          const SizedBox(width: 8),
                          Text(formatCountdown(left),
                              style: theme.typography.sm.copyWith(color: amber, fontFeatures: const [FontFeature.tabularFigures()])),
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
    return SizedBox(
      height: 44,
      child: FButton(
        variant: selected ? null : FButtonVariant.outline,
        mainAxisSize: MainAxisSize.min,
        onPress: onTap,
        suffix: FBadge(
          variant: FBadgeVariant.secondary,
          child: Text('$count', style: const TextStyle(fontFeatures: [FontFeature.tabularFigures()])),
        ),
        child: Text(label, style: theme.typography.base.forButton),
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
              style: theme.typography.lg.copyWith(fontWeight: FontWeight.w500, color: theme.colors.mutedForeground)),
          const SizedBox(height: 4),
          Text(l10n.noOpenBillsHint, style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground)),
        ],
      ),
    );
  }
}

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/motion/motion.dart';
import '../../../core/ui/ui.dart';
import '../widgets/hold_form.dart';
import '../widgets/reservation_panel.dart';
import '../../service_request/widgets/request_tiles.dart';
import '../../bills/widgets/open_bills.dart';
import '../../../core/theme/theme_provider.dart';
import '../../../core/brand/brand_style.dart';
import '../../../core/brand/styles.dart';
import '../../../core/models/localized_text.dart';
import '../../../core/providers/locale_provider.dart';
import '../../../core/auth/auth_service.dart';
import '../../../core/widgets/notice_card.dart';
import '../../../core/widgets/app_text.dart';
import '../../../l10n/app_localizations.dart';
import '../../../core/utils/money.dart';
import '../../../core/brand/brand_provider.dart';
import '../../../core/providers/branch_provider.dart';
import '../../../core/providers/branch_switch.dart';
import '../../../core/services/location_service.dart';
import '../../../core/models/branch.dart';
import '../../../core/widgets/branch_switcher.dart';
import '../../../core/widgets/main_scaffold.dart';
import '../../notifications/services/notification_service.dart';
import '../../service_request/models/service_request.dart';
import '../models/place.dart';
import '../../../core/services/signalr_service.dart';
import '../services/place_service.dart';

/// Rooms screen for viewing and reserving PlayStation rooms
class PlacesScreen extends ConsumerStatefulWidget {
  const PlacesScreen({super.key});

  @override
  ConsumerState<PlacesScreen> createState() => _PlacesScreenState();
}

class _PlacesScreenState extends ConsumerState<PlacesScreen> with WidgetsBindingObserver {
  Timer? _pollTimer;
  late final SignalRService _signalRService;
  final _scrollController = ScrollController();

  /// The place whose booking is open under its card: one at a time
  int? _openId;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _signalRService = ref.read(signalRServiceProvider);

    // Refresh when navigating to rooms tab
    ref.listenManual(currentRouteProvider, (previous, next) {
      if (next == '/places' && previous != '/places') {
        ref.read(myStaysProvider.notifier).refresh();
        ref.invalidate(placesProvider);
        _startPolling();
      } else if (previous == '/places' && next != '/places') {
        _stopPolling();
      }
    });

    _startPolling();

    // Scroll to top when a new reservation appears
    ref.listenManual(myReservationsProvider, (previous, next) {
      final hadReserved = openReservationOf(previous?.value ?? const []) != null;
      final hasReserved = openReservationOf(next.value ?? const []) != null;
      if (!hadReserved && hasReserved && _scrollController.hasClients) {
        _scrollController.animateTo(0, duration: const Duration(milliseconds: 300), curve: Curves.easeOut);
      }
    });

    // Join SignalR rooms group for realtime updates
    _signalRService.joinRoomsGroup();
  }

  @override
  void dispose() {
    _stopPolling();
    _scrollController.dispose();
    _signalRService.leaveRoomsGroup();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  void _startPolling() {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(const Duration(seconds: 15), (_) {
      ref.read(myStaysProvider.notifier).refresh();
      // Every branch listed for booking, not only this one
      ref.invalidate(placesProvider);
    });
  }

  void _stopPolling() {
    _pollTimer?.cancel();
    _pollTimer = null;
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Refresh sessions when app comes to foreground
    // Use refresh (not invalidate) to keep showing existing rooms
    // while fetching — the first request after resume often fails
    // due to stale sockets, and invalidate would flash an error.
    if (state == AppLifecycleState.resumed) {
      ref.read(myStaysProvider.notifier).refresh();
      ref.invalidate(placesProvider);
    }
  }

  @override
  Widget build(BuildContext context) {
    final branchId = ref.watch(selectedBranchIdProvider);
    final l10n = AppLocalizations.of(context)!;
    final c = context.theme.colors;
    if (branchId == null) {
      return NinjaPage(title: l10n.rooms, children: const [SizedBox.shrink()]);
    }
    final roomsAsync = ref.watch(placesProvider(branchId));
    final stay = ref.watch(myStaysProvider).value?.where((s) => s.status == StayStatus.active).firstOrNull;
    // The customer's open reservation, once the list has answered; until then none, so the places show rather than wait on it
    final reservedSession = openReservationOf(ref.watch(myReservationsProvider).value ?? const []);
    final reservationsEnabled = ref.watch(featuresProvider).reservations && (ref.watch(branchProvider).selectedBranch?.isReservationsEnabled ?? true);
    final rooms = roomsAsync.value ?? const <Place>[];
    final free = rooms.where((r) => r.canBookNow).length;
    // One place at a time: a hold, or a clock running
    final canReserve = reservedSession == null && stay == null && reservationsEnabled;
    final allBusy = rooms.isNotEmpty && free == 0;
    final layout = BrandStyle.of(context).layout.places;
    final features = ref.watch(featuresProvider);
    final branches = ref.watch(branchProvider).branches;
    final atBranch = ref.watch(atBranchProvider);
    // Every branch that takes bookings, each under its own name (client_web's places.tsx): this one
    // always, and every other open one taking reservations once its places are in and there are some
    final groups = <({Branch branch, List<Place> places})>[
      for (final b in branches)
        if (b.id == branchId)
          (branch: b, places: rooms)
        else if (features.reservations && b.isActive && b.isReservationsEnabled)
          if (ref.watch(placesProvider(b.id)).value case final List<Place> list when list.isNotEmpty) (branch: b, places: list),
    ];
    final multi = groups.length > 1;
    final here = ref.watch(locationProvider).here;
    final anyPoint = groups.any((g) => g.branch.point != null);
    // There are branches to measure: the phone may ask for the position, once a run
    if (multi && anyPoint) WidgetsBinding.instance.addPostFrameCallback((_) => ref.read(locationProvider.notifier).askOnce());
    final ordered = [
      for (final (:item, :meters) in branchesByDistance([for (final g in groups) g.branch], branchId, here))
        (branch: item, places: groups.firstWhere((g) => g.branch.id == item.id).places, meters: meters),
    ];
    // Another branch's places book only while the customer is at none (a bill, a scanned table)
    bool canReserveAt(Branch b) =>
        reservedSession == null && stay == null && features.reservations && b.isReservationsEnabled && (b.id == branchId || !atBranch);

    // A hold open: the tab is the reservation, one slab between the top bar and the dock, while they walk over
    if (reservedSession != null && stay == null) {
      return Padding(
        padding: EdgeInsets.fromLTRB(8, 8, 8, MediaQuery.paddingOf(context).bottom + 8),
        child: ReservationPanel(key: ValueKey(reservedSession.id), reservation: reservedSession),
      );
    }

    return NinjaPage(
      title: l10n.rooms,
      // In a room the heading says where; otherwise how many places are free
      subtitle: stay != null
          ? AppText(l10n.ninjaYoureIn(stay.placeName.localized(context)))
          : reservedSession == null && rooms.isNotEmpty && reservationsEnabled
              ? AppText(l10n.bookFreeNow(free))
              : null,
      action: HeaderAction(icon: const Icon(LucideIcons.history), onPress: () => context.push('/stays')),
      gap: 16,
      controller: _scrollController,
      onRefresh: () async {
        ref.invalidate(placesProvider);
        await ref.read(myStaysProvider.notifier).refresh();
      },
      children: [
        // In a room whose card is not on this list (another branch's): the slim card stands in for it
        if (stay != null && !rooms.any((r) => r.id == stay.placeId)) StayBanner(stay: stay),
        // Not taking bookings for now: the same notice as the menu's
        if (!(ref.watch(branchProvider).selectedBranch?.isReservationsEnabled ?? true))
          PausedNotice(title: l10n.reservationsPausedTitle, margin: EdgeInsets.zero),
        if (allBusy && reservedSession == null) const NotifyMeBanner(),
        // Booking across branches: the customer's position on their word, and the branch changed by hand
        if ((multi && anyPoint && here == null) || (branches.length > 1 && !atBranch))
          Row(
            children: [
              if (multi && anyPoint) const UseMyLocationButton(),
              const Spacer(),
              if (branches.length > 1 && !atBranch)
                Pressable(
                  onTap: () => showBranchSheet(context),
                  child: SizedBox(
                    height: 36,
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(LucideIcons.mapPin, size: 14, color: c.mutedForeground),
                        const SizedBox(width: 6),
                        AppText(
                          l10n.ninjaChangeBranch,
                          style: context.localeText(context.theme.typography.caption.copyWith(fontWeight: FontWeight.w600, color: c.mutedForeground)),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ...roomsAsync.when(
          skipLoadingOnRefresh: true,
          // The skeletons take the shape the places will
          loading: () => switch (layout) {
            PlacesLayout.cards => [
                for (var i = 0; i < 3; i++)
                  Container(height: 176, decoration: BoxDecoration(color: c.muted, borderRadius: BorderRadius.circular(Ninja.cardRadius))),
              ],
            PlacesLayout.list => [
                Column(
                  spacing: 8,
                  children: [
                    for (var i = 0; i < 5; i++)
                      Container(height: 64, decoration: BoxDecoration(color: c.muted, borderRadius: BorderRadius.circular(20))),
                  ],
                ),
              ],
            PlacesLayout.grid => [
                Column(
                  spacing: 12,
                  children: [
                    for (var i = 0; i < 2; i++)
                      Row(
                        spacing: 12,
                        children: [
                          for (var j = 0; j < 2; j++)
                            Expanded(
                              child: Container(height: 124, decoration: BoxDecoration(color: c.muted, borderRadius: BorderRadius.circular(24))),
                            ),
                        ],
                      ),
                  ],
                ),
              ],
          },
          // A stale socket after a resume: the places known stay up while the poll catches up
          error: (_, _) => roomsAsync.hasValue
              ? (multi ? _byBranch(ordered, stay, canReserveAt, layout) : _cards(rooms, stay, canReserve, layout))
              : [
                  EmptyState(
                    icon: LucideIcons.circleAlert,
                    title: l10n.failedToLoadRooms,
                    action: NinjaButton(
                      variant: NinjaButtonVariant.outline,
                      mainAxisSize: MainAxisSize.min,
                      onPress: () => ref.invalidate(placesProvider(branchId)),
                      child: AppText(l10n.retry),
                    ),
                  ),
                ],
          data: (rooms) => multi ? _byBranch(ordered, stay, canReserveAt, layout) : _cards(rooms, stay, canReserve, layout),
        ),
      ],
    );
  }

  /// Opens a place's booking, or closes it. Another branch's place moves the app to that branch first
  /// (asking when the order has dishes), then the booking opens as it would at home
  void _toggle(int placeId, int placeBranchId) {
    if (_openId == placeId) {
      setState(() => _openId = null);
      return;
    }
    requestBranchSwitch(context, ref, placeBranchId, then: () {
      if (mounted) setState(() => _openId = placeId);
    });
  }

  /// Booking across branches: each branch under its heading, closest first; in a room, that room
  /// leads as the hero and every other place follows quieter
  List<Widget> _byBranch(
    List<({Branch branch, List<Place> places, double? meters})> ordered,
    Stay? stay,
    bool Function(Branch) canReserveAt,
    PlacesLayout layout,
  ) {
    final branchId = ref.read(selectedBranchIdProvider);
    final mine = stay == null
        ? null
        : ordered.where((g) => g.branch.id == branchId).firstOrNull?.places.where((r) => r.id == stay.placeId).firstOrNull;
    final quiet = mine != null;
    return [
      if (stay != null && mine != null) YourRoomCard(stay: stay, place: mine),
      for (final group in ordered) ...[
        Opacity(opacity: quiet ? 0.6 : 1, child: _BranchHeading(branch: group.branch, places: group.places, meters: group.meters)),
        ..._laidOut(
          [for (final p in group.places) if (p != mine) p],
          !quiet && canReserveAt(group.branch),
          layout,
          quiet: quiet,
          placeBranchId: group.branch.id,
        ),
      ],
    ];
  }

  /// The places; in a room, that room first as the hero and the others after it, quieter: while the
  /// clock runs another place cannot be booked, so they are there to read rather than to tap
  List<Widget> _cards(List<Place> rooms, Stay? stay, bool canReserve, PlacesLayout layout) {
    final mine = stay == null ? null : rooms.where((r) => r.id == stay.placeId).firstOrNull;
    if (stay == null || mine == null) return _laidOut(rooms, canReserve, layout);
    final others = rooms.where((r) => r.id != mine.id).toList();
    return [
      YourRoomCard(stay: stay, place: mine),
      if (others.isNotEmpty) ...[
        SectionLabel(AppLocalizations.of(context)!.ninjaOtherPlaces),
        ..._laidOut(others, false, layout, quiet: true),
      ],
    ];
  }

  /// The places the way the business chose: a big card each, or the slim
  /// rows or tiles (those grouped by kind when there is more than one)
  List<Widget> _laidOut(List<Place> rooms, bool canReserve, PlacesLayout layout, {bool quiet = false, int? placeBranchId}) {
    final at = placeBranchId ?? ref.read(selectedBranchIdProvider) ?? 0;
    if (layout == PlacesLayout.cards) {
      return [
        for (final room in rooms) quiet ? Opacity(opacity: 0.6, child: _card(room, canReserve, at)) : _card(room, canReserve, at),
      ];
    }
    return [
      PlacesLaidOut(
        places: rooms,
        layout: layout,
        canReserve: canReserve,
        openId: _openId,
        quiet: quiet,
        onToggle: (id) => _toggle(id, at),
        onDone: (_) => setState(() => _openId = null),
      ),
    ];
  }

  Widget _card(Place room, bool canReserve, int placeBranchId) => PlaceListItem(
        key: ValueKey('$placeBranchId-${room.id}'),
        room: room,
        canReserve: canReserve,
        open: _openId == room.id && canReserve,
        onToggle: () => _toggle(room.id, placeBranchId),
        // Booked or turned down, the form goes; booked, the hold shows over the places
        onDone: (_) => setState(() => _openId = null),
      );
}

/// The room the customer is in, leading the Book tab: its own card made the
/// hero, on the slab with its kind drawn big behind it, the clock running
/// large under its name beside a live green dot, and the way into the room
/// (the same sheet as the dock's row opens)
class YourRoomCard extends StatefulWidget {
  final Stay stay;
  final Place place;

  const YourRoomCard({super.key, required this.stay, required this.place});

  @override
  State<YourRoomCard> createState() => _YourRoomCardState();
}

class _YourRoomCardState extends State<YourRoomCard> {
  late final Timer _tick;

  @override
  void initState() {
    super.initState();
    _tick = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _tick.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final theme = context.theme;
    final stay = widget.stay;
    return Pressable(
      onTap: () => showRoomSheet(context, stay),
      scale: 0.98,
      child: Container(
        clipBehavior: Clip.antiAlias,
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(color: theme.colors.slab, borderRadius: BorderRadius.circular(Ninja.cardRadius), boxShadow: Ninja.slabShadow),
        child: SlabInk(
          child: Builder(builder: (context) {
            final c = context.theme.colors;
            final caption = context.localeText(theme.typography.caption.copyWith(fontWeight: FontWeight.w700, color: c.foreground));
            return Stack(
              clipBehavior: Clip.none,
              children: [
                PositionedDirectional(
                  end: -24,
                  bottom: -32,
                  child: Transform.rotate(angle: -0.21, child: Icon(widget.place.kind.icon, size: 176, color: c.foreground.withValues(alpha: 0.12))),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        // Running now: the live dot and the words for it
                        Container(
                          padding: const EdgeInsetsDirectional.fromSTEB(10, 4, 10, 4),
                          decoration: ShapeDecoration(color: NinjaColors.success.withValues(alpha: 0.2), shape: const StadiumBorder()),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const LiveDot(size: 6),
                              const SizedBox(width: 6),
                              Text(l10n.bookClockRunning, style: caption.copyWith(color: NinjaColors.successOnSlab)),
                            ],
                          ),
                        ),
                        const Spacer(),
                        // The way in, worded as the dock's row is
                        Container(
                          height: 36,
                          padding: const EdgeInsetsDirectional.only(start: 14, end: 10),
                          decoration: ShapeDecoration(color: c.foreground.withValues(alpha: 0.12), shape: const StadiumBorder()),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(l10n.ninjaRoomOpen, style: context.localeText(theme.typography.note.copyWith(fontWeight: FontWeight.w600, color: c.foreground))),
                              const SizedBox(width: 4),
                              Icon(LucideIcons.chevronUp, size: 16, color: c.foreground),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    BrandHeading(widget.place.name.localized(context), style: theme.typography.title.copyWith(color: c.foreground)),
                    const SizedBox(height: 4),
                    // A clock reads hours first in either language
                    Text(
                      stay.formattedDuration,
                      textDirection: TextDirection.ltr,
                      style: TextStyle(
                        fontFamily: theme.typography.display.fontFamily,
                        fontSize: 40,
                        height: 1.1,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.5,
                        color: c.foreground,
                        fontFeatures: NinjaTypography.tabular,
                      ),
                    ),
                    if (stay.hasOptions && stay.currentOptionName != null) ...[
                      const SizedBox(height: 10),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: ShapeDecoration(color: c.foreground.withValues(alpha: 0.12), shape: const StadiumBorder()),
                        child: Text(stay.currentOptionName!.localized(context), style: caption.copyWith(fontWeight: FontWeight.w600)),
                      ),
                    ],
                  ],
                ),
              ],
            );
          }),
        ),
      ),
    );
  }
}

/// The Book tab while the customer's clock runs (client_web's stay-banner.tsx):
/// a slim card on the slab over the places, saying where they are and for how
/// long. A tap opens the room, the same sheet the dock's row opens.
class StayBanner extends StatefulWidget {
  final Stay stay;

  const StayBanner({super.key, required this.stay});

  @override
  State<StayBanner> createState() => _StayBannerState();
}

class _StayBannerState extends State<StayBanner> {
  // The clock ticks once a second while the card is up
  late final Timer _tick;

  @override
  void initState() {
    super.initState();
    _tick = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _tick.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final theme = context.theme;
    final c = theme.colors;
    return Pressable(
      onTap: () => showRoomSheet(context, widget.stay),
      scale: 0.98,
      child: Container(
        padding: const EdgeInsetsDirectional.fromSTEB(16, 12, 12, 12),
        decoration: BoxDecoration(color: c.slab, borderRadius: BorderRadius.circular(Ninja.panelRadius), boxShadow: Ninja.slabShadow),
        child: SlabInk(
          child: Builder(
            builder: (context) {
              final ink = context.theme.colors.foreground;
              return Row(
                children: [
                  SizedBox(
                    width: 44,
                    height: 44,
                    child: Stack(
                      children: [
                        Container(
                          decoration: BoxDecoration(color: ink.withValues(alpha: 0.12), shape: BoxShape.circle),
                          child: Center(child: Icon(widget.stay.placeKind.icon, size: 20, color: ink)),
                        ),
                        PositionedDirectional(
                          end: 3,
                          top: 3,
                          child: Container(width: 6, height: 6, decoration: const BoxDecoration(color: NinjaColors.success, shape: BoxShape.circle)),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          l10n.ninjaYoureIn(widget.stay.placeName.localized(context)),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: context.localeText(theme.typography.caption.copyWith(color: ink.withValues(alpha: 0.7))),
                        ),
                        Text(
                          widget.stay.formattedDuration,
                          textDirection: TextDirection.ltr,
                          style: theme.typography.name.copyWith(fontWeight: FontWeight.w700, color: ink, fontFeatures: NinjaTypography.tabular),
                        ),
                      ],
                    ),
                  ),
                  Icon(LucideIcons.chevronUp, size: 20, color: ink.withValues(alpha: 0.7)),
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}

/// The room the customer is in, on the slab sheet: its clock, what can be
/// asked for there, and the way out. The dock's row and the Book tab's
/// card both open it, so the room lives in one place.
Future<void> showRoomSheet(BuildContext context, Stay stay) => showNinjaSheet(
      context: context,
      builder: (context) => Consumer(
        builder: (context, ref, _) {
          // The stay as it is now, while the sheet is open
          final live = ref.watch(myStaysProvider).value?.where((s) => s.id == stay.id).firstOrNull ?? stay;
          return _ActiveStayView(session: live);
        },
      ),
    );

/// Active session view - shown when user is currently playing
class _ActiveStayView extends ConsumerStatefulWidget {
  final Stay session;

  const _ActiveStayView({required this.session});

  @override
  ConsumerState<_ActiveStayView> createState() => _ActiveStayViewState();
}

class _ActiveStayViewState extends ConsumerState<_ActiveStayView> with PlaceRequests {
  @override
  RequestTarget get requestTarget =>
      (placeId: widget.session.placeId, placeKind: widget.session.placeKind, placeName: widget.session.placeName, sessionId: widget.session.id);

  /// Which rate option was asked for: the staff's list says a switch is open, not to what
  String? _askedOption;

  // The clock ticks once a second
  late final Timer _tick;

  @override
  void initState() {
    super.initState();
    _tick = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _tick.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final session = widget.session;

    return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // The clock as the hero (client_web's stay-clock.tsx): the biggest thing in the room,
            // and who is in it. No money here; the bill carries that
            _StayClock(stay: session),
            const SizedBox(height: 20),

            // What the place can take: a waiter and the bill anywhere, a
            // controller in a console room, a switch per other rate option
            RequestGrid(actions: _quickActions(session)),

            // Where the rate has options: the rate now, and each other one as the switch to it
            if (session.hasOptions) ...[
              const SizedBox(height: 12),
              _rateSwitch(session),
            ],

            // Its bills, as they run: the room's time and the rounds on it, the way to pay
            ..._openBills(),

            // Leave session button (non-owners only)
            if (session.customerId != null &&
                session.customerId != ref.read(authServiceProvider).userId) ...[
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: NinjaButton(
                  variant: NinjaButtonVariant.outline,
                  onPress: () => _confirmLeaveSession(session.id),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(LucideIcons.logOut, size: 16),
                      const SizedBox(width: 8),
                      Text(AppLocalizations.of(context)!.leaveSession),
                    ],
                  ),
                ),
              ),
            ],
          ],
        );
  }

  List<Widget> _openBills() => [
        if (OpenBills.any(ref)) ...[const SizedBox(height: 20), const OpenBills()],
      ];

  /// The waiter, the bill and, in a console room, the controller (client_web's stay-requests.tsx);
  /// paying is the bill's own bar, under the bill
  List<RequestAction> _quickActions(Stay session) {
    final l10n = AppLocalizations.of(context)!;
    return [
      requestAction(ServiceRequestType.callWaiter, LucideIcons.bell, l10n.callWaiter),
      requestAction(ServiceRequestType.receiptToPay, LucideIcons.receipt, l10n.getBill),
      if (session.takesControllerRequests) requestAction(ServiceRequestType.controllerChange, LucideIcons.gamepad2, l10n.controller),
    ];
  }

  /// The rate (client_web's stay-requests.tsx `RateSwitch`): where the clock
  /// stands, said rather than a control, then every other option as the one
  /// thing it does, ask the staff to switch to it, with what it costs once
  /// they do. The one asked is taken back with a tap while it is only sent.
  Widget _rateSwitch(Stay session) {
    final l10n = AppLocalizations.of(context)!;
    final theme = context.theme;
    final c = theme.colors;
    final money = ref.watch(moneyProvider);
    final state = requestState(ServiceRequestType.changeOption);
    final open = state.phase != RequestPhase.idle && state.phase != RequestPhase.sending;
    final current = session.options.where((o) => o.code == session.currentOptionCode).firstOrNull;
    String perHour(double rate) => '${money.whole(rate)}${l10n.perHourShort}';
    final caption = context.localeText(theme.typography.caption.copyWith(color: c.mutedForeground));
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(color: c.muted, borderRadius: BorderRadius.circular(Ninja.panelRadius)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (current != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              child: Row(
                children: [
                  Expanded(child: Text(l10n.ninjaRateNow, style: caption.copyWith(fontWeight: FontWeight.w500))),
                  Text(
                    '${current.name.localized(context)} · ${perHour(current.hourlyRate)}',
                    style: context.localeText(theme.typography.note.copyWith(fontWeight: FontWeight.w600, color: c.foreground)),
                  ),
                ],
              ),
            ),
          for (final option in session.options.where((o) => o.code != session.currentOptionCode))
            Builder(builder: (context) {
              final asked = (open || sendingRequest == ServiceRequestType.changeOption) && option.code == _askedOption;
              final phase = asked ? state.phase : RequestPhase.idle;
              final name = option.name.localized(context);
              final note = switch (phase) {
                RequestPhase.onTheWay => l10n.ninjaStaffSwitching,
                RequestPhase.sent => '${l10n.sent} · ${l10n.tapToCancel}',
                _ => l10n.ninjaRateOnceSwitched(perHour(option.hourlyRate)),
              };
              // Another goes while nothing is asked; the one asked is taken back while it is only sent
              final disabled = (open && !asked) || phase == RequestPhase.onTheWay || sendingRequest != null;
              const green = NinjaColors.successSolid;
              final (Color fill, Color disc, Color ink) = switch (phase) {
                RequestPhase.onTheWay => (green.withValues(alpha: 0.15), green, Colors.white),
                RequestPhase.sent => (c.primary.withValues(alpha: 0.12), c.primary, c.primaryForeground),
                _ => (c.background, c.muted, c.foreground),
              };
              return Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Pressable(
                  scale: 0.98,
                  onTap: disabled
                      ? null
                      : () {
                          if (!asked) _askedOption = option.code;
                          tapRequest(ServiceRequestType.changeOption, optionCode: option.code);
                        },
                  child: AnimatedContainer(
                    duration: Motion.slow,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(color: fill, borderRadius: BorderRadius.circular(Ninja.tileRadius)),
                    child: Row(
                      children: [
                        AnimatedContainer(
                          duration: Motion.slow,
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(color: disc, shape: BoxShape.circle),
                          child: BlurSwap(
                            alignment: Alignment.center,
                            child: phase == RequestPhase.sending
                                ? SizedBox(key: const ValueKey('sending'), width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: ink))
                                : Icon(
                                    switch (phase) {
                                      RequestPhase.onTheWay => LucideIcons.check,
                                      RequestPhase.sent => LucideIcons.hourglass,
                                      _ => LucideIcons.arrowLeftRight,
                                    },
                                    key: ValueKey(phase),
                                    size: 20,
                                    color: ink,
                                  ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                phase == RequestPhase.idle ? l10n.switchToOption(name) : l10n.ninjaSwitchingTo(name),
                                style: context.localeText(theme.typography.note.copyWith(fontWeight: FontWeight.w600, color: c.foreground)),
                              ),
                              BlurSwap(
                                child: Text(note, key: ValueKey(note), maxLines: 1, overflow: TextOverflow.ellipsis, style: caption),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            }),
        ],
      ),
    );
  }

  void _confirmLeaveSession(int sessionId) {
    final l10n = AppLocalizations.of(context)!;

    showNinjaSheet(
      context: context,
      builder: (dialogContext) => NinjaDialog(
        title: AppText(l10n.leaveRoomQuestion),
        actions: [
          NinjaButton(
            variant: NinjaButtonVariant.secondary,
            onPress: () => Navigator.pop(dialogContext),
            child: AppText(l10n.cancel),
          ),
          NinjaButton(
            variant: NinjaButtonVariant.destructive,
            onPress: () async {
              Navigator.pop(dialogContext);
              try {
                await ref.read(placeRepositoryProvider).leaveStay(sessionId);
                if (!mounted) return;

                ref.read(myStaysProvider.notifier).refresh();
                final branchId = ref.read(selectedBranchIdProvider);
                if (branchId != null) ref.invalidate(placesProvider(branchId));

                showIsland(
                  context: context,
                  title: Text(l10n.leftSession),
                  icon: Icon(LucideIcons.check, color: NinjaColors.success),
                );
              } catch (e) {
                if (mounted) {
                  showIsland(
                    context: context,
                    title: Text(l10n.failedToLeaveSession),
                    icon: Icon(LucideIcons.circleX, color: context.theme.colors.destructive),
                  );
                }
              }
            },
            child: AppText(l10n.yesLeave),
          ),
        ],
      ),
    );
  }
}

class _StayClock extends ConsumerWidget {
  final Stay stay;

  const _StayClock({required this.stay});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final theme = context.theme;
    final c = theme.colors;
    final self = ref.read(authServiceProvider).userId;
    final caption = context.localeText(theme.typography.caption.copyWith(fontWeight: FontWeight.w600, color: c.foreground));
    // The owner first, then in the order they joined
    final members = [...stay.members]..sort((a, b) => a.isOwner == b.isOwner ? 0 : (a.isOwner ? -1 : 1));
    return Stack(
      clipBehavior: Clip.none,
      children: [
        // The place's kind drawn big behind the clock
        PositionedDirectional(
          end: -24,
          top: -20,
          child: Transform.rotate(angle: 0.21, child: Icon(stay.placeKind.icon, size: 176, color: c.foreground.withValues(alpha: 0.07))),
        ),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(width: 8, height: 8, decoration: const BoxDecoration(color: NinjaColors.success, shape: BoxShape.circle)),
                const SizedBox(width: 8),
                Expanded(child: Text(l10n.bookClockRunning, style: caption)),
                if (stay.hasOptions && stay.currentOptionName != null)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                    decoration: ShapeDecoration(color: c.muted, shape: const StadiumBorder()),
                    child: Text(stay.currentOptionName!.localized(context), style: caption.copyWith(fontWeight: FontWeight.w700)),
                  ),
              ],
            ),
            const SizedBox(height: 20),
            // A clock reads hours first in either language
            Text(
              stay.formattedDuration,
              textDirection: TextDirection.ltr,
              style: TextStyle(
                fontFamily: theme.typography.display.fontFamily,
                fontSize: 52,
                height: 1,
                fontWeight: FontWeight.w800,
                letterSpacing: -1,
                color: c.foreground,
                fontFeatures: NinjaTypography.tabular,
              ),
            ),
            // Who is in the room: the owner first, you filled in
            if (members.isNotEmpty) ...[
              const SizedBox(height: 20),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final member in members)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                      decoration: ShapeDecoration(color: member.customerId == self ? c.foreground : c.muted, shape: const StadiumBorder()),
                      child: Text(
                        member.customerId == self ? l10n.payYou : (member.customerName?.trim() ?? '').split(' ').first,
                        style: caption.copyWith(color: member.customerId == self ? c.background : c.foreground),
                      ),
                    ),
                ],
              ),
            ],
          ],
        ),
      ],
    );
  }
}

/// Banner prompting user to subscribe for room availability notifications
class NotifyMeBanner extends ConsumerWidget {
  const NotifyMeBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final subscriptionAsync = ref.watch(roomAvailabilitySubscriptionProvider);
    final locale = ref.watch(localeProvider);
    final l10n = AppLocalizations.of(context)!;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: context.theme.colors.foreground.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: context.theme.colors.foreground.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Icon(LucideIcons.bell, size: 24, color: context.theme.colors.foreground),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                AppText(
                  l10n.allRoomsBusy,
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          subscriptionAsync.when(
            loading: () => SizedBox(
              width: 24,
              height: 24,
              child: CircularProgressIndicator(strokeWidth: 2, color: context.theme.colors.primary),
            ),
            error: (_, st) => IconButton(
              onPressed: () => ref.invalidate(roomAvailabilitySubscriptionProvider),
              icon: Icon(LucideIcons.refreshCw, color: context.theme.colors.destructive),
            ),
            data: (isSubscribed) => NinjaSwitch(
              value: isSubscribed,
              onChange: (value) async {
                final repo = ref.read(notificationRepositoryProvider);
                if (value) {
                  final success = await repo.subscribeToRoomAvailability(
                    preferredLanguage: locale.languageCode,
                  );
                  ref.invalidate(roomAvailabilitySubscriptionProvider);
                  if (context.mounted) {
                    showIsland(
                      context: context,
                      title: Text(success ? l10n.youWillBeNotified : l10n.failedToSubscribe),
                      icon: Icon(
                        success ? LucideIcons.bell : LucideIcons.circleX,
                        color: success ? NinjaColors.success : context.theme.colors.destructive,
                      ),
                    );
                  }
                } else {
                  await repo.unsubscribeFromRoomAvailability();
                  ref.invalidate(roomAvailabilitySubscriptionProvider);
                  if (context.mounted) {
                    showIsland(
                      context: context,
                      title: Text(l10n.unsubscribedFromNotifications),
                      icon: Icon(LucideIcons.check, color: context.theme.colors.mutedForeground),
                    );
                  }
                }
              },
            ),
          ),
        ],
      ),
    );
  }
}

/// Place list item - minimal design like menu items
class PlaceListItem extends ConsumerWidget {
  final Place room;
  final bool canReserve;

  /// The booking is open beneath the card's face
  final bool open;
  final VoidCallback? onToggle;

  /// The booking under the card went through (true) or was turned down
  final ValueChanged<bool>? onDone;

  const PlaceListItem({
    super.key,
    required this.room,
    this.canReserve = true,
    this.open = false,
    this.onToggle,
    this.onDone,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final free = room.canBookNow;
    final tappable = free && canReserve;
    final rate = tariffLine(context, ref.watch(moneyProvider), room.options);

    // One bookable place as a big card, the way the deck shows a dish: a free one on the dock's slab
    // with its name set large and its kind drawn big behind it, a busy one quiet on a light card
    final face = Builder(
      builder: (context) {
        final theme = context.theme;
        final c = theme.colors;
        final statusColor = free ? NinjaColors.successOnSlab : placeStatusColor(room, canReserve, c);
        return Stack(
          clipBehavior: Clip.none,
          children: [
            PositionedDirectional(
              end: -24,
              bottom: -32,
              child: Transform.rotate(
                angle: -0.21,
                child: Icon(room.kind.icon, size: 176, color: c.foreground.withValues(alpha: free ? 0.12 : 0.06)),
              ),
            ),
            ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 136),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: ShapeDecoration(
                          color: free ? NinjaColors.success.withValues(alpha: 0.2) : c.muted,
                          shape: const StadiumBorder(),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(width: 6, height: 6, decoration: BoxDecoration(color: free ? NinjaColors.success : statusColor, shape: BoxShape.circle)),
                            const SizedBox(width: 6),
                            Text(
                              placeStatusLabel(context, room.displayStatus),
                              style: context.localeText(theme.typography.caption.copyWith(fontWeight: FontWeight.w700, color: statusColor)),
                            ),
                          ],
                        ),
                      ),
                      const Spacer(),
                      // Open, the plus turns to a cross that folds it away
                      if (tappable)
                        AnimatedRotation(
                          turns: open ? 0.125 : 0,
                          duration: Motion.base,
                          curve: Motion.enter,
                          child: Container(
                            width: 40,
                            height: 40,
                            decoration: BoxDecoration(color: c.foreground, shape: BoxShape.circle),
                            child: Icon(LucideIcons.plus, size: 20, color: c.background),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  BrandHeading(room.name.localized(context), style: theme.typography.title.copyWith(color: c.foreground)),
                  if (room.description != null) ...[
                    const SizedBox(height: 6),
                    Text(
                      room.description!.localized(context),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: context.localeText(theme.typography.note.copyWith(color: free ? c.foreground.withValues(alpha: 0.8) : c.mutedForeground)),
                    ),
                  ],
                  if (rate.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: ShapeDecoration(color: free ? c.foreground.withValues(alpha: 0.12) : c.muted, shape: const StadiumBorder()),
                      child: Text(
                        rate,
                        style: context.localeText(theme.typography.caption.copyWith(fontWeight: FontWeight.w600, color: c.foreground, fontFeatures: NinjaTypography.tabular)),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        );
      },
    );

    final theme = context.theme;
    final top = Pressable(
      onTap: tappable ? onToggle : null,
      scale: open ? 1 : 0.98,
      child: Padding(padding: const EdgeInsets.all(20), child: free ? SlabInk(child: face) : face),
    );
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: free
          ? BoxDecoration(color: theme.colors.slab, borderRadius: BorderRadius.circular(Ninja.cardRadius), boxShadow: Ninja.slabShadow)
          : theme.surface(radius: Ninja.cardRadius),
      child: AnimatedSize(
        duration: Motion.slow,
        curve: Motion.enter,
        alignment: Alignment.topCenter,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            top,
            // The booking, beneath the card's face, on the page's own colour
            if (open)
              Reveal(
                child: Container(
                  margin: const EdgeInsets.fromLTRB(6, 0, 6, 6),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(color: theme.colors.background, borderRadius: BorderRadius.circular(22)),
                  child: HoldForm(place: room, onDone: (booked) => onDone?.call(booked)),
                ),
              ),
          ],
        ),
      ),
    );
  }

}

/// The colour a place's status is said in, as its pill has it
Color placeStatusColor(Place room, bool canReserve, NinjaColors colors) => switch (room.displayStatus) {
      PlaceStatus.available => canReserve ? NinjaColors.success : colors.mutedForeground,
      PlaceStatus.occupied => colors.destructive,
      PlaceStatus.reserved => NinjaColors.warning,
      PlaceStatus.maintenance => colors.mutedForeground,
    };

/// A place's status in words
String placeStatusLabel(BuildContext context, PlaceStatus status) {
  final l10n = AppLocalizations.of(context)!;
  return switch (status) {
    PlaceStatus.available => l10n.available,
    PlaceStatus.occupied => l10n.occupied,
    PlaceStatus.reserved => l10n.reserved,
    PlaceStatus.maintenance => l10n.maintenance,
  };
}

/// The places in the slim layouts: a row each, or two tiles a row. With more
/// than one kind among them, each kind under its own heading, in the order
/// the kinds first come. Quiet, they are there to read (the customer is in a room).
class PlacesLaidOut extends StatelessWidget {
  final List<Place> places;
  final PlacesLayout layout;
  final bool canReserve;

  /// The place whose booking is open beneath it
  final int? openId;
  final bool quiet;
  final ValueChanged<int>? onToggle;
  final ValueChanged<bool>? onDone;

  const PlacesLaidOut({
    super.key,
    required this.places,
    required this.layout,
    this.canReserve = true,
    this.openId,
    this.quiet = false,
    this.onToggle,
    this.onDone,
  });

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final kinds = <PlaceKind>[];
    for (final place in places) {
      if (!kinds.contains(place.kind)) kinds.add(place.kind);
    }
    if (kinds.length < 2) return _group(places);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final (i, kind) in kinds.indexed) ...[
          if (i > 0) const SizedBox(height: 16),
          SectionLabel(switch (kind) {
            PlaceKind.room => l10n.ninjaPlacesRooms,
            PlaceKind.table => l10n.ninjaPlacesTables,
            PlaceKind.station => l10n.ninjaPlacesStations,
          }),
          _group(places.where((p) => p.kind == kind).toList()),
        ],
      ],
    );
  }

  bool _open(Place place) => openId == place.id && canReserve;

  Widget _quiet(Widget child) => quiet ? Opacity(opacity: 0.6, child: child) : child;

  Widget _row(Place place) => _quiet(PlaceRow(
        key: ValueKey(place.id),
        room: place,
        canReserve: canReserve,
        open: _open(place),
        onToggle: () => onToggle?.call(place.id),
        onDone: onDone,
      ));

  Widget _tile(Place place) => _quiet(PlaceTile(
        key: ValueKey(place.id),
        room: place,
        canReserve: canReserve,
        open: _open(place),
        onToggle: () => onToggle?.call(place.id),
        onDone: onDone,
      ));

  Widget _group(List<Place> group) {
    if (layout == PlacesLayout.list) {
      return Column(crossAxisAlignment: CrossAxisAlignment.stretch, spacing: 8, children: [for (final place in group) _row(place)]);
    }
    // Two a row; the open one takes a row to itself, its booking beneath it, and the rest pair on after it
    final rows = <Widget>[];
    Place? waiting;
    for (final place in group) {
      if (_open(place)) {
        rows.add(_tile(place));
      } else if (waiting == null) {
        waiting = place;
      } else {
        rows.add(_pair(waiting, place));
        waiting = null;
      }
    }
    if (waiting != null) rows.add(_pair(waiting, null));
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, spacing: 12, children: rows);
  }

  /// Two tiles side by side, as tall as the taller; one alone keeps half the row
  Widget _pair(Place first, Place? second) => IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          spacing: 12,
          children: [
            Expanded(child: _tile(first)),
            Expanded(child: second == null ? const SizedBox.shrink() : _tile(second)),
          ],
        ),
      );
}

/// The booking beneath a place's face, on the page's own colour, the box
/// growing to take it as the card's does
class _WithBooking extends StatelessWidget {
  final Place room;
  final Widget top;
  final bool open;
  final Decoration decoration;
  final double radius;
  final ValueChanged<bool>? onDone;

  const _WithBooking({required this.room, required this.top, required this.open, required this.decoration, required this.radius, this.onDone});

  @override
  Widget build(BuildContext context) {
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: decoration,
      child: AnimatedSize(
        duration: Motion.slow,
        curve: Motion.enter,
        alignment: Alignment.topCenter,
        // Closed, the face alone, so a tile in a row of two can stand as tall as its neighbour
        child: !open
            ? top
            : Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  top,
                  Reveal(
                    child: Container(
                      margin: const EdgeInsets.fromLTRB(6, 0, 6, 6),
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(color: context.theme.colors.background, borderRadius: BorderRadius.circular(radius - 6)),
                      child: HoldForm(place: room, onDone: (booked) => onDone?.call(booked)),
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}

/// The plus that opens a place's booking; open, it turns to a cross that folds it away
class _BookToggle extends StatelessWidget {
  final bool open;
  final double size;
  final Color fill;
  final Color ink;

  const _BookToggle({required this.open, required this.size, required this.fill, required this.ink});

  @override
  Widget build(BuildContext context) => AnimatedRotation(
        turns: open ? 0.125 : 0,
        duration: Motion.base,
        curve: Motion.enter,
        child: Container(
          width: size,
          height: size,
          decoration: BoxDecoration(color: fill, shape: BoxShape.circle),
          child: Icon(LucideIcons.plus, size: size / 2, color: ink),
        ),
      );
}

/// A status dot, then the status and the rate on one line ("● Free · 60/hour")
class _PlaceMeta extends ConsumerWidget {
  final Place room;
  final bool canReserve;

  const _PlaceMeta({required this.room, required this.canReserve});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = context.theme;
    final c = theme.colors;
    final free = room.canBookNow;
    final rate = tariffLine(context, ref.watch(moneyProvider), room.options);
    final color = free ? NinjaColors.success : placeStatusColor(room, canReserve, c);
    final caption = context.localeText(theme.typography.caption.copyWith(color: c.mutedForeground, fontFeatures: NinjaTypography.tabular));
    return Text.rich(
      TextSpan(children: [
        WidgetSpan(
          alignment: PlaceholderAlignment.middle,
          child: Padding(
            padding: const EdgeInsetsDirectional.only(end: 6),
            child: Container(width: 6, height: 6, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
          ),
        ),
        TextSpan(text: placeStatusLabel(context, room.displayStatus), style: TextStyle(fontWeight: FontWeight.w600, color: color)),
        if (rate.isNotEmpty) TextSpan(text: ' · $rate'),
      ]),
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: caption,
    );
  }
}

/// One place as a slim row: its kind in a rounded square, its name over its
/// status and rate, and the plus when it can be booked. A tap opens the
/// booking beneath the row, as the card does. A busy one reads quieter.
class PlaceRow extends StatelessWidget {
  final Place room;
  final bool canReserve;
  final bool open;
  final VoidCallback? onToggle;
  final ValueChanged<bool>? onDone;

  const PlaceRow({super.key, required this.room, this.canReserve = true, this.open = false, this.onToggle, this.onDone});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final c = theme.colors;
    final free = room.canBookNow;
    final tappable = free && canReserve;
    final ink = free ? c.foreground : c.mutedForeground;
    final top = Pressable(
      onTap: tappable ? onToggle : null,
      scale: open ? 1 : 0.98,
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 64),
        child: Padding(
          padding: const EdgeInsetsDirectional.fromSTEB(10, 10, 12, 10),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(color: c.muted, borderRadius: BorderRadius.circular(14)),
                child: Icon(room.kind.icon, size: 20, color: ink),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      room.name.localized(context),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: context.localeText(theme.typography.name.copyWith(fontWeight: FontWeight.w700, color: ink)),
                    ),
                    const SizedBox(height: 2),
                    _PlaceMeta(room: room, canReserve: canReserve),
                  ],
                ),
              ),
              if (tappable) ...[
                const SizedBox(width: 12),
                _BookToggle(open: open, size: 36, fill: c.slab, ink: c.slabInk),
              ],
            ],
          ),
        ),
      ),
    );
    return _WithBooking(room: room, top: top, open: open, decoration: theme.surface(radius: 20), radius: 20, onDone: onDone);
  }
}

/// One place as a small tile, two a row: its status and the plus at the top,
/// its name and rate at the foot, its kind drawn faint behind. A free one on
/// the slab, as the card; open, it takes the row to itself, the booking beneath.
class PlaceTile extends ConsumerWidget {
  final Place room;
  final bool canReserve;
  final bool open;
  final VoidCallback? onToggle;
  final ValueChanged<bool>? onDone;

  const PlaceTile({super.key, required this.room, this.canReserve = true, this.open = false, this.onToggle, this.onDone});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final free = room.canBookNow;
    final tappable = free && canReserve;
    final rate = tariffLine(context, ref.watch(moneyProvider), room.options);
    final face = Builder(
      builder: (context) {
        final theme = context.theme;
        final c = theme.colors;
        final statusColor = free ? NinjaColors.successOnSlab : placeStatusColor(room, canReserve, c);
        return Stack(
          clipBehavior: Clip.none,
          // Passed through, so a tile stretched to its neighbour's height sets its name at the foot
          fit: StackFit.passthrough,
          children: [
            PositionedDirectional(
              end: -16,
              bottom: -24,
              child: Transform.rotate(
                angle: -0.21,
                child: Icon(room.kind.icon, size: 96, color: c.foreground.withValues(alpha: free ? 0.12 : 0.06)),
              ),
            ),
            ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 92),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: ShapeDecoration(color: free ? NinjaColors.success.withValues(alpha: 0.2) : c.muted, shape: const StadiumBorder()),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(width: 6, height: 6, decoration: BoxDecoration(color: free ? NinjaColors.success : statusColor, shape: BoxShape.circle)),
                              const SizedBox(width: 5),
                              Flexible(
                                child: Text(
                                  placeStatusLabel(context, room.displayStatus),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: context.localeText(theme.typography.micro.copyWith(fontWeight: FontWeight.w700, color: statusColor)),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const Spacer(),
                      if (tappable) _BookToggle(open: open, size: 32, fill: c.foreground, ink: c.background),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        room.name.localized(context),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: context.localeText(theme.typography.name.copyWith(fontWeight: FontWeight.w700, color: c.foreground)),
                      ),
                      if (rate.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text(
                          rate,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: context.localeText(theme.typography.caption.copyWith(color: c.mutedForeground, fontFeatures: NinjaTypography.tabular)),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
          ],
        );
      },
    );

    final theme = context.theme;
    final top = Pressable(
      onTap: tappable ? onToggle : null,
      scale: open ? 1 : 0.98,
      child: Padding(padding: const EdgeInsets.all(16), child: free ? SlabInk(child: face) : face),
    );
    return _WithBooking(
      room: room,
      top: top,
      open: open,
      decoration: free
          ? BoxDecoration(color: theme.colors.slab, borderRadius: BorderRadius.circular(24), boxShadow: Ninja.slabShadow)
          : theme.surface(radius: 24),
      radius: 24,
      onDone: onDone,
    );
  }
}

/// The rate as the tariff has it: one figure for a one-rate place, one per
/// option when there is a choice ("Single 50 EGP · Multi 80 EGP /hr").
String tariffLine(BuildContext context, MoneyFormat money, List<RateOption> options) {
  final l10n = AppLocalizations.of(context)!;
  if (options.isEmpty) return '';
  if (options.length == 1) return l10n.hourlyRateFormat(money.whole(options.first.hourlyRate));
  final parts = options
      .map((o) => l10n.optionRateFormat(o.name.localized(context), money.whole(o.hourlyRate)))
      .join(' · ');
  return '$parts ${l10n.perHourShort}';
}


/// A branch's heading over its places, when booking spans branches: its name,
/// how many are free and how far, and the way there
class _BranchHeading extends StatelessWidget {
  final Branch branch;
  final List<Place> places;
  final double? meters;

  const _BranchHeading({required this.branch, required this.places, required this.meters});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final muted = theme.colors.mutedForeground;
    final caption = context.localeText(theme.typography.caption.copyWith(color: muted));
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                AppText(
                  branch.name.localized(context),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: context.localeText(theme.typography.headline.copyWith(fontWeight: FontWeight.w800, color: theme.colors.foreground)),
                ),
                Row(
                  children: [
                    AppText(l10n.bookFreeNow(places.where((p) => p.canBookNow).length), style: caption),
                    if (meters != null) ...[
                      AppText(' · ', style: caption),
                      Text(distanceText(context, meters!), textDirection: TextDirection.ltr, style: caption.copyWith(fontFeatures: NinjaTypography.tabular)),
                    ],
                  ],
                ),
              ],
            ),
          ),
          DirectionsButton(branch: branch),
        ],
      ),
    );
  }
}

import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/motion/motion.dart';
import '../../../core/ui/ui.dart';
import '../../bills/models/bill.dart';
import '../../bills/services/bills_service.dart';
import '../../bills/widgets/bill_swipe.dart';
import '../../bills/widgets/bill_tile.dart';
import '../../orders/services/order_service.dart';
import '../../../core/theme/theme_provider.dart';
import '../../../core/brand/brand_style.dart';
import 'package:intl/intl.dart' hide TextDirection;
import '../../../core/models/localized_text.dart';
import '../../../core/providers/locale_provider.dart';
import '../../../core/auth/auth_service.dart';
import '../../../core/widgets/notice_card.dart';
import '../../../core/widgets/profile_gate.dart';
import '../../../core/widgets/app_text.dart';
import '../../../l10n/app_localizations.dart';
import '../../../core/utils/money.dart';
import '../../../core/brand/brand_provider.dart';
import '../../../core/providers/branch_provider.dart';
import '../../../core/widgets/main_scaffold.dart';
import '../../notifications/services/notification_service.dart';
import '../../service_request/models/service_request.dart';
import '../../service_request/services/service_request_service.dart';
import '../../pay/services/pay_service.dart';
import '../../pay/widgets/pay_sheet.dart';
import '../models/place.dart';
import '../../../core/services/signalr_service.dart';
import '../services/place_service.dart';
import '../../../core/services/sound_service.dart';

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

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _signalRService = ref.read(signalRServiceProvider);

    // Refresh when navigating to rooms tab
    ref.listenManual(currentRouteProvider, (previous, next) {
      if (next == '/places' && previous != '/places') {
        ref.read(myStaysProvider.notifier).refresh();
        final branchId = ref.read(selectedBranchIdProvider);
        if (branchId != null) ref.invalidate(placesProvider(branchId));
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
      final branchId = ref.read(selectedBranchIdProvider);
      if (branchId != null) ref.invalidate(placesProvider(branchId));
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
      final branchId = ref.read(selectedBranchIdProvider);
      if (branchId != null) ref.invalidate(placesProvider(branchId));
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

    return NinjaPage(
      title: l10n.rooms,
      subtitle: reservedSession == null && stay == null && rooms.isNotEmpty && reservationsEnabled ? AppText(l10n.bookFreeNow(free)) : null,
      action: HeaderAction(icon: const Icon(LucideIcons.history), onPress: () => context.push('/stays')),
      gap: 16,
      controller: _scrollController,
      onRefresh: () async {
        ref.invalidate(placesProvider(branchId));
        await ref.read(myStaysProvider.notifier).refresh();
      },
      children: [
        if (stay != null) StayBanner(stay: stay),
        // Not taking bookings for now: the same notice as the menu's
        if (!(ref.watch(branchProvider).selectedBranch?.isReservationsEnabled ?? true))
          PausedNotice(title: l10n.reservationsPausedTitle, margin: EdgeInsets.zero),
        if (reservedSession != null) _HeldStayBanner(session: reservedSession),
        if (allBusy && reservedSession == null) const NotifyMeBanner(),
        ...roomsAsync.when(
          skipLoadingOnRefresh: true,
          loading: () => [
            for (var i = 0; i < 3; i++)
              Container(height: 176, decoration: BoxDecoration(color: c.muted, borderRadius: BorderRadius.circular(Ninja.cardRadius))),
          ],
          // A stale socket after a resume: the places known stay up while the poll catches up
          error: (_, _) => roomsAsync.hasValue
              ? [for (final room in rooms) PlaceListItem(room: room, canReserve: canReserve)]
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
          data: (rooms) => [for (final room in rooms) PlaceListItem(room: room, canReserve: canReserve)],
        ),
      ],
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

class _ActiveStayViewState extends ConsumerState<_ActiveStayView> {
  /// The request on its way out, while the tap is answered
  ServiceRequestType? _sending;

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

  /// Where one kind of request from this room stands, as its tile shows it
  ({_Phase phase, int? id, String? by}) _stateOf(ServiceRequestType type) {
    if (_sending == type) return (phase: _Phase.sending, id: null, by: null);
    final open = ref
        .watch(myRequestsProvider)
        .where((r) => r.requestType == type && r.placeId == widget.session.placeId && r.isOpen)
        .firstOrNull;
    if (open == null) return (phase: _Phase.idle, id: null, by: null);
    return open.status == ServiceRequestStatus.acknowledged
        ? (phase: _Phase.onTheWay, id: open.id, by: open.acknowledgedBy)
        : (phase: _Phase.sent, id: open.id, by: null);
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
            _QuickActionGrid(actions: _quickActions(session)),

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

  List<Widget> _openBills() {
    final bills = ref.watch(myBillsProvider).value ?? const <Bill>[];
    final orders = ref.watch(ordersProvider).orders;
    final ordersById = {for (final order in orders) order.id: order};
    final open = bills.where((b) => b.isOpen).toList();
    final pending = placeRounds(bills, orders);
    return [
      if (open.isNotEmpty) ...[
        const SizedBox(height: 20),
        BillSwipe(children: [
          for (final bill in open) BillTile(key: ValueKey(bill.id), bill: bill, ordersById: ordersById, pending: pending[bill.id] ?? const []),
        ]),
      ],
    ];
  }

  List<_QuickAction> _quickActions(Stay session) {
    final l10n = AppLocalizations.of(context)!;
    final branchId = ref.watch(selectedBranchIdProvider);
    final busy = _sending != null;
    _QuickAction ask(ServiceRequestType type, IconData icon, String label) {
      final state = _stateOf(type);
      return _QuickAction(icon: icon, label: label, phase: state.phase, by: state.by, busy: busy, onTap: () => _tap(type));
    }

    return [
      ask(ServiceRequestType.callWaiter, LucideIcons.bellRing, l10n.callWaiter),
      if (session.takesControllerRequests) ask(ServiceRequestType.controllerChange, LucideIcons.gamepad2, l10n.controller),
      ask(ServiceRequestType.receiptToPay, LucideIcons.receipt, l10n.getBill),
      // Online payments: the room's open bill, paid or split from here
      if (ref.watch(featuresProvider).onlinePayments && branchId != null)
        _QuickAction(
          icon: LucideIcons.creditCard,
          label: l10n.payTheBill,
          onTap: () => showPaySheet(context, PaySource.place(session.placeId, branchId)),
        ),
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
    final state = _stateOf(ServiceRequestType.changeOption);
    final open = state.phase != _Phase.idle && state.phase != _Phase.sending;
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
              final asked = (open || _sending == ServiceRequestType.changeOption) && option.code == _askedOption;
              final phase = asked ? state.phase : _Phase.idle;
              final name = option.name.localized(context);
              final note = switch (phase) {
                _Phase.onTheWay => l10n.ninjaStaffSwitching,
                _Phase.sent => '${l10n.sent} · ${l10n.tapToCancel}',
                _ => l10n.ninjaRateOnceSwitched(perHour(option.hourlyRate)),
              };
              // Another goes while nothing is asked; the one asked is taken back while it is only sent
              final disabled = (open && !asked) || phase == _Phase.onTheWay || _sending != null;
              const green = Color(0xFF10B981);
              final (Color fill, Color disc, Color ink) = switch (phase) {
                _Phase.onTheWay => (green.withValues(alpha: 0.15), green, Colors.white),
                _Phase.sent => (c.primary.withValues(alpha: 0.12), c.primary, c.primaryForeground),
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
                          _tap(ServiceRequestType.changeOption, optionCode: option.code);
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
                            child: phase == _Phase.sending
                                ? SizedBox(key: const ValueKey('sending'), width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: ink))
                                : Icon(
                                    switch (phase) {
                                      _Phase.onTheWay => LucideIcons.check,
                                      _Phase.sent => LucideIcons.hourglass,
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
                                phase == _Phase.idle ? l10n.switchToOption(name) : l10n.ninjaSwitchingTo(name),
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

  /// One tap on a tile: sends the request, or takes it back while it is only sent
  Future<void> _tap(ServiceRequestType type, {String? optionCode}) async {
    final state = _stateOf(type);
    if (state.phase == _Phase.idle) return _submitRequest(type, optionCode: optionCode);
    if (state.phase == _Phase.sent && state.id != null) return _cancelRequest(type, state.id!);
  }

  Future<void> _cancelRequest(ServiceRequestType type, int id) async {
    final l10n = AppLocalizations.of(context)!;
    setState(() => _sending = type);
    try {
      await ref.read(serviceRequestRepositoryProvider).cancel(id);
      ref.read(myRequestsProvider.notifier).remove(id);
      if (mounted) showIsland(context: context, title: Text(l10n.requestCancelled), icon: const Icon(LucideIcons.undo2));
    } on DioException catch (e) {
      // Too late: someone picked it up between the tile and the tap
      if (mounted) {
        showIsland(
          context: context,
          title: Text(e.response?.statusCode == 409 ? l10n.requestAlreadyPickedUp : l10n.failedToSendRequest),
          icon: Icon(e.response?.statusCode == 409 ? LucideIcons.footprints : LucideIcons.circleX),
        );
      }
    } finally {
      if (mounted) setState(() => _sending = null);
      ref.read(myRequestsProvider.notifier).refresh();
    }
  }

  Future<void> _submitRequest(ServiceRequestType type, {String? optionCode}) async {
    final session = widget.session;
    final request = CreateServiceRequest(
      placeId: session.placeId,
      placeKind: session.placeKind,
      placeName: session.placeName,
      sessionId: session.id,
      optionCode: optionCode,
      requestType: type,
    );

    setState(() => _sending = type);
    final success = await ref.read(serviceRequestProvider.notifier).submitRequest(request);
    // Seen at once, then confirmed by the server's own list
    final created = ref.read(serviceRequestProvider).lastRequest;
    if (success && created != null) ref.read(myRequestsProvider.notifier).add(created);
    ref.read(myRequestsProvider.notifier).refresh();
    if (!mounted) return;
    setState(() => _sending = null);
    if (success) {
      showIsland(
        context: context,
        title: Text(_getSuccessMessage(type)),
        icon: Icon(LucideIcons.check, color: NinjaColors.success),
      );
    } else {
      final l10n = AppLocalizations.of(context)!;
      final error = ref.read(serviceRequestProvider).error;
      showIsland(
        context: context,
        title: Text(error == 'cooldown' ? l10n.pleaseWaitBeforeRequest : l10n.failedToSendRequest),
        icon: Icon(LucideIcons.circleX, color: context.theme.colors.destructive),
      );
    }
  }

  String _getSuccessMessage(ServiceRequestType type) {
    final l10n = AppLocalizations.of(context)!;
    switch (type) {
      case ServiceRequestType.callWaiter:
        return l10n.waiterNotified;
      case ServiceRequestType.controllerChange:
        return l10n.controllerRequestSent;
      case ServiceRequestType.receiptToPay:
        return l10n.billRequestSent;
      case ServiceRequestType.switchToMulti:
        return l10n.switchToMultiRequestSent;
      case ServiceRequestType.switchToSingle:
        return l10n.switchToSingleRequestSent;
      case ServiceRequestType.changeOption:
        return l10n.switchRequestSent;
    }
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

/// Where a request stands, as its tile shows it
enum _Phase { idle, sending, sent, onTheWay }

class _QuickAction {
  final IconData icon;
  final String label;
  final _Phase phase;

  /// Who is on the way, once someone picked it up
  final String? by;

  /// Another request is on its way out
  final bool busy;
  final VoidCallback onTap;

  const _QuickAction({
    required this.icon,
    required this.label,
    this.phase = _Phase.idle,
    this.by,
    this.busy = false,
    required this.onTap,
  });
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

/// Two tiles a row, however many the place can take
class _QuickActionGrid extends StatelessWidget {
  final List<_QuickAction> actions;

  const _QuickActionGrid({required this.actions});

  @override
  Widget build(BuildContext context) {
    final rows = <Widget>[];
    for (var i = 0; i < actions.length; i += 2) {
      final pair = actions.skip(i).take(2).toList();
      rows.add(Row(
        children: [
          for (var j = 0; j < pair.length; j++) ...[
            if (j > 0) const SizedBox(width: 12),
            Expanded(
              child: _QuickActionButton(action: pair[j]),
            ),
          ],
          if (pair.length == 1) ...[
            const SizedBox(width: 12),
            const Expanded(child: SizedBox.shrink()),
          ],
        ],
      ));
      if (i + 2 < actions.length) rows.add(const SizedBox(height: 12));
    }
    return Column(children: rows);
  }
}

/// One thing to ask the staff for, as a tile that is also its status
/// (client_web's request-tile.tsx): tap to send, tap again to take it back
/// while it is only sent, then on the way (with who is coming) once the
/// staff pick it up. The open request is the cooldown; the tile says so.
class _QuickActionButton extends StatelessWidget {
  final _QuickAction action;

  const _QuickActionButton({required this.action});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final theme = context.theme;
    final c = theme.colors;
    final phase = action.phase;
    final disabled = action.busy || phase == _Phase.sending || phase == _Phase.onTheWay;
    const green = Color(0xFF10B981);
    final (Color fill, Color disc, Color ink) = switch (phase) {
      _Phase.onTheWay => (green.withValues(alpha: 0.15), green, Colors.white),
      _Phase.sent => (c.primary.withValues(alpha: 0.12), c.primary, c.primaryForeground),
      _ => (c.muted, c.background, c.foreground),
    };
    final note = switch (phase) {
      _Phase.sent => l10n.sent,
      _Phase.onTheWay => action.by != null && action.by!.isNotEmpty ? l10n.onTheWayBy(action.by!) : l10n.onTheWay,
      _ => null,
    };
    final caption = context.localeText(theme.typography.caption.copyWith(color: c.mutedForeground));
    return Pressable(
      onTap: disabled ? null : action.onTap,
      scale: 0.97,
      child: AnimatedContainer(
        duration: Motion.slow,
        constraints: const BoxConstraints(minHeight: 96),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: fill, borderRadius: BorderRadius.circular(Ninja.panelRadius)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AnimatedContainer(
              duration: Motion.slow,
              width: 40,
              height: 40,
              decoration: BoxDecoration(color: disc, shape: BoxShape.circle),
              child: BlurSwap(
                alignment: Alignment.center,
                child: phase == _Phase.sending
                    ? SizedBox(key: const ValueKey('sending'), width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: ink))
                    : Icon(
                        switch (phase) {
                          _Phase.sent => LucideIcons.hourglass,
                          _Phase.onTheWay => LucideIcons.check,
                          _ => action.icon,
                        },
                        key: ValueKey(phase),
                        size: 20,
                        color: ink,
                      ),
              ),
            ),
            const SizedBox(height: 12),
            Text(action.label, style: context.localeText(theme.typography.note.copyWith(fontWeight: FontWeight.w600, color: c.foreground, height: 1.3))),
            // A third of a phone is narrow: the status wraps, and the way to take it back is a size down
            BlurSwap(
              child: note == null
                  ? const SizedBox.shrink(key: ValueKey('none'))
                  : Column(
                      key: ValueKey(note),
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(note, style: caption),
                        if (phase == _Phase.sent) Text(l10n.tapToCancel, style: caption.copyWith(fontSize: 11)),
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Reserved session banner - matches active session card style
class _HeldStayBanner extends ConsumerWidget {
  final Reservation session;

  const _HeldStayBanner({required this.session});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            NinjaColors.warning,
            NinjaColors.warning.withValues(alpha: 0.85),
          ],
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: NinjaColors.warning.withValues(alpha: 0.3),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        children: [
          // Place name
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Icon(session.placeKind.icon, color: Colors.white, size: 24),
              const SizedBox(width: 8),
              AppText(
                session.placeName.localized(context),
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          // Status badge
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(20),
            ),
            child: AppText(
              AppLocalizations.of(context)!.reserved,
              style: TextStyle(
                color: Colors.white,
                fontSize: 12,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          const SizedBox(height: 16),
          // Date and time
          AppText(
            DateFormat('EEEE, MMM d', Localizations.localeOf(context).languageCode).format(session.reservationTime.toLocal()),
            style: TextStyle(
              color: Colors.white,
              fontSize: 16,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 4),
          AppText(
            DateFormat('h:mm a', Localizations.localeOf(context).languageCode).format(session.reservationTime.toLocal()),
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.8),
              fontSize: 24,
              fontWeight: FontWeight.bold,
            ),
          ),
          if (session.startOnConfirm) ...[
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(LucideIcons.timerReset, color: Colors.white.withValues(alpha: 0.9), size: 14),
                const SizedBox(width: 6),
                AppText(
                  AppLocalizations.of(context)!.timeStartsOnConfirm,
                  style: TextStyle(color: Colors.white.withValues(alpha: 0.9), fontSize: 13),
                ),
                if (session.requestedOptionName != null) ...[
                  const SizedBox(width: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: AppText(
                      session.requestedOptionName!.localized(context),
                      style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w500),
                    ),
                  ),
                ],
              ],
            ),
          ],
          const SizedBox(height: 16),
          // Cancel link
          GestureDetector(
            onTap: () => _cancelReservation(context, ref),
            child: AppText(
              AppLocalizations.of(context)!.cancelReservation,
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.9),
                fontSize: 13,
                decoration: TextDecoration.underline,
                decorationColor: Colors.white.withValues(alpha: 0.9),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _cancelReservation(BuildContext context, WidgetRef ref) async {
    final l10n = AppLocalizations.of(context)!;
    final confirmed = await showNinjaSheet<bool>(
      context: context,
      builder: (context) => NinjaDialog(
        title: Text(l10n.cancelReservationQuestion),
        actions: [
          NinjaButton(
            variant: NinjaButtonVariant.secondary,
            onPress: () => Navigator.pop(context, false),
            child: Text(l10n.cancel),
          ),
          NinjaButton(
            variant: NinjaButtonVariant.destructive,
            onPress: () => Navigator.pop(context, true),
            child: Text(l10n.cancelReservation),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      try {
        final service = ref.read(placeRepositoryProvider);
        await service.cancelHold(session.id);
        ref.read(myStaysProvider.notifier).refresh();
        final branchId = ref.read(selectedBranchIdProvider);
        if (branchId != null) ref.invalidate(placesProvider(branchId));
        if (context.mounted) {
          showIsland(
            context: context,
            title: Text(l10n.reservationCancelled),
            icon: Icon(LucideIcons.check, color: NinjaColors.success),
          );
        }
      } catch (e) {
        if (context.mounted) {
          showIsland(
            context: context,
            title: Text(l10n.failedToCancelReservation),
            icon: Icon(LucideIcons.circleX, color: context.theme.colors.destructive),
          );
        }
      }
    }
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

  const PlaceListItem({
    super.key,
    required this.room,
    this.canReserve = true,
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
        final statusColor = free ? const Color(0xFF6EE7B7) : _getStatusColor(c);
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
                          color: free ? const Color(0x3334D399) : c.muted,
                          shape: const StadiumBorder(),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(width: 6, height: 6, decoration: BoxDecoration(color: free ? NinjaColors.success : statusColor, shape: BoxShape.circle)),
                            const SizedBox(width: 6),
                            Text(
                              _getLocalizedStatus(context, room.displayStatus),
                              style: context.localeText(theme.typography.caption.copyWith(fontWeight: FontWeight.w700, color: statusColor)),
                            ),
                          ],
                        ),
                      ),
                      const Spacer(),
                      if (tappable)
                        Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(color: c.foreground, shape: BoxShape.circle),
                          child: Icon(LucideIcons.plus, size: 20, color: c.background),
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
    return Pressable(
      onTap: tappable ? () => _showReservationDialog(context, ref) : null,
      scale: 0.98,
      child: Container(
        clipBehavior: Clip.antiAlias,
        padding: const EdgeInsets.all(20),
        decoration: free
            ? BoxDecoration(color: theme.colors.slab, borderRadius: BorderRadius.circular(Ninja.cardRadius), boxShadow: Ninja.slabShadow)
            : theme.surface(radius: Ninja.cardRadius),
        child: free ? SlabInk(child: face) : face,
      ),
    );
  }

  Color _getStatusColor(dynamic colors) {
    switch (room.displayStatus) {
      case PlaceStatus.available:
        return canReserve ? NinjaColors.success : colors.mutedForeground;
      case PlaceStatus.occupied:
        return colors.destructive;
      case PlaceStatus.reserved:
        return NinjaColors.warning;
      case PlaceStatus.maintenance:
        return colors.mutedForeground;
    }
  }

  String _getLocalizedStatus(BuildContext context, PlaceStatus status) {
    final l10n = AppLocalizations.of(context)!;
    switch (status) {
      case PlaceStatus.available:
        return l10n.available;
      case PlaceStatus.occupied:
        return l10n.occupied;
      case PlaceStatus.reserved:
        return l10n.reserved;
      case PlaceStatus.maintenance:
        return l10n.maintenance;
    }
  }

  void _showReservationDialog(BuildContext context, WidgetRef ref) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useRootNavigator: true,
      backgroundColor: Colors.transparent,
      builder: (context) => HoldSheet(room: room),
    );
  }
}

/// Reservation bottom sheet - immediate reservation with 15 min arrival window
class HoldSheet extends ConsumerStatefulWidget {
  final Place room;

  const HoldSheet({super.key, required this.room});

  @override
  ConsumerState<HoldSheet> createState() => _HoldSheetState();
}

class _HoldSheetState extends ConsumerState<HoldSheet> {
  bool _isLoading = false;
  bool _startOnConfirm = false;

  /// The rate the clock starts at when it starts on Confirm: the tariff's
  /// first option until the customer picks another
  String? _optionCode;

  bool get _pickRate => _startOnConfirm && widget.room.hasOptions;
  String? get _chosenCode =>
      _optionCode ?? (widget.room.options.isNotEmpty ? widget.room.options.first.code : null);

  @override
  Widget build(BuildContext context) {
    final colors = context.theme.colors;
    final l10n = AppLocalizations.of(context)!;
    return Container(
      decoration: BoxDecoration(
        color: colors.background,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Handle
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: colors.mutedForeground,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 20),

              // Title
              Row(
                children: [
                  Expanded(
                    child: AppText(
                      l10n.reserveRoomName(widget.room.name.localized(context)),
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 20,
                        color: colors.foreground,
                      ),
                    ),
                  ),
                  GestureDetector(
                    onTap: () => Navigator.pop(context),
                    child: Icon(LucideIcons.x, size: 24, color: colors.mutedForeground),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              AppText(
                tariffLine(context, ref.watch(moneyProvider), widget.room.options),
                style: TextStyle(
                  color: colors.mutedForeground,
                  fontSize: 14,
                ),
              ),
              // Place description
              if (widget.room.description != null) ...[
                const SizedBox(height: 12),
                AppText(
                  widget.room.description!.localized(context),
                  style: TextStyle(
                    color: colors.foreground,
                    fontSize: 14,
                  ),
                ),
              ],
              const SizedBox(height: 24),

              // Info box
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: colors.primary.withValues(alpha: 0.1),
                  border: Border.all(color: colors.primary.withValues(alpha: 0.3)),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    Icon(LucideIcons.clock, size: 24, color: colors.primary),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          AppText(
                            l10n.fifteenMinutesToArrive,
                            style: TextStyle(
                              fontWeight: FontWeight.w600,
                              fontSize: 15,
                              color: colors.foreground,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),

              // The clock starts the moment the counter confirms the
              // reservation, instead of waiting for the cashier to start it.
              // A plain row, not a card: it is one setting of the
              // reservation, not a thing of its own. A table with no clock
              // has nothing to start
              if (widget.room.isTimed)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
                  child: Row(
                    children: [
                      Expanded(
                        child: AppText(
                          l10n.startTimeNow,
                          style: TextStyle(
                            fontWeight: FontWeight.w500,
                            fontSize: 15,
                            color: colors.foreground,
                          ),
                        ),
                      ),
                      NinjaSwitch(
                        value: _startOnConfirm,
                        onChange: (value) => setState(() => _startOnConfirm = value),
                      ),
                    ],
                  ),
                ),

              // Which rate the clock starts at, where the tariff has a choice:
              // the customer picks here, so the till confirms without asking
              if (_pickRate) ...[
                const SizedBox(height: 4),
                Row(
                  children: [
                    for (final (index, option) in widget.room.options.indexed) ...[
                      if (index > 0) const SizedBox(width: 8),
                      Expanded(
                        child: _RateChoice(
                          option: option,
                          selected: option.code == _chosenCode,
                          upgrade: index > 0,
                          onTap: () => setState(() => _optionCode = option.code),
                        ),
                      ),
                    ],
                  ],
                ),
              ],
              const SizedBox(height: 24),

              // Reserve button
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _isLoading ? null : _handleReserve,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: colors.primary,
                    foregroundColor: colors.primaryForeground,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: const StadiumBorder(),
                  ),
                  child: _isLoading
                      ? SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                            color: colors.primaryForeground,
                            strokeWidth: 2,
                          ),
                        )
                      : AppText(
                          l10n.reserveNow,
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 15,
                          ),
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _handleReserve() async {
    // Ensure user has name + phone before reserving
    if (!await ensureProfileComplete(context, ref)) return;
    if (!mounted) return;

    final l10n = AppLocalizations.of(context)!;
    setState(() => _isLoading = true);

    final success = await ref.read(holdProvider.notifier).holdPlace(
          widget.room.id,
          startOnConfirm: _startOnConfirm,
          optionCode: _pickRate ? _chosenCode : null,
        );

    setState(() => _isLoading = false);

    if (success && mounted) {
      Navigator.pop(context);
      final branchId = ref.read(selectedBranchIdProvider);
      if (branchId != null) ref.invalidate(placesProvider(branchId));
      ref.read(myStaysProvider.notifier).refresh();
      SoundService.instance.playSuccess();
      showIsland(
        context: context,
        title: Text(l10n.roomReservedSuccess),
        icon: Icon(LucideIcons.check, color: NinjaColors.success),
      );
    } else if (mounted) {
      showIsland(
        context: context,
        title: Text(l10n.failedToReserveRoom),
        icon: Icon(LucideIcons.circleX, color: context.theme.colors.destructive),
      );
    }
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

/// One rate to start at, as a tile: the option's dot in its colour, its
/// name, its price. The first option reads as the base rate, the second as
/// the upgrade, the way Single and Multi always did.
class _RateChoice extends ConsumerWidget {
  final RateOption option;
  final bool selected;
  final bool upgrade;
  final VoidCallback onTap;

  const _RateChoice({
    required this.option,
    required this.selected,
    required this.upgrade,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.theme.colors;
    final l10n = AppLocalizations.of(context)!;
    final dot = upgrade ? Colors.orange : colors.primary;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: selected ? colors.primary.withValues(alpha: 0.05) : null,
          border: Border.all(color: selected ? colors.primary : colors.border),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(color: dot, shape: BoxShape.circle),
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: AppText(
                    option.name.localized(context),
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: colors.foreground),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 2),
            AppText(
              l10n.hourlyRateFormat(ref.watch(moneyProvider).whole(option.hourlyRate)),
              style: TextStyle(fontSize: 12, color: colors.mutedForeground),
            ),
          ],
        ),
      ),
    );
  }
}

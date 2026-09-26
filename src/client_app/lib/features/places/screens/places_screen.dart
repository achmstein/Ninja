import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:forui/forui.dart';
import 'package:intl/intl.dart';
import '../../../core/models/localized_text.dart';
import '../../../core/providers/locale_provider.dart';
import '../../../core/auth/auth_service.dart';
import '../../../core/theme/app_theme.dart';
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
    final colors = context.theme.colors;
    final branchId = ref.watch(selectedBranchIdProvider);
    if (branchId == null) {
      return Center(child: CircularProgressIndicator(color: colors.primary));
    }
    final roomsAsync = ref.watch(placesProvider(branchId));
    final sessionsAsync = ref.watch(myStaysProvider);
    // The customer's open reservation, once the list has answered; until
    // then none, so the rooms show rather than wait on it
    final reservedSession = openReservationOf(ref.watch(myReservationsProvider).value ?? const []);
    final l10n = AppLocalizations.of(context)!;
    final isReservationsEnabled = ref.watch(branchProvider).selectedBranch?.isReservationsEnabled ?? true;

    return Scaffold(
      backgroundColor: Colors.transparent,
      resizeToAvoidBottomInset: false,
      body: Column(
        children: [
          // Header
          FHeader(
            title: AppText(placesTabLabel(l10n, ref.watch(myStaysProvider).value ?? const []), style: TextStyle(fontSize: 18)),
            suffixes: [
              // Scanning moved to the Menu header: a scanned code may be a
              // room or a table, so it does not belong under Rooms.
              FHeaderAction(
                icon: const Icon(FIcons.history, size: 20),
                onPress: () => context.push('/stays'),
              ),
            ],
          ),

          // Reservations disabled banner
          if (!isReservationsEnabled)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              color: colors.destructive.withValues(alpha: 0.1),
              child: Row(
                children: [
                  Icon(FIcons.circleAlert, size: 16, color: colors.destructive),
                  const SizedBox(width: 8),
                  Expanded(
                    child: AppText(
                      l10n.reservationsUnavailable,
                      style: TextStyle(fontSize: 13, color: colors.destructive),
                    ),
                  ),
                ],
              ),
            ),

          // Content
          Expanded(
            child: sessionsAsync.when(
              skipLoadingOnRefresh: true,
              loading: () => Center(child: CircularProgressIndicator(color: colors.primary)),
              error: (_, _) => _buildRoomsList(context, roomsAsync, null, null),
              data: (sessions) {
                final activeSession = sessions
                    .where((s) => s.status == StayStatus.active)
                    .firstOrNull;

                // If user has active session, show session view
                if (activeSession != null) {
                  return _ActiveStayView(session: activeSession);
                }

                // If user has a reservation, show it above the rooms
                return _buildRoomsList(context, roomsAsync, reservedSession, null);
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRoomsList(
    BuildContext context,
    AsyncValue<List<Place>> roomsAsync,
    Reservation? reservedSession,
    Stay? activeSession,
  ) {
    final branchId = ref.read(selectedBranchIdProvider)!;

    // If error but we have previous data (e.g. stale socket after app resume),
    // keep showing the cached rooms instead of flashing an error
    return roomsAsync.when(
      skipLoadingOnRefresh: true,
      loading: () => Center(child: CircularProgressIndicator(color: context.theme.colors.primary)),
      error: (error, _) {
        // Previous data still available — show it, polling will refresh
        if (roomsAsync.hasValue) {
          return _buildRoomsContent(context, roomsAsync.value!, reservedSession, activeSession);
        }
        return Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(FIcons.circleAlert, size: 48, color: context.theme.colors.mutedForeground),
              const SizedBox(height: 16),
              AppText(AppLocalizations.of(context)!.failedToLoadRooms),
              const SizedBox(height: 16),
              FButton(
                onPress: () => ref.refresh(placesProvider(branchId)),
                child: Text(AppLocalizations.of(context)!.retry),
              ),
            ],
          ),
        );
      },
      data: (rooms) => _buildRoomsContent(context, rooms, reservedSession, activeSession),
    );
  }

  Widget _buildRoomsContent(
    BuildContext context,
    List<Place> rooms,
    Reservation? reservedSession,
    Stay? activeSession,
  ) {
    final branchId = ref.read(selectedBranchIdProvider)!;
    final colors = context.theme.colors;
    final allUnavailable = rooms.isNotEmpty &&
        rooms.every((r) => !r.canBookNow);
    // Only show notify banner if all rooms unavailable AND user has no reservation
    final showNotifyBanner = allUnavailable && reservedSession == null;

    return RefreshIndicator(
      color: colors.primary,
      backgroundColor: colors.background,
      onRefresh: () async {
        ref.invalidate(placesProvider(branchId));
        await ref.read(myStaysProvider.notifier).refresh();
      },
      child: ListView.builder(
        controller: _scrollController,
        padding: const EdgeInsets.symmetric(vertical: 8),
        itemCount: _getItemCount(rooms, reservedSession, showNotifyBanner),
        itemBuilder: (context, index) {
          int currentIndex = index;

          // Reserved session banner (always first if exists)
          if (reservedSession != null && currentIndex == 0) {
            return Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
              child: _HeldStayBanner(session: reservedSession),
            );
          }
          if (reservedSession != null) currentIndex--;

          // Notify me banner (if all rooms unavailable and no reservation)
          if (showNotifyBanner && currentIndex == 0) {
            return const Padding(
              padding: EdgeInsets.fromLTRB(16, 8, 16, 16),
              child: NotifyMeBanner(),
            );
          }
          if (showNotifyBanner) currentIndex--;

          // Place items
          final room = rooms[currentIndex];
          return Column(
            children: [
              PlaceListItem(
                room: room,
                canReserve: reservedSession == null &&
                    ref.watch(featuresProvider).reservations &&
                    (ref.read(branchProvider).selectedBranch?.isReservationsEnabled ?? true),
              ),
              if (currentIndex < rooms.length - 1)
                Divider(
                  height: 1,
                  indent: 16,
                  endIndent: 16,
                  color: context.theme.colors.border,
                ),
            ],
          );
        },
      ),
    );
  }

  int _getItemCount(List<Place> rooms, Reservation? reservedSession, bool showNotifyBanner) {
    int count = rooms.length;
    if (reservedSession != null) count++;
    if (showNotifyBanner) count++;
    return count;
  }
}

/// Active session view - shown when user is currently playing
class _ActiveStayView extends ConsumerStatefulWidget {
  final Stay session;

  const _ActiveStayView({required this.session});

  @override
  ConsumerState<_ActiveStayView> createState() => _ActiveStayViewState();
}

class _ActiveStayViewState extends ConsumerState<_ActiveStayView> {
  Timer? _timer;
  static const _cooldownDuration = 30; // seconds

  // Track cooldown end times for each request type
  final Map<ServiceRequestType, DateTime> _cooldownEndTimes = {};

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  /// Get remaining cooldown seconds for a request type
  int _getCooldownRemaining(ServiceRequestType type) {
    final endTime = _cooldownEndTimes[type];
    if (endTime == null) return 0;

    final remaining = endTime.difference(DateTime.now()).inSeconds;
    return remaining > 0 ? remaining : 0;
  }

  /// Start cooldown for a request type
  void _startCooldown(ServiceRequestType type) {
    _cooldownEndTimes[type] = DateTime.now().add(const Duration(seconds: _cooldownDuration));
  }

  @override
  Widget build(BuildContext context) {
    final session = widget.session;

    final colors = context.theme.colors;

    return RefreshIndicator(
      color: colors.primary,
      backgroundColor: colors.background,
      onRefresh: () => ref.read(myStaysProvider.notifier).refresh(),
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            // Main session card
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    context.theme.colors.primary,
                    context.theme.colors.primary.withValues(alpha: 0.8),
                  ],
                ),
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(
                    color: context.theme.colors.primary.withValues(alpha: 0.3),
                    blurRadius: 20,
                    offset: const Offset(0, 10),
                  ),
                ],
              ),
              child: Column(
                children: [
                  // Place name + player mode in one row
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      AppText(
                        session.placeName.localized(context),
                        style: TextStyle(
                          color: colors.primaryForeground,
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      if (session.hasOptions && session.currentOptionName != null) ...[
                        const SizedBox(width: 10),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: colors.primaryForeground.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: colors.primaryForeground.withValues(alpha: 0.3)),
                          ),
                          child: AppText(
                            session.currentOptionName!.localized(context),
                            style: TextStyle(
                              color: colors.primaryForeground,
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),

                  const SizedBox(height: 24),

                  // Timer
                  AppText(
                    session.formattedDuration,
                    style: TextStyle(
                      color: colors.primaryForeground,
                      fontSize: 40,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 2,
                    ),
                  ),

                  // Price per hour, at the rate running now
                  if (session.currentHourlyRate != null) ...[
                    const SizedBox(height: 8),
                    AppText(
                      AppLocalizations.of(context)!.hourlyRateFormat(
                        ref.watch(moneyProvider).whole(session.currentHourlyRate!),
                      ),
                      style: TextStyle(
                        color: colors.primaryForeground.withValues(alpha: 0.7),
                        fontSize: 14,
                      ),
                    ),
                  ],
                ],
              ),
            ),

            const SizedBox(height: 24),

            // Quick actions
            const SizedBox(height: 16),

            // What the place can take: a waiter and the bill anywhere, a
            // controller in a console room, a switch per other rate option
            _QuickActionGrid(actions: _quickActions(session)),

            // Leave session button (non-owners only)
            if (session.customerId != null &&
                session.customerId != ref.read(authServiceProvider).userId) ...[
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: FButton(
                  variant: FButtonVariant.outline,
                  onPress: () => _confirmLeaveSession(session.id),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(FIcons.logOut, size: 16),
                      const SizedBox(width: 8),
                      Text(AppLocalizations.of(context)!.leaveSession),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  List<_QuickAction> _quickActions(Stay session) {
    final l10n = AppLocalizations.of(context)!;
    final branchId = ref.watch(selectedBranchIdProvider);
    return [
      _QuickAction(
        icon: FIcons.bellRing,
        label: l10n.callWaiter,
        cooldownSeconds: _getCooldownRemaining(ServiceRequestType.callWaiter),
        onTap: () => _submitRequest(ServiceRequestType.callWaiter),
      ),
      if (session.takesControllerRequests)
        _QuickAction(
          icon: FIcons.gamepad2,
          label: l10n.controller,
          cooldownSeconds: _getCooldownRemaining(ServiceRequestType.controllerChange),
          onTap: () => _submitRequest(ServiceRequestType.controllerChange),
        ),
      _QuickAction(
        icon: FIcons.receipt,
        label: l10n.getBill,
        cooldownSeconds: _getCooldownRemaining(ServiceRequestType.receiptToPay),
        onTap: () => _submitRequest(ServiceRequestType.receiptToPay),
      ),
      // Pay at table: the room's open bill, paid or split from here
      if (ref.watch(featuresProvider).payAtTable && branchId != null)
        _QuickAction(
          icon: FIcons.creditCard,
          label: l10n.payTheBill,
          cooldownSeconds: 0,
          onTap: () => showPaySheet(context, PaySource.place(session.placeId, branchId)),
        ),
      if (session.hasOptions)
        for (final option in session.options.where((o) => o.code != session.currentOptionCode))
          _QuickAction(
            icon: FIcons.refreshCw,
            label: l10n.switchToOption(option.name.localized(context)),
            cooldownSeconds: _getCooldownRemaining(ServiceRequestType.changeOption),
            onTap: () => _submitRequest(ServiceRequestType.changeOption, optionCode: option.code),
          ),
    ];
  }

  Future<void> _submitRequest(ServiceRequestType type, {String? optionCode}) async {
    // Check if still in cooldown
    if (_getCooldownRemaining(type) > 0) return;

    final session = widget.session;
    final request = CreateServiceRequest(
      placeId: session.placeId,
      placeKind: session.placeKind,
      placeName: session.placeName,
      sessionId: session.id,
      optionCode: optionCode,
      requestType: type,
    );

    final success = await ref.read(serviceRequestProvider.notifier).submitRequest(request);

    if (mounted) {
      if (success) {
        // Start cooldown on success
        _startCooldown(type);
        showFToast(
          context: context,
          title: Text(_getSuccessMessage(type)),
          icon: Icon(FIcons.check, color: AppTheme.successColor),
        );
      } else {
        final l10n = AppLocalizations.of(context)!;
        final error = ref.read(serviceRequestProvider).error;
        final errorMessage = error == 'cooldown'
            ? l10n.pleaseWaitBeforeRequest
            : l10n.failedToSendRequest;
        showFToast(
          context: context,
          title: Text(errorMessage),
          icon: Icon(FIcons.circleX, color: context.theme.colors.destructive),
        );
      }
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

    showFDialog(
      context: context,
      builder: (dialogContext, style, animation) => FDialog(
        style: style,
        animation: animation,
        title: AppText(l10n.leaveRoomQuestion),
        actions: [
          FButton(
            variant: FButtonVariant.outline,
            onPress: () => Navigator.pop(dialogContext),
            child: AppText(l10n.cancel),
          ),
          FButton(
            variant: FButtonVariant.destructive,
            onPress: () async {
              Navigator.pop(dialogContext);
              try {
                await ref.read(placeRepositoryProvider).leaveStay(sessionId);
                if (!mounted) return;

                ref.read(myStaysProvider.notifier).refresh();
                final branchId = ref.read(selectedBranchIdProvider);
                if (branchId != null) ref.invalidate(placesProvider(branchId));

                showFToast(
                  context: context,
                  title: Text(l10n.leftSession),
                  icon: Icon(FIcons.check, color: AppTheme.successColor),
                );
              } catch (e) {
                if (mounted) {
                  showFToast(
                    context: context,
                    title: Text(l10n.failedToLeaveSession),
                    icon: Icon(FIcons.circleX, color: context.theme.colors.destructive),
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

class _QuickAction {
  final IconData icon;
  final String label;
  final int cooldownSeconds;
  final VoidCallback onTap;

  const _QuickAction({
    required this.icon,
    required this.label,
    required this.cooldownSeconds,
    required this.onTap,
  });
}

/// Two buttons a row, however many the place can take
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
              child: _QuickActionButton(
                icon: pair[j].icon,
                label: pair[j].label,
                cooldownSeconds: pair[j].cooldownSeconds,
                onTap: pair[j].onTap,
              ),
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

class _QuickActionButton extends StatefulWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final int cooldownSeconds;

  const _QuickActionButton({
    required this.icon,
    required this.label,
    required this.onTap,
    this.cooldownSeconds = 0,
  });

  @override
  State<_QuickActionButton> createState() => _QuickActionButtonState();
}

class _QuickActionButtonState extends State<_QuickActionButton> {
  bool _isPressed = false;

  bool get _isInCooldown => widget.cooldownSeconds > 0;

  @override
  Widget build(BuildContext context) {
    final colors = context.theme.colors;
    return GestureDetector(
      onTapDown: _isInCooldown ? null : (_) => setState(() => _isPressed = true),
      onTapUp: _isInCooldown ? null : (_) => setState(() => _isPressed = false),
      onTapCancel: _isInCooldown ? null : () => setState(() => _isPressed = false),
      onTap: _isInCooldown ? null : widget.onTap,
      child: AnimatedScale(
        scale: _isPressed ? 0.92 : 1.0,
        duration: const Duration(milliseconds: 100),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 100),
          padding: const EdgeInsets.symmetric(vertical: 16),
          decoration: BoxDecoration(
            color: _isInCooldown
                ? colors.mutedForeground.withValues(alpha: 0.15)
                : _isPressed
                    ? colors.primary.withValues(alpha: 0.15)
                    : colors.mutedForeground.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: _isPressed && !_isInCooldown
                  ? colors.primary.withValues(alpha: 0.3)
                  : Colors.transparent,
              width: 1.5,
            ),
          ),
          child: Column(
            children: [
              if (_isInCooldown) ...[
                // Show countdown
                AppText(
                  AppLocalizations.of(context)!.secondsShort(widget.cooldownSeconds),
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: colors.mutedForeground,
                  ),
                ),
                const SizedBox(height: 4),
                AppText(
                  widget.label,
                  style: TextStyle(
                    fontSize: 11,
                    color: colors.mutedForeground,
                  ),
                ),
              ] else ...[
                Icon(widget.icon, size: 24, color: colors.foreground),
                const SizedBox(height: 8),
                AppText(
                  widget.label,
                  style: TextStyle(
                    fontSize: 12,
                    color: colors.mutedForeground,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ],
          ),
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
            AppTheme.warningColor,
            AppTheme.warningColor.withValues(alpha: 0.85),
          ],
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: AppTheme.warningColor.withValues(alpha: 0.3),
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
                Icon(FIcons.timerReset, color: Colors.white.withValues(alpha: 0.9), size: 14),
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
    final confirmed = await showAdaptiveDialog<bool>(
      context: context,
      builder: (context) => FDialog(
        direction: Axis.horizontal,
        title: Text(l10n.cancelReservationQuestion),
        actions: [
          FButton(
            variant: FButtonVariant.outline,
            onPress: () => Navigator.pop(context, false),
            child: Text(l10n.cancel),
          ),
          FButton(
            variant: FButtonVariant.destructive,
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
          showFToast(
            context: context,
            title: Text(l10n.reservationCancelled),
            icon: Icon(FIcons.check, color: AppTheme.successColor),
          );
        }
      } catch (e) {
        if (context.mounted) {
          showFToast(
            context: context,
            title: Text(l10n.failedToCancelReservation),
            icon: Icon(FIcons.circleX, color: context.theme.colors.destructive),
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
          Icon(FIcons.bell, size: 24, color: context.theme.colors.foreground),
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
              icon: Icon(FIcons.refreshCw, color: context.theme.colors.destructive),
            ),
            data: (isSubscribed) => FSwitch(
              value: isSubscribed,
              onChange: (value) async {
                final repo = ref.read(notificationRepositoryProvider);
                if (value) {
                  final success = await repo.subscribeToRoomAvailability(
                    preferredLanguage: locale.languageCode,
                  );
                  ref.invalidate(roomAvailabilitySubscriptionProvider);
                  if (context.mounted) {
                    showFToast(
                      context: context,
                      title: Text(success ? l10n.youWillBeNotified : l10n.failedToSubscribe),
                      icon: Icon(
                        success ? FIcons.bell : FIcons.circleX,
                        color: success ? AppTheme.successColor : context.theme.colors.destructive,
                      ),
                    );
                  }
                } else {
                  await repo.unsubscribeFromRoomAvailability();
                  ref.invalidate(roomAvailabilitySubscriptionProvider);
                  if (context.mounted) {
                    showFToast(
                      context: context,
                      title: Text(l10n.unsubscribedFromNotifications),
                      icon: Icon(FIcons.check, color: context.theme.colors.mutedForeground),
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
    final colors = context.theme.colors;
    final isAvailable = room.canBookNow && canReserve;
    final statusColor = _getStatusColor(colors);
    final rate = tariffLine(context, ref.watch(moneyProvider), room.options);

    return GestureDetector(
      onTap: isAvailable ? () => _showReservationDialog(context, ref) : null,
      behavior: HitTestBehavior.opaque,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            // Gamepad icon
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: isAvailable
                    ? colors.primary.withValues(alpha: 0.1)
                    : colors.mutedForeground.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(
                room.kind.icon,
                size: 28,
                color: isAvailable ? colors.primary : colors.mutedForeground,
              ),
            ),
            const SizedBox(width: 12),

            // Place info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  AppText(
                    room.name.localized(context),
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 15,
                      color: colors.foreground,
                    ),
                  ),
                  if (room.description != null) ...[
                    const SizedBox(height: 4),
                    AppText(
                      room.description!.localized(context),
                      style: TextStyle(
                        color: colors.mutedForeground,
                        fontSize: 13,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      // A plain table has no rate: the status then starts the line, with no gap or bullet before it
                      if (rate.isNotEmpty) ...[
                        Flexible(
                          child: AppText(
                            rate,
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                              color: colors.foreground,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                      ],
                      AppText(
                        rate.isEmpty
                            ? _getLocalizedStatus(context, room.displayStatus)
                            : '• ${_getLocalizedStatus(context, room.displayStatus)}',
                        style: TextStyle(
                          color: statusColor,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            // Action - only show calendar button if room is available and user can reserve
            if (isAvailable)
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: colors.primary,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Icon(
                  FIcons.calendarPlus,
                  color: colors.primaryForeground,
                  size: 18,
                ),
              ),
          ],
        ),
      ),
    );
  }

  Color _getStatusColor(dynamic colors) {
    switch (room.displayStatus) {
      case PlaceStatus.available:
        return canReserve ? AppTheme.successColor : colors.mutedForeground;
      case PlaceStatus.occupied:
        return colors.destructive;
      case PlaceStatus.reserved:
        return AppTheme.warningColor;
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
                    child: Icon(FIcons.x, size: 24, color: colors.mutedForeground),
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
                    Icon(FIcons.clock, size: 24, color: colors.primary),
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
                      FSwitch(
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
      showFToast(
        context: context,
        title: Text(l10n.roomReservedSuccess),
        icon: Icon(FIcons.check, color: AppTheme.successColor),
      );
    } else if (mounted) {
      showFToast(
        context: context,
        title: Text(l10n.failedToReserveRoom),
        icon: Icon(FIcons.circleX, color: context.theme.colors.destructive),
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

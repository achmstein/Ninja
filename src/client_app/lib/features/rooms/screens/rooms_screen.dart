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
import '../../../core/providers/branch_provider.dart';
import '../../../core/widgets/main_scaffold.dart';
import '../../notifications/services/notification_service.dart';
import '../../service_request/models/service_request.dart';
import '../../service_request/services/service_request_service.dart';
import '../models/room.dart';
import '../../../core/services/signalr_service.dart';
import '../services/room_service.dart';
import '../../../core/services/sound_service.dart';

/// Rooms screen for viewing and reserving PlayStation rooms
class RoomsScreen extends ConsumerStatefulWidget {
  const RoomsScreen({super.key});

  @override
  ConsumerState<RoomsScreen> createState() => _RoomsScreenState();
}

class _RoomsScreenState extends ConsumerState<RoomsScreen> with WidgetsBindingObserver {
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
      if (next == '/rooms' && previous != '/rooms') {
        ref.read(mySessionsProvider.notifier).refresh();
        final branchId = ref.read(selectedBranchIdProvider);
        if (branchId != null) ref.invalidate(roomsProvider(branchId));
        _startPolling();
      } else if (previous == '/rooms' && next != '/rooms') {
        _stopPolling();
      }
    });

    _startPolling();

    // Scroll to top when a new reservation appears
    ref.listenManual(mySessionsProvider, (previous, next) {
      final hadReserved = previous?.value?.any((s) => s.status == SessionStatus.reserved) ?? false;
      final hasReserved = next.value?.any((s) => s.status == SessionStatus.reserved) ?? false;
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
      ref.read(mySessionsProvider.notifier).refresh();
      final branchId = ref.read(selectedBranchIdProvider);
      if (branchId != null) ref.invalidate(roomsProvider(branchId));
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
      ref.read(mySessionsProvider.notifier).refresh();
      final branchId = ref.read(selectedBranchIdProvider);
      if (branchId != null) ref.refresh(roomsProvider(branchId));
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.theme.colors;
    final branchId = ref.watch(selectedBranchIdProvider);
    if (branchId == null) {
      return Center(child: CircularProgressIndicator(color: colors.primary));
    }
    final roomsAsync = ref.watch(roomsProvider(branchId));
    final sessionsAsync = ref.watch(mySessionsProvider);
    final l10n = AppLocalizations.of(context)!;
    final isReservationsEnabled = ref.watch(branchProvider).selectedBranch?.isReservationsEnabled ?? true;

    return Scaffold(
      backgroundColor: Colors.transparent,
      resizeToAvoidBottomInset: false,
      body: Column(
        children: [
          // Header
          FHeader(
            title: AppText(l10n.rooms, style: TextStyle(fontSize: 18)),
            suffixes: [
              // Scanning moved to the Menu header: a scanned code may be a
              // room or a table, so it does not belong under Rooms.
              FHeaderAction(
                icon: const Icon(FIcons.history, size: 20),
                onPress: () => context.push('/sessions'),
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
                    .where((s) => s.status == SessionStatus.active)
                    .firstOrNull;
                final reservedSession = sessions
                    .where((s) => s.status == SessionStatus.reserved)
                    .firstOrNull;

                // If user has active session, show session view
                if (activeSession != null) {
                  return _ActiveSessionView(session: activeSession);
                }

                // If user has reserved session, show reservation + rooms
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
    AsyncValue<List<Room>> roomsAsync,
    RoomSession? reservedSession,
    RoomSession? activeSession,
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
                onPress: () => ref.refresh(roomsProvider(branchId)),
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
    List<Room> rooms,
    RoomSession? reservedSession,
    RoomSession? activeSession,
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
        ref.invalidate(roomsProvider(branchId));
        await ref.read(mySessionsProvider.notifier).refresh();
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
              child: _ReservedSessionBanner(session: reservedSession),
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

          // Room items
          final room = rooms[currentIndex];
          return Column(
            children: [
              RoomListItem(
                room: room,
                canReserve: reservedSession == null && (ref.read(branchProvider).selectedBranch?.isReservationsEnabled ?? true),
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

  int _getItemCount(List<Room> rooms, RoomSession? reservedSession, bool showNotifyBanner) {
    int count = rooms.length;
    if (reservedSession != null) count++;
    if (showNotifyBanner) count++;
    return count;
  }
}

/// Active session view - shown when user is currently playing
class _ActiveSessionView extends ConsumerStatefulWidget {
  final RoomSession session;

  const _ActiveSessionView({required this.session});

  @override
  ConsumerState<_ActiveSessionView> createState() => _ActiveSessionViewState();
}

class _ActiveSessionViewState extends ConsumerState<_ActiveSessionView> {
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
      onRefresh: () => ref.read(mySessionsProvider.notifier).refresh(),
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
                  // Room name + player mode in one row
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      AppText(
                        session.roomName.localized(context),
                        style: TextStyle(
                          color: colors.primaryForeground,
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      if (session.currentPlayerMode != null) ...[
                        const SizedBox(width: 10),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: colors.primaryForeground.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: colors.primaryForeground.withValues(alpha: 0.3)),
                          ),
                          child: AppText(
                            session.currentPlayerMode == 'Single'
                                ? AppLocalizations.of(context)!.playerModeSingle
                                : AppLocalizations.of(context)!.playerModeMulti,
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

                  // Price per hour
                  const SizedBox(height: 8),
                  AppText(
                    AppLocalizations.of(context)!.hourlyRateFormat(
                      (session.currentPlayerMode == 'Multi'
                              ? session.multiRate
                              : session.singleRate)
                          .toStringAsFixed(0),
                    ),
                    style: TextStyle(
                      color: colors.primaryForeground.withValues(alpha: 0.7),
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),

            // Quick actions
            const SizedBox(height: 16),

            // Action buttons grid - row 1
            Row(
              children: [
                Expanded(
                  child: _QuickActionButton(
                    icon: FIcons.bellRing,
                    label: AppLocalizations.of(context)!.callWaiter,
                    cooldownSeconds: _getCooldownRemaining(ServiceRequestType.callWaiter),
                    onTap: () => _submitRequest(ServiceRequestType.callWaiter),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _QuickActionButton(
                    icon: FIcons.gamepad2,
                    label: AppLocalizations.of(context)!.controller,
                    cooldownSeconds: _getCooldownRemaining(ServiceRequestType.controllerChange),
                    onTap: () => _submitRequest(ServiceRequestType.controllerChange),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Action buttons grid - row 2
            Row(
              children: [
                Expanded(
                  child: _QuickActionButton(
                    icon: FIcons.receipt,
                    label: AppLocalizations.of(context)!.getBill,
                    cooldownSeconds: _getCooldownRemaining(ServiceRequestType.receiptToPay),
                    onTap: () => _submitRequest(ServiceRequestType.receiptToPay),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: session.currentPlayerMode == 'Multi'
                      ? _QuickActionButton(
                          icon: FIcons.user,
                          label: AppLocalizations.of(context)!.switchToSingle,
                          cooldownSeconds: _getCooldownRemaining(ServiceRequestType.switchToSingle),
                          onTap: () => _submitRequest(ServiceRequestType.switchToSingle),
                        )
                      : _QuickActionButton(
                          icon: FIcons.users,
                          label: AppLocalizations.of(context)!.switchToMulti,
                          cooldownSeconds: _getCooldownRemaining(ServiceRequestType.switchToMulti),
                          onTap: () => _submitRequest(ServiceRequestType.switchToMulti),
                        ),
                ),
              ],
            ),

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

  Future<void> _submitRequest(ServiceRequestType type) async {
    // Check if still in cooldown
    if (_getCooldownRemaining(type) > 0) return;

    final session = widget.session;
    final request = CreateServiceRequest(
      sessionId: session.id,
      roomId: session.roomId,
      roomName: session.roomName,
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
                await ref.read(roomRepositoryProvider).leaveSession(sessionId);
                if (!mounted) return;

                ref.read(mySessionsProvider.notifier).refresh();
                final branchId = ref.read(selectedBranchIdProvider);
                if (branchId != null) ref.invalidate(roomsProvider(branchId));

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
class _ReservedSessionBanner extends ConsumerWidget {
  final RoomSession session;

  const _ReservedSessionBanner({required this.session});

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
          // Room name
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              const Icon(FIcons.gamepad2, color: Colors.white, size: 24),
              const SizedBox(width: 8),
              AppText(
                session.roomName.localized(context),
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
        final service = ref.read(roomRepositoryProvider);
        await service.cancelReservation(session.id);
        ref.read(mySessionsProvider.notifier).refresh();
        final branchId = ref.read(selectedBranchIdProvider);
        if (branchId != null) ref.invalidate(roomsProvider(branchId));
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
                    preferredLanguage: locale?.languageCode ?? 'en',
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

/// Room list item - minimal design like menu items
class RoomListItem extends ConsumerWidget {
  final Room room;
  final bool canReserve;

  const RoomListItem({
    super.key,
    required this.room,
    this.canReserve = true,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.theme.colors;
    final isAvailable = room.canBookNow && canReserve;
    final statusColor = _getStatusColor(colors);

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
                FIcons.gamepad2,
                size: 28,
                color: isAvailable ? colors.primary : colors.mutedForeground,
              ),
            ),
            const SizedBox(width: 12),

            // Room info
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
                      AppText(
                        AppLocalizations.of(context)!.hourlyRateFormat(room.singleRate.toStringAsFixed(0)),
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 14,
                          color: colors.foreground,
                        ),
                      ),
                      const SizedBox(width: 8),
                      AppText(
                        '• ${_getLocalizedStatus(context, room.displayStatus)}',
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
      case RoomDisplayStatus.available:
        return canReserve ? AppTheme.successColor : colors.mutedForeground;
      case RoomDisplayStatus.occupied:
        return colors.destructive;
      case RoomDisplayStatus.reserved:
        return AppTheme.warningColor;
      case RoomDisplayStatus.maintenance:
        return colors.mutedForeground;
    }
  }

  Widget _ratePill(BuildContext context, String label, double rate, dynamic colors) {
    final l10n = AppLocalizations.of(context)!;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: colors.primary.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(6),
      ),
      child: AppText(
        '$label ${l10n.priceFormat(rate.toStringAsFixed(0))}',
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: colors.primary,
        ),
      ),
    );
  }

  String _getLocalizedStatus(BuildContext context, RoomDisplayStatus status) {
    final l10n = AppLocalizations.of(context)!;
    switch (status) {
      case RoomDisplayStatus.available:
        return l10n.available;
      case RoomDisplayStatus.occupied:
        return l10n.occupied;
      case RoomDisplayStatus.reserved:
        return l10n.reserved;
      case RoomDisplayStatus.maintenance:
        return l10n.maintenance;
    }
  }

  void _showReservationDialog(BuildContext context, WidgetRef ref) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useRootNavigator: true,
      backgroundColor: Colors.transparent,
      builder: (context) => ReservationSheet(room: room),
    );
  }
}

/// Reservation bottom sheet - immediate reservation with 15 min arrival window
class ReservationSheet extends ConsumerStatefulWidget {
  final Room room;

  const ReservationSheet({super.key, required this.room});

  @override
  ConsumerState<ReservationSheet> createState() => _ReservationSheetState();
}

class _ReservationSheetState extends ConsumerState<ReservationSheet> {
  bool _isLoading = false;

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
              Row(
                children: [
                  AppText(
                    l10n.singlePlayerRate(widget.room.singleRate.toStringAsFixed(0)),
                    style: TextStyle(
                      color: colors.mutedForeground,
                      fontSize: 14,
                    ),
                  ),
                  const SizedBox(width: 12),
                  AppText(
                    l10n.multiPlayerRate(widget.room.multiRate.toStringAsFixed(0)),
                    style: TextStyle(
                      color: colors.mutedForeground,
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
              // Room description
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

    final success = await ref
        .read(reservationProvider.notifier)
        .reserveRoom(widget.room.id);

    setState(() => _isLoading = false);

    if (success && mounted) {
      Navigator.pop(context);
      final branchId = ref.read(selectedBranchIdProvider);
      if (branchId != null) ref.invalidate(roomsProvider(branchId));
      ref.read(mySessionsProvider.notifier).refresh();
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

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import '../../../core/config/app_config.dart';
import '../../../core/models/localized_text.dart';
import '../../../core/widgets/admin_scaffold.dart';
import '../../../core/widgets/app_text.dart';
import '../../../core/widgets/ui_components.dart';
import '../../../l10n/app_localizations.dart';
import '../models/room.dart';
import '../providers/rooms_provider.dart';
import '../widgets/room_form_sheet.dart';

class RoomsScreen extends ConsumerStatefulWidget {
  const RoomsScreen({super.key});

  @override
  ConsumerState<RoomsScreen> createState() => _RoomsScreenState();
}

class _RoomsScreenState extends ConsumerState<RoomsScreen> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();

    // Auto-refresh for live timers
    _timer = Timer.periodic(AppConfig.roomsRefreshInterval, (_) {
      ref.read(roomsProvider.notifier).loadRooms();
    });

    // Listen to route changes and refresh when navigating to this screen
    ref.listenManual(currentRouteProvider, (previous, next) {
      if (next == '/rooms' && previous != '/rooms' && previous != null) {
        ref.read(roomsProvider.notifier).loadRooms();
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(roomsProvider);
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Header
        Padding(
          padding: const EdgeInsets.only(left: 16, right: 16, top: 2, bottom: 8),
          child: Row(
            children: [
              AppText(l10n.rooms, style: theme.typography.lg.copyWith(fontSize: 18, fontWeight: FontWeight.w600)),
              const Spacer(),
              IconButton(
                icon: const Icon(Icons.add, size: 22),
                onPressed: () => _showRoomForm(context),
                tooltip: l10n.addRoom,
              ),
            ],
          ),
        ),

        // Content
        Expanded(
          child: DelayedShimmer(
            isLoading: state.isLoading && state.rooms.isEmpty,
            shimmer: const ShimmerLoadingList(),
            child: RefreshIndicator(
              color: theme.colors.primary,
              backgroundColor: theme.colors.background,
              onRefresh: () => ref.read(roomsProvider.notifier).loadRooms(),
              child: _RoomStatusSection(
                rooms: state.rooms,
                activeSessions: state.activeSessions,
                onReserve: _reserveRoom,
                onStartWalkIn: _startWalkIn,
                onStartSession: _startSession,
                onEndSession: (id) => _endSession(context, id),
                onTapRoom: (room) => _showRoomDetail(context, room),
              ),
            ),
          ),
        ),
      ],
    );
  }

  void _showRoomForm(BuildContext context, {Room? room}) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useRootNavigator: true,
      backgroundColor: Colors.transparent,
      barrierColor: Colors.black.withValues(alpha: 0.5),
      builder: (context) => RoomFormSheet(room: room),
    );
  }

  void _showRoomDetail(BuildContext context, Room room) {
    context.go('/rooms/${room.id}');
  }

  Future<void> _reserveRoom(int roomId) async {
    await ref.read(roomsProvider.notifier).reserveRoom(roomId);
  }

  Future<String?> _pickPlayerMode(BuildContext context) async {
    final l10n = AppLocalizations.of(context)!;
    return showAdaptiveDialog<String>(
      context: context,
      builder: (context) => FDialog(
        direction: Axis.vertical,
        title: AppText(l10n.selectPlayerMode),
        body: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 8),
            FButton(
              onPress: () => Navigator.of(context).pop('Single'),
              child: AppText(l10n.playerModeSingle),
            ),
            const SizedBox(height: 8),
            FButton(
              variant: FButtonVariant.outline,
              onPress: () => Navigator.of(context).pop('Multi'),
              child: AppText(l10n.playerModeMulti),
            ),
          ],
        ),
        actions: [
          FButton(
            variant: FButtonVariant.outline,
            child: AppText(l10n.cancel),
            onPress: () => Navigator.of(context).pop(null),
          ),
        ],
      ),
    );
  }

  Future<void> _startWalkIn(int roomId) async {
    final mode = await _pickPlayerMode(context);
    if (mode == null) return;
    await ref.read(roomsProvider.notifier).startWalkInSession(roomId, playerMode: mode);
  }

  Future<void> _startSession(int sessionId) async {
    final mode = await _pickPlayerMode(context);
    if (mode == null) return;
    await ref.read(roomsProvider.notifier).startSession(sessionId, playerMode: mode);
  }

  Future<void> _endSession(BuildContext context, int sessionId) async {
    final l10n = AppLocalizations.of(context)!;
    final confirmed = await showAdaptiveDialog<bool>(
      context: context,
      builder: (context) => FDialog(
        direction: Axis.horizontal,
        title: AppText(l10n.endSession),
        body: AppText(l10n.endSessionConfirmation),
        actions: [
          FButton(
            variant: FButtonVariant.outline,
            child: AppText(l10n.cancel),
            onPress: () => Navigator.of(context).pop(false),
          ),
          FButton(
            child: AppText(l10n.endSessionButton),
            onPress: () => Navigator.of(context).pop(true),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      await ref.read(roomsProvider.notifier).endSession(sessionId);
    }
  }

}

/// Room status section - list layout
class _RoomStatusSection extends StatelessWidget {
  final List<Room> rooms;
  final List<RoomSession> activeSessions;
  final Function(int) onReserve;
  final Function(int) onStartWalkIn;
  final Function(int) onStartSession;
  final Function(int) onEndSession;
  final Function(Room) onTapRoom;

  const _RoomStatusSection({
    required this.rooms,
    required this.activeSessions,
    required this.onReserve,
    required this.onStartWalkIn,
    required this.onStartSession,
    required this.onEndSession,
    required this.onTapRoom,
  });

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    if (rooms.isEmpty) {
      return EmptyState(
        icon: FIcons.gamepad2,
        title: l10n.noRoomsConfigured,
        subtitle: l10n.addRoomToGetStarted,
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.symmetric(vertical: 8),
      itemCount: rooms.length,
      itemBuilder: (context, index) {
        final room = rooms[index];
        final session =
            activeSessions.where((s) => s.roomId == room.id).firstOrNull;
        return Column(
          children: [
            _RoomTile(
              room: room,
              session: session,
              onReserve: () => onReserve(room.id),
              onStartWalkIn: () => onStartWalkIn(room.id),
              onStartSession:
                  session != null ? () => onStartSession(session.id) : null,
              onEndSession:
                  session != null ? () => onEndSession(session.id) : null,
              onTap: () => onTapRoom(room),
              isLast: index == rooms.length - 1,
            ),
            if (index < rooms.length - 1)
              Divider(
                height: 1,
                indent: 16,
                endIndent: 16,
                color: context.theme.colors.border,
              ),
          ],
        );
      },
    );
  }
}

/// Mobile room tile - matches mobile app design with icon buttons
class _RoomTile extends StatefulWidget {
  final Room room;
  final RoomSession? session;
  final VoidCallback onReserve;
  final VoidCallback onStartWalkIn;
  final VoidCallback? onStartSession;
  final VoidCallback? onEndSession;
  final VoidCallback onTap;
  final bool isLast;

  const _RoomTile({
    required this.room,
    this.session,
    required this.onReserve,
    required this.onStartWalkIn,
    this.onStartSession,
    this.onEndSession,
    required this.onTap,
    this.isLast = false,
  });

  @override
  State<_RoomTile> createState() => _RoomTileState();
}

class _RoomTileState extends State<_RoomTile> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _setupTimer();
  }

  @override
  void didUpdateWidget(_RoomTile oldWidget) {
    super.didUpdateWidget(oldWidget);
    _timer?.cancel();
    _setupTimer();
  }

  void _setupTimer() {
    // Timer needed for both active sessions (duration) and reserved sessions (countdown)
    if (widget.session?.status == SessionStatus.active ||
        widget.session?.status == SessionStatus.reserved) {
      _timer = Timer.periodic(const Duration(seconds: 1), (_) {
        if (mounted) setState(() {});
      });
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final isActive = widget.session?.status == SessionStatus.active;
    final isReserved = widget.session?.status == SessionStatus.reserved;
    final isAvailable = widget.room.status == RoomStatus.available &&
        !isActive && !isReserved;

    return GestureDetector(
      onTap: widget.onTap,
      behavior: HitTestBehavior.opaque,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            // Gamepad icon - larger like mobile app
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: _getStatusColor(theme).withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(
                FIcons.gamepad2,
                size: 28,
                color: _getStatusColor(theme),
              ),
            ),
            const SizedBox(width: 12),

            // Room info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  AppText(
                    widget.room.name.localized(context),
                    style: theme.typography.base.copyWith(
                      fontWeight: FontWeight.w600,
                      fontSize: 15,
                    ),
                  ),
                  const SizedBox(height: 6),
                  if (isAvailable)
                    Row(
                      children: [
                        AppText(
                          l10n.dualRateFormat(widget.room.singleRate.toStringAsFixed(0), widget.room.multiRate.toStringAsFixed(0)),
                          style: theme.typography.sm.copyWith(
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                          ),
                        ),
                        const SizedBox(width: 8),
                        AppText(
                          '• ${_getStatusLabel(l10n)}',
                          style: theme.typography.sm.copyWith(
                            color: _getStatusColor(theme),
                            fontSize: 13,
                          ),
                        ),
                      ],
                    )
                  else
                    AppText(
                      _getStatusLabel(l10n),
                      style: theme.typography.sm.copyWith(
                        color: _getStatusColor(theme),
                        fontSize: 13,
                      ),
                    ),
                  if (widget.session?.userName != null) ...[
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Icon(
                          Icons.person,
                          size: 14,
                          color: theme.colors.mutedForeground,
                        ),
                        const SizedBox(width: 4),
                        Expanded(
                          child: AppText(
                            widget.session!.userName!,
                            style: theme.typography.sm.copyWith(
                              color: theme.colors.foreground,
                              fontSize: 13,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),

            // Action icon button
            if (isActive)
              GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: widget.onEndSession,
                child: Padding(
                  padding: const EdgeInsets.all(4),
                  child: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: theme.colors.destructive,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Icon(
                      Icons.stop,
                      color: theme.colors.destructiveForeground,
                      size: 18,
                    ),
                  ),
                ),
              )
            else if (isReserved)
              GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: widget.onStartSession,
                child: Padding(
                  padding: const EdgeInsets.all(4),
                  child: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: theme.colors.primary,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Transform.scale(
                      scaleX: Directionality.of(context) == TextDirection.rtl ? -1 : 1,
                      child: Icon(
                        Icons.play_arrow,
                        color: theme.colors.primaryForeground,
                        size: 18,
                      ),
                    ),
                  ),
                ),
              )
            else if (isAvailable) ...[
              GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => widget.onStartWalkIn(),
                child: Padding(
                  padding: const EdgeInsets.all(4),
                  child: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: theme.colors.primary,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Icon(
                      Icons.directions_walk,
                      color: theme.colors.primaryForeground,
                      size: 18,
                    ),
                  ),
                ),
              ),
              GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: widget.onReserve,
                child: Padding(
                  padding: const EdgeInsets.all(4),
                  child: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: theme.colors.primary.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Icon(
                      Icons.bookmark_add_outlined,
                      color: theme.colors.primary,
                      size: 18,
                    ),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _getStatusLabel(AppLocalizations l10n) {
    if (widget.session?.status == SessionStatus.active) {
      return widget.session!.formattedDuration;
    }
    if (widget.session?.status == SessionStatus.reserved) {
      // Show countdown if expiration time is available
      if (widget.session!.expiresAt != null) {
        final remaining = widget.session!.timeUntilExpiration;
        if (remaining != null && remaining.inSeconds > 0) {
          return l10n.reservedCountdown(widget.session!.formattedCountdown);
        } else {
          return l10n.expiring;
        }
      }
      return l10n.statusReserved;
    }
    switch (widget.room.status) {
      case RoomStatus.available:
        return l10n.statusAvailable;
      case RoomStatus.occupied:
        return l10n.statusOccupied;
      case RoomStatus.reserved:
        return l10n.statusReserved;
      case RoomStatus.maintenance:
        return l10n.statusMaintenance;
    }
  }

  Color _getStatusColor(FThemeData theme) {
    if (widget.session?.status == SessionStatus.active) {
      return theme.colors.destructive;
    }
    if (widget.session?.status == SessionStatus.reserved) {
      // Show red if about to expire (< 5 minutes)
      final remaining = widget.session!.timeUntilExpiration;
      if (remaining != null && remaining.inMinutes < 5) {
        return theme.colors.destructive;
      }
      return Colors.orange;
    }

    switch (widget.room.status) {
      case RoomStatus.available:
        return theme.colors.primary;
      case RoomStatus.occupied:
        return theme.colors.destructive;
      case RoomStatus.reserved:
        return Colors.orange;
      case RoomStatus.maintenance:
        return theme.colors.mutedForeground;
    }
  }
}

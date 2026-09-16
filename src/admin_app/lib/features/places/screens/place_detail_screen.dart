import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart' show DateFormat;
import '../../../core/models/localized_text.dart';
import '../../../core/network/api_client.dart';
import '../../../core/widgets/app_text.dart';
import '../../../core/widgets/toast_helpers.dart';
import '../../../l10n/app_localizations.dart';
import '../../customers/models/customer.dart';
import '../models/room.dart';
import '../providers/rooms_provider.dart';
import '../widgets/room_form_sheet.dart';

/// Room detail screen - Split view: Now (top) + History (bottom)
class RoomDetailScreen extends ConsumerStatefulWidget {
  final int roomId;

  const RoomDetailScreen({super.key, required this.roomId});

  @override
  ConsumerState<RoomDetailScreen> createState() => _RoomDetailScreenState();
}

class _RoomDetailScreenState extends ConsumerState<RoomDetailScreen> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      ref.read(roomsProvider.notifier).loadRooms();
      ref.read(roomsProvider.notifier).loadSessionHistory(widget.roomId);
    });

    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
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

    final room = state.rooms.where((r) => r.id == widget.roomId).firstOrNull;
    final session = state.activeSessions
        .where((s) => s.roomId == widget.roomId)
        .firstOrNull;

    if (room == null) {
      return Scaffold(
        backgroundColor: theme.colors.background,
        body: SafeArea(
          child: Column(
            children: [
              _buildHeader(context, theme, null, null),
              Expanded(child: Center(child: CircularProgressIndicator(color: theme.colors.primary))),
            ],
          ),
        ),
      );
    }

    final isActive = session?.status == SessionStatus.active;
    final isReserved = session?.status == SessionStatus.reserved;
    final isAvailable = room.status == RoomStatus.available && !isActive && !isReserved;

    return Scaffold(
      backgroundColor: theme.colors.background,
      resizeToAvoidBottomInset: false,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            // Header
            _buildHeader(context, theme, room, session),

            // TOP HALF: Current State
            _CurrentStateSection(
              room: room,
              session: session,
              isActive: isActive,
              isReserved: isReserved,
              isAvailable: isAvailable,
              onReserve: () => _reserveRoom(room.id),
              onWalkIn: () => _startWalkIn(room.id),
              onStartSession: session != null ? () => _startSession(session.id) : null,
              onEndSession: session != null ? () => _endSession(context, session.id) : null,
              onCancelReservation: session != null ? () => _cancelReservation(context, session.id) : null,
              onAssignCustomer: session != null && isReserved && session.customerId == null
                  ? () => _showAddCustomerSheet(context, session)
                  : null,
              onAddCustomer: session != null && isActive
                  ? () => _showAddCustomerSheet(context, session)
                  : null,
              onRemoveMember: session != null && isActive
                  ? (customerId) => _removeMember(context, session.id, customerId)
                  : null,
              onChangePlayerMode: session != null && isActive
                  ? (mode) => _changePlayerMode(session.id, mode)
                  : null,
            ),

            // BOTTOM HALF: History
            Expanded(
              child: _HistorySection(
                sessions: state.sessionHistory ?? [],
                isLoading: state.isLoadingHistory,
                hasMore: state.hasMoreHistory,
                onLoadMore: () => ref.read(roomsProvider.notifier).loadSessionHistory(widget.roomId, loadMore: true),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context, FThemeData theme, Room? room, RoomSession? session) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: () => context.go('/rooms'),
          ),
          const Spacer(),
          if (room != null) ...[
            IconButton(
              icon: const Icon(Icons.qr_code, size: 20),
              onPressed: () {
                Clipboard.setData(ClipboardData(text: 'https://chillax.site/room/${room.id}'));
              },
              tooltip: 'Copy QR URL',
            ),
            IconButton(
              icon: const Icon(Icons.edit_outlined, size: 20),
              onPressed: () => _showEditSheet(context, room),
              tooltip: 'Edit',
            ),
            if (session == null)
              IconButton(
                icon: Icon(Icons.delete_outline, size: 20, color: theme.colors.destructive),
                onPressed: () => _deleteRoom(context, room),
                tooltip: 'Delete',
              ),
          ],
        ],
      ),
    );
  }

  void _showEditSheet(BuildContext context, Room room) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useRootNavigator: true,
      backgroundColor: Colors.transparent,
      barrierColor: Colors.black.withValues(alpha: 0.5),
      builder: (context) => RoomFormSheet(room: room),
    );
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
        body: AppText(l10n.customerWillBeCharged),
        actions: [
          FButton(
            variant: FButtonVariant.outline,
            child: AppText(l10n.cancel),
            onPress: () => Navigator.of(context).pop(false),
          ),
          FButton(
            child: AppText(l10n.end),
            onPress: () => Navigator.of(context).pop(true),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      await ref.read(roomsProvider.notifier).endSession(sessionId);
      // Reload history to show the completed session
      ref.read(roomsProvider.notifier).loadSessionHistory(widget.roomId);
    }
  }

  Future<void> _cancelReservation(BuildContext context, int sessionId) async {
    final l10n = AppLocalizations.of(context)!;
    final confirmed = await showAdaptiveDialog<bool>(
      context: context,
      builder: (context) => FDialog(
        direction: Axis.horizontal,
        title: AppText(l10n.cancelReservationQuestion),
        body: AppText(l10n.cancelReservationConfirmation),
        actions: [
          FButton(
            variant: FButtonVariant.outline,
            child: AppText(l10n.no),
            onPress: () => Navigator.of(context).pop(false),
          ),
          FButton(
            variant: FButtonVariant.destructive,
            child: AppText(l10n.cancelReservation),
            onPress: () => Navigator.of(context).pop(true),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      await ref.read(roomsProvider.notifier).cancelSession(sessionId);
      // Reload history to show the cancelled session
      ref.read(roomsProvider.notifier).loadSessionHistory(widget.roomId);
    }
  }

  void _showAddCustomerSheet(BuildContext context, RoomSession session) {
    // Collect already-assigned customer IDs to filter them out
    final existingCustomerIds = <String>{};
    if (session.customerId != null) existingCustomerIds.add(session.customerId!);
    for (final member in session.members) {
      existingCustomerIds.add(member.customerId);
    }

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useRootNavigator: true,
      backgroundColor: Colors.transparent,
      barrierColor: Colors.black.withValues(alpha: 0.5),
      builder: (sheetContext) => _AssignCustomerSheet(
        excludeCustomerIds: existingCustomerIds,
        onCustomerSelected: (customer) async {
          Navigator.pop(sheetContext);
          final l10n = AppLocalizations.of(context)!;
          bool success;
          if (session.customerId == null) {
            // No owner yet - assign as owner
            success = await ref.read(roomsProvider.notifier).assignCustomerToSession(
              session.id,
              customer.id,
              customer.displayName,
            );
          } else {
            // Already has owner - add as member
            success = await ref.read(roomsProvider.notifier).addMemberToSession(
              session.id,
              customer.id,
              customer.displayName,
            );
          }
          if (context.mounted) {
            if (success) {
              showSuccessToast(context, l10n.customerAssigned);
            } else {
              showErrorToast(context, l10n.failedToAssignCustomer);
            }
          }
        },
      ),
    );
  }

  Future<void> _removeMember(BuildContext context, int sessionId, String customerId) async {
    final l10n = AppLocalizations.of(context)!;
    final success = await ref.read(roomsProvider.notifier).removeMemberFromSession(sessionId, customerId);
    if (context.mounted) {
      if (success) {
        showSuccessToast(context, l10n.memberRemoved);
      } else {
        showErrorToast(context, l10n.failedToRemoveMember);
      }
    }
  }

  Future<void> _changePlayerMode(int sessionId, String mode) async {
    final l10n = AppLocalizations.of(context)!;
    final modeLabel = mode == 'Multi' ? l10n.playerModeMulti : l10n.playerModeSingle;
    final confirmed = await showAdaptiveDialog<bool>(
      context: context,
      builder: (context) => FDialog(
        direction: Axis.horizontal,
        title: AppText(l10n.changePlayerMode),
        body: AppText(l10n.changePlayerModeConfirmation(modeLabel)),
        actions: [
          FButton(
            variant: FButtonVariant.outline,
            child: AppText(l10n.cancel),
            onPress: () => Navigator.of(context).pop(false),
          ),
          FButton(
            child: AppText(l10n.confirm),
            onPress: () => Navigator.of(context).pop(true),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      await ref.read(roomsProvider.notifier).changePlayerMode(sessionId, mode);
    }
  }

  Future<void> _deleteRoom(BuildContext context, Room room) async {
    final l10n = AppLocalizations.of(context)!;
    final confirmed = await showAdaptiveDialog<bool>(
      context: context,
      builder: (context) => FDialog(
        direction: Axis.horizontal,
        title: AppText(l10n.deleteRoom),
        body: AppText(l10n.deleteRoomConfirmation(room.name.localized(context))),
        actions: [
          FButton(
            variant: FButtonVariant.outline,
            child: AppText(l10n.cancel),
            onPress: () => Navigator.of(context).pop(false),
          ),
          FButton(
            variant: FButtonVariant.destructive,
            child: AppText(l10n.delete),
            onPress: () => Navigator.of(context).pop(true),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      await ref.read(roomsProvider.notifier).deleteRoom(room.id);
      if (context.mounted) {
        context.go('/rooms');
      }
    }
  }
}

/// Top section: Current state (Now)
class _CurrentStateSection extends StatelessWidget {
  final Room room;
  final RoomSession? session;
  final bool isActive;
  final bool isReserved;
  final bool isAvailable;
  final VoidCallback onReserve;
  final VoidCallback onWalkIn;
  final VoidCallback? onStartSession;
  final VoidCallback? onEndSession;
  final VoidCallback? onCancelReservation;
  final VoidCallback? onAssignCustomer;
  final VoidCallback? onAddCustomer;
  final ValueChanged<String>? onRemoveMember;
  final ValueChanged<String>? onChangePlayerMode;

  const _CurrentStateSection({
    required this.room,
    required this.session,
    required this.isActive,
    required this.isReserved,
    required this.isAvailable,
    required this.onReserve,
    required this.onWalkIn,
    this.onStartSession,
    this.onEndSession,
    this.onCancelReservation,
    this.onAssignCustomer,
    this.onAddCustomer,
    this.onRemoveMember,
    this.onChangePlayerMode,
  });

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;

    // Get status color
    Color statusColor;
    if (isActive) {
      statusColor = theme.colors.destructive;
    } else if (isReserved) {
      statusColor = Colors.orange;
    } else if (isAvailable) {
      statusColor = Colors.green;
    } else {
      statusColor = theme.colors.mutedForeground;
    }

    return Container(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Room name + status indicator
          Row(
            children: [
              Container(
                width: 10,
                height: 10,
                decoration: BoxDecoration(
                  color: statusColor,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: AppText(
                  room.name.localized(context),
                  style: theme.typography.xl.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              AppText(
                l10n.dualRateFormat(room.singleRate.toStringAsFixed(0), room.multiRate.toStringAsFixed(0)),
                style: theme.typography.sm.copyWith(
                  color: theme.colors.mutedForeground,
                ),
              ),
            ],
          ),

          const SizedBox(height: 20),

          // Active Session: Show timer prominently
          if (isActive && session != null) ...[
            // Big timer
            Center(
              child: Column(
                children: [
                  AppText(
                    session!.formattedDuration,
                    style: TextStyle(
                      fontSize: 56,
                      fontWeight: FontWeight.w300,
                      fontFamily: 'monospace',
                      letterSpacing: 4,
                      height: 1,
                      color: theme.colors.foreground,
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 8),

            // Per-mode time breakdown (only show modes that have segments)
            if (session!.segments.isNotEmpty) ...[
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (session!.segments.any((s) => s.playerMode == 'Single'))
                    AppText(
                      '${l10n.playerModeSingle} ${_formatSegmentDuration(session!, 'Single')}',
                      style: theme.typography.xs.copyWith(
                        color: theme.colors.mutedForeground,
                        fontFamily: 'monospace',
                      ),
                    ),
                  if (session!.segments.any((s) => s.playerMode == 'Single') &&
                      session!.segments.any((s) => s.playerMode == 'Multi'))
                    const SizedBox(width: 16),
                  if (session!.segments.any((s) => s.playerMode == 'Multi'))
                    AppText(
                      '${l10n.playerModeMulti} ${_formatSegmentDuration(session!, 'Multi')}',
                      style: theme.typography.xs.copyWith(
                        color: theme.colors.mutedForeground,
                        fontFamily: 'monospace',
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 12),
            ],

            // Player mode toggle
            if (onChangePlayerMode != null) ...[
              _PlayerModeToggle(
                currentMode: session!.currentPlayerMode ?? 'Single',
                singleRate: session!.singleRate,
                multiRate: session!.multiRate,
                onChanged: onChangePlayerMode!,
              ),
              const SizedBox(height: 16),
            ],

            const SizedBox(height: 16),

            // Members list
            if (session!.members.isNotEmpty) ...[
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 8),
                child: Row(
                  children: session!.members.map((member) {
                    return Padding(
                      padding: const EdgeInsetsDirectional.only(end: 8),
                      child: GestureDetector(
                        onTap: () => context.push('/customers/${member.customerId}'),
                        child: Chip(
                          avatar: Icon(
                            member.isOwner ? Icons.star : Icons.person,
                            size: 16,
                            color: member.isOwner ? Colors.amber : theme.colors.mutedForeground,
                          ),
                          label: AppText(
                            member.customerName ?? member.customerId,
                            style: theme.typography.sm,
                          ),
                          deleteIcon: member.isOwner ? null : const Icon(Icons.close, size: 16),
                          onDeleted: member.isOwner || onRemoveMember == null
                              ? null
                              : () => onRemoveMember!(member.customerId),
                          visualDensity: VisualDensity.compact,
                          materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ),
              const SizedBox(height: 12),
            ] else if (session!.userName != null) ...[
              // Fallback: show single user name if no members loaded
              GestureDetector(
                onTap: session!.customerId != null
                    ? () => context.push('/customers/${session!.customerId}')
                    : null,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.person_outline, size: 16, color: theme.colors.mutedForeground),
                    const SizedBox(width: 4),
                    AppText(
                      session!.userName!,
                      style: theme.typography.sm.copyWith(
                        color: theme.colors.mutedForeground,
                        decoration: session!.customerId != null ? TextDecoration.underline : null,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
            ],

            // Add Customer button (always available for active sessions)
            if (onAddCustomer != null) ...[
              Center(
                child: FButton(
                  variant: FButtonVariant.outline,
                  onPress: onAddCustomer,
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.person_add_outlined, size: 18),
                      const SizedBox(width: 8),
                      AppText(l10n.addCustomer),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
            ],

            // End button
            Center(
              child: FButton(
                variant: FButtonVariant.destructive,
                onPress: onEndSession,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.stop, size: 18),
                    const SizedBox(width: 8),
                    AppText(l10n.endSessionButton),
                  ],
                ),
              ),
            ),
          ],

          // Reserved: Show waiting state with countdown
          if (isReserved && session != null) ...[
            Center(
              child: Column(
                children: [
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.orange.withValues(alpha: 0.1),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.schedule, size: 32, color: Colors.orange),
                  ),
                  const SizedBox(height: 16),
                  AppText(
                    l10n.readyToStart,
                    style: theme.typography.lg.copyWith(
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 12),
                  if (session!.userName != null)
                    GestureDetector(
                      onTap: session!.customerId != null
                          ? () => context.push('/customers/${session!.customerId}')
                          : null,
                      child: Chip(
                        avatar: const Icon(Icons.star, size: 16, color: Colors.amber),
                        label: AppText(
                          session!.userName!,
                          style: theme.typography.sm,
                        ),
                        visualDensity: VisualDensity.compact,
                        materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                    )
                  else if (onAssignCustomer != null)
                    GestureDetector(
                      onTap: onAssignCustomer,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                        decoration: BoxDecoration(
                          border: Border.all(
                            color: theme.colors.border,
                            style: BorderStyle.solid,
                          ),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.person_add_outlined, size: 18, color: theme.colors.mutedForeground),
                            const SizedBox(width: 8),
                            AppText(
                              l10n.addCustomer,
                              style: theme.typography.sm.copyWith(
                                color: theme.colors.mutedForeground,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  // Countdown timer display
                  if (session!.expiresAt != null) ...[
                    const SizedBox(height: 16),
                    _ExpirationCountdown(session: session!),
                  ],
                ],
              ),
            ),

            const SizedBox(height: 16),

            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                FButton(
                  variant: FButtonVariant.outline,
                  onPress: onCancelReservation,
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.close, size: 18),
                      const SizedBox(width: 8),
                      AppText(l10n.cancel),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                FButton(
                  onPress: onStartSession,
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Transform.scale(
                        scaleX: Directionality.of(context) == TextDirection.rtl ? -1 : 1,
                        child: const Icon(Icons.play_arrow, size: 18),
                      ),
                      const SizedBox(width: 8),
                      AppText(l10n.startSession),
                    ],
                  ),
                ),
              ],
            ),
          ],

          // Available: Show actions
          if (isAvailable) ...[
            Center(
              child: Column(
                children: [
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.green.withValues(alpha: 0.1),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.check_circle_outline, size: 32, color: Colors.green),
                  ),
                  const SizedBox(height: 16),
                  AppText(
                    l10n.available,
                    style: theme.typography.lg.copyWith(
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  if (room.description != null && room.description!.en.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    AppText(
                      room.description!.localized(context),
                      style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ],
              ),
            ),

            const SizedBox(height: 24),

            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                FButton(
                  variant: FButtonVariant.outline,
                  onPress: onReserve,
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.bookmark_add_outlined, size: 18),
                      const SizedBox(width: 8),
                      AppText(l10n.reserve),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                FButton(
                  onPress: onWalkIn,
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Transform.scale(
                        scaleX: Directionality.of(context) == TextDirection.rtl ? -1 : 1,
                        child: const Icon(Icons.play_arrow, size: 18),
                      ),
                      const SizedBox(width: 8),
                      AppText(l10n.walkIn),
                    ],
                  ),
                ),
              ],
            ),
          ],

          // Maintenance or other unavailable states
          if (!isActive && !isReserved && !isAvailable) ...[
            Center(
              child: Column(
                children: [
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: theme.colors.muted,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(Icons.build_outlined, size: 32, color: theme.colors.mutedForeground),
                  ),
                  const SizedBox(height: 16),
                  AppText(
                    room.status == RoomStatus.maintenance ? 'Under Maintenance' : 'Unavailable',
                    style: theme.typography.lg.copyWith(
                      fontWeight: FontWeight.w500,
                      color: theme.colors.mutedForeground,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// Toggle between Single and Multi player mode
String _formatSegmentDuration(RoomSession session, String mode) {
  final totalSeconds = session.segments
      .where((s) => s.playerMode == mode)
      .fold<int>(0, (sum, s) {
    final end = s.endTime ?? DateTime.now();
    return sum + end.difference(s.startTime).inSeconds;
  });
  final h = (totalSeconds ~/ 3600).toString().padLeft(2, '0');
  final m = ((totalSeconds % 3600) ~/ 60).toString().padLeft(2, '0');
  final s = (totalSeconds % 60).toString().padLeft(2, '0');
  return '$h:$m:$s';
}

class _PlayerModeToggle extends StatelessWidget {
  final String currentMode;
  final double singleRate;
  final double multiRate;
  final ValueChanged<String> onChanged;

  const _PlayerModeToggle({
    required this.currentMode,
    required this.singleRate,
    required this.multiRate,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final isSingle = currentMode != 'Multi';

    return Center(
      child: Container(
        decoration: BoxDecoration(
          color: theme.colors.muted,
          borderRadius: BorderRadius.circular(10),
        ),
        padding: const EdgeInsets.all(3),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            _modeButton(
              context,
              label: l10n.playerModeSingle,
              rate: singleRate,
              isSelected: isSingle,
              onTap: () {
                if (!isSingle) onChanged('Single');
              },
            ),
            _modeButton(
              context,
              label: l10n.playerModeMulti,
              rate: multiRate,
              isSelected: !isSingle,
              onTap: () {
                if (isSingle) onChanged('Multi');
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _modeButton(
    BuildContext context, {
    required String label,
    required double rate,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
        decoration: BoxDecoration(
          color: isSelected ? theme.colors.background : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
          boxShadow: isSelected
              ? [BoxShadow(color: Colors.black.withValues(alpha: 0.08), blurRadius: 4, offset: const Offset(0, 1))]
              : null,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AppText(
              label,
              style: theme.typography.sm.copyWith(
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                color: isSelected ? theme.colors.foreground : theme.colors.mutedForeground,
              ),
            ),
            const SizedBox(height: 2),
            AppText(
              l10n.hourlyRateFormat(rate.toStringAsFixed(0)),
              style: theme.typography.xs.copyWith(
                color: isSelected ? theme.colors.primary : theme.colors.mutedForeground,
                fontWeight: isSelected ? FontWeight.w500 : FontWeight.w400,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Bottom section: History with pagination
class _HistorySection extends StatelessWidget {
  final List<RoomSession> sessions;
  final bool isLoading;
  final bool hasMore;
  final VoidCallback? onLoadMore;

  const _HistorySection({
    required this.sessions,
    required this.isLoading,
    this.hasMore = false,
    this.onLoadMore,
  });

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final locale = Localizations.localeOf(context);
    final l10n = AppLocalizations.of(context)!;
    final dateFormat = DateFormat('MMM d', locale.languageCode);
    final timeFormat = DateFormat('h:mm a', locale.languageCode);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Header
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 8),
          child: AppText(
            l10n.history,
            style: theme.typography.sm.copyWith(
              fontWeight: FontWeight.w600,
            ),
          ),
        ),

        // List
        Expanded(
          child: isLoading && sessions.isEmpty
              ? Center(child: CircularProgressIndicator(color: theme.colors.primary))
              : sessions.isEmpty
                  ? Center(
                      child: AppText(
                        l10n.noSessionsYet,
                        style: theme.typography.sm.copyWith(
                          color: theme.colors.mutedForeground,
                        ),
                      ),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      itemCount: sessions.length + (hasMore ? 1 : 0),
                      itemBuilder: (context, index) {
                        // Load more button
                        if (index == sessions.length) {
                          return Padding(
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            child: Center(
                              child: isLoading
                                  ? SizedBox(
                                      width: 20,
                                      height: 20,
                                      child: CircularProgressIndicator(strokeWidth: 2, color: theme.colors.primary),
                                    )
                                  : GestureDetector(
                                      onTap: onLoadMore,
                                      child: AppText(
                                        l10n.loadMore,
                                        style: theme.typography.sm.copyWith(
                                          color: theme.colors.primary,
                                        ),
                                      ),
                                    ),
                            ),
                          );
                        }

                        final session = sessions[index];
                        return GestureDetector(
                          behavior: HitTestBehavior.opaque,
                          onTap: () => _showSessionDetailSheet(context, session),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            child: Row(
                              children: [
                                // Date & time
                                SizedBox(
                                  width: 70,
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      AppText(
                                        session.startTime != null
                                            ? dateFormat.format(session.startTime!.toLocal())
                                            : '-',
                                        style: theme.typography.sm.copyWith(
                                          fontWeight: FontWeight.w500,
                                        ),
                                      ),
                                      AppText(
                                        session.startTime != null
                                            ? timeFormat.format(session.startTime!.toLocal())
                                            : '',
                                        style: theme.typography.xs.copyWith(
                                          color: theme.colors.mutedForeground,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),

                                // User
                                Expanded(
                                  child: session.userName != null
                                      ? AppText(
                                          session.userName!,
                                          style: theme.typography.sm,
                                          overflow: TextOverflow.ellipsis,
                                        )
                                      : AppText(
                                          l10n.walkIn,
                                          style: theme.typography.sm.copyWith(
                                            color: theme.colors.mutedForeground,
                                          ),
                                        ),
                                ),

                                // Duration
                                AppText(
                                  session.formattedDuration,
                                  style: theme.typography.sm.copyWith(
                                    fontFamily: 'monospace',
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),

                                const SizedBox(width: 4),
                                Icon(
                                  Icons.chevron_right,
                                  size: 16,
                                  color: theme.colors.mutedForeground,
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
        ),
      ],
    );
  }

  void _showSessionDetailSheet(BuildContext context, RoomSession session) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final hSuffix = l10n.hoursShort;
    final locale = Localizations.localeOf(context).languageCode;

    // Calculate actual duration per mode from segments
    Duration singleDuration = Duration.zero;
    Duration multiDuration = Duration.zero;
    for (final seg in session.segments) {
      final end = seg.endTime ?? DateTime.now();
      final segDuration = end.difference(seg.startTime);
      if (seg.playerMode == 'Multi') {
        multiDuration += segDuration;
      } else {
        singleDuration += segDuration;
      }
    }

    final hasSingle = singleDuration > Duration.zero;
    final hasMulti = multiDuration > Duration.zero;

    showModalBottomSheet(
      context: context,
      useRootNavigator: true,
      backgroundColor: theme.colors.background,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Handle
              Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: theme.colors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 20),

              // Header: icon + user/date + duration
              Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: theme.colors.primary.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(FIcons.gamepad2, size: 22, color: theme.colors.primary),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        AppText(
                          session.userName ?? l10n.walkIn,
                          style: theme.typography.base.copyWith(
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        if (session.startTime != null)
                          AppText(
                            DateFormat('MMM d, y – h:mm a', locale)
                                .format(session.startTime!.toLocal()),
                            style: theme.typography.xs.copyWith(
                              color: theme.colors.mutedForeground,
                            ),
                          ),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      AppText(
                        session.formattedDuration,
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          fontFamily: 'monospace',
                          letterSpacing: 1,
                          color: theme.colors.foreground,
                        ),
                      ),
                      AppText(
                        l10n.totalDuration,
                        style: theme.typography.xs.copyWith(
                          color: theme.colors.mutedForeground,
                          fontSize: 10,
                        ),
                      ),
                    ],
                  ),
                ],
              ),

              // Mode breakdown
              if (hasSingle || hasMulti) ...[
                const SizedBox(height: 16),
                Row(
                  children: [
                    if (hasSingle)
                      Expanded(
                        child: _modeCard(
                          theme,
                          l10n.playerModeSingle,
                          _formatDuration(singleDuration),
                          session.singleRoundedHours != null && session.singleRoundedHours! > 0
                              ? _formatRoundedHours(session.singleRoundedHours!, hSuffix)
                              : null,
                          theme.colors.primary,
                        ),
                      ),
                    if (hasSingle && hasMulti)
                      const SizedBox(width: 12),
                    if (hasMulti)
                      Expanded(
                        child: _modeCard(
                          theme,
                          l10n.playerModeMulti,
                          _formatDuration(multiDuration),
                          session.multiRoundedHours != null && session.multiRoundedHours! > 0
                              ? _formatRoundedHours(session.multiRoundedHours!, hSuffix)
                              : null,
                          Colors.orange,
                        ),
                      ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _modeCard(FThemeData theme, String label, String duration, String? roundedHours, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.15)),
      ),
      child: Column(
        children: [
          AppText(
            duration,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w600,
              color: color,
              fontFamily: 'monospace',
              letterSpacing: 1,
            ),
          ),
          if (roundedHours != null) ...[
            const SizedBox(height: 2),
            AppText(
              roundedHours,
              style: theme.typography.xs.copyWith(
                color: color.withValues(alpha: 0.6),
              ),
            ),
          ],
          const SizedBox(height: 4),
          AppText(
            label,
            style: theme.typography.xs.copyWith(
              color: color.withValues(alpha: 0.8),
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}

/// Format duration as HH:MM:SS
String _formatDuration(Duration d) {
  final hours = d.inHours.toString().padLeft(2, '0');
  final minutes = (d.inMinutes % 60).toString().padLeft(2, '0');
  final seconds = (d.inSeconds % 60).toString().padLeft(2, '0');
  return '$hours:$minutes:$seconds';
}

/// Format rounded hours: show "3h" for whole, "3.25h" / "3.5h" / "3.75h" for fractions
String _formatRoundedHours(double hours, String suffix) {
  if (hours % 1 == 0) return '${hours.toInt()} $suffix';
  // Remove trailing zeros: 3.50 -> 3.5, 2.25 -> 2.25
  final str = hours.toStringAsFixed(2);
  final trimmed = str.replaceAll(RegExp(r'0+$'), '').replaceAll(RegExp(r'\.$'), '');
  return '$trimmed $suffix';
}

/// Countdown timer widget for reservation expiration
class _ExpirationCountdown extends StatelessWidget {
  final RoomSession session;

  const _ExpirationCountdown({required this.session});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final remaining = session.timeUntilExpiration;

    if (remaining == null) return const SizedBox.shrink();

    // Determine urgency level
    final isExpired = remaining.inSeconds <= 0;
    final isUrgent = remaining.inMinutes < 5;

    Color bgColor;
    Color textColor;
    String message;

    if (isExpired) {
      bgColor = theme.colors.destructive.withValues(alpha: 0.15);
      textColor = theme.colors.destructive;
      message = l10n.expiredAutoCancelling;
    } else if (isUrgent) {
      bgColor = theme.colors.destructive.withValues(alpha: 0.1);
      textColor = theme.colors.destructive;
      message = l10n.autoCancelIn(session.formattedCountdown);
    } else {
      bgColor = Colors.orange.withValues(alpha: 0.1);
      textColor = Colors.orange.shade700;
      message = l10n.expiresIn(session.formattedCountdown);
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            isUrgent || isExpired ? Icons.warning_amber_rounded : Icons.timer_outlined,
            size: 16,
            color: textColor,
          ),
          const SizedBox(width: 6),
          AppText(
            message,
            style: theme.typography.sm.copyWith(
              color: textColor,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}

/// Bottom sheet for searching and assigning a customer to an active session
class _AssignCustomerSheet extends ConsumerStatefulWidget {
  final ValueChanged<Customer> onCustomerSelected;
  final Set<String> excludeCustomerIds;

  const _AssignCustomerSheet({
    required this.onCustomerSelected,
    this.excludeCustomerIds = const {},
  });

  @override
  ConsumerState<_AssignCustomerSheet> createState() => _AssignCustomerSheetState();
}

class _AssignCustomerSheetState extends ConsumerState<_AssignCustomerSheet> {
  final _searchController = TextEditingController();
  Timer? _debounce;
  List<Customer> _results = [];
  bool _isSearching = false;
  late final ApiClient _identityApi;

  @override
  void initState() {
    super.initState();
    _identityApi = ref.read(identityApiProvider);
    _searchController.addListener(_onSearchChanged);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.removeListener(_onSearchChanged);
    _searchController.dispose();
    super.dispose();
  }

  void _onSearchChanged() {
    _debounce?.cancel();
    final query = _searchController.text.trim();
    if (query.isEmpty) {
      setState(() {
        _results = [];
        _isSearching = false;
      });
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 300), () => _search(query));
  }

  Future<void> _search(String query) async {
    setState(() => _isSearching = true);
    try {
      final response = await _identityApi.get('/users', queryParameters: {
        'search': query,
        'max': 20,
      });
      final data = response.data as List<dynamic>;
      final users = data
          .map((e) => Customer.fromJson(e as Map<String, dynamic>))
          .where((c) => !widget.excludeCustomerIds.contains(c.id))
          .toList();
      if (mounted) {
        setState(() {
          _results = users;
          _isSearching = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _results = [];
          _isSearching = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;

    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    final bottomPadding = MediaQuery.of(context).viewPadding.bottom;

    return Container(
      decoration: BoxDecoration(
        color: theme.colors.background,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: SafeArea(
        top: false,
        bottom: false,
        child: Padding(
          padding: EdgeInsets.only(bottom: bottomInset + bottomPadding),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Drag handle
              Container(
                margin: const EdgeInsets.only(top: 12, bottom: 8),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: theme.colors.mutedForeground,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),

              // Header
              Padding(
                padding: const EdgeInsets.only(left: 16, right: 16, top: 2, bottom: 8),
                child: Row(
                  children: [
                    Expanded(
                      child: AppText(
                        l10n.addCustomer,
                        style: theme.typography.lg.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                    GestureDetector(
                      onTap: () => Navigator.of(context).pop(),
                      child: Icon(Icons.close, color: theme.colors.mutedForeground),
                    ),
                  ],
                ),
              ),

              // Search field
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: FTextField(
                  control: FTextFieldControl.managed(controller: _searchController),
                  hint: l10n.searchCustomerByName,
                ),
              ),
              const SizedBox(height: 8),

              // Results
              if (_isSearching)
                Padding(
                  padding: const EdgeInsets.all(24),
                  child: Center(child: CircularProgressIndicator(color: theme.colors.primary)),
                )
              else if (_results.isNotEmpty)
                ConstrainedBox(
                  constraints: const BoxConstraints(maxHeight: 300),
                  child: ListView.builder(
                    shrinkWrap: true,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: _results.length,
                    itemBuilder: (context, index) {
                      final customer = _results[index];
                      return ListTile(
                        dense: true,
                        visualDensity: VisualDensity.compact,
                        leading: CircleAvatar(
                          radius: 16,
                          backgroundColor: theme.colors.secondary,
                          child: AppText(
                            customer.initials,
                            style: theme.typography.xs.copyWith(fontWeight: FontWeight.w600),
                          ),
                        ),
                        title: AppText(customer.displayName, style: theme.typography.sm),
                        subtitle: customer.email != null
                            ? AppText(customer.email!,
                                style: theme.typography.xs
                                    .copyWith(color: theme.colors.mutedForeground))
                            : null,
                        onTap: () => widget.onCustomerSelected(customer),
                      );
                    },
                  ),
                )
              else if (_searchController.text.trim().isNotEmpty)
                Padding(
                  padding: const EdgeInsets.all(24),
                  child: AppText(
                    l10n.noCustomersFound,
                    style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground),
                  ),
                ),

              const SizedBox(height: 12),
            ],
          ),
        ),
      ),
    );
  }
}

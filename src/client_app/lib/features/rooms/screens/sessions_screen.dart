import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../core/auth/auth_service.dart';
import '../../../core/models/localized_text.dart';
import '../../../core/providers/branch_provider.dart';
import '../../../core/providers/locale_provider.dart';
import '../../../core/widgets/app_text.dart';
import '../../../l10n/app_localizations.dart';
import '../models/room.dart';
import '../services/room_service.dart';

/// Screen showing user's sessions with Today / Previous tabs
class SessionsScreen extends ConsumerStatefulWidget {
  const SessionsScreen({super.key});

  @override
  ConsumerState<SessionsScreen> createState() => _SessionsScreenState();
}

class _SessionsScreenState extends ConsumerState<SessionsScreen> {
  @override
  void initState() {
    super.initState();
    ref.read(mySessionsProvider.notifier).refresh();
  }

  DateTime _getSessionStart() {
    final branch = ref.read(branchProvider).selectedBranch;
    final startHour = branch?.dayStartHour ?? 17;
    final isOvernight = branch?.isOvernightShift ?? true;
    final now = DateTime.now();
    if (isOvernight) {
      if (now.hour >= startHour) {
        return DateTime(now.year, now.month, now.day, startHour);
      } else {
        final yesterday = now.subtract(const Duration(days: 1));
        return DateTime(yesterday.year, yesterday.month, yesterday.day, startHour);
      }
    } else {
      return DateTime(now.year, now.month, now.day, startHour);
    }
  }

  @override
  Widget build(BuildContext context) {
    final sessionsAsync = ref.watch(mySessionsProvider);
    final currentUserId = ref.watch(authServiceProvider).userId;
    final colors = context.theme.colors;
    final l10n = AppLocalizations.of(context)!;

    return FScaffold(
      child: SafeArea(
        child: Column(
          children: [
            // Header
            Container(
              padding: const EdgeInsets.only(left: 8, right: 16, top: 8, bottom: 8),
              child: Row(
                children: [
                  GestureDetector(
                    onTap: () => context.pop(),
                    child: const Icon(FIcons.arrowLeft, size: 22),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: AppText(
                      l10n.sessions,
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ),
            ),

            // Tabs
            Expanded(
              child: FTabs(
                control: FTabControl.managed(initial: 0),
                children: [
                  FTabEntry(
                    label: Text(l10n.todaysSessions),
                    child: Expanded(
                      child: _TodaySessionsList(
                        sessionsAsync: sessionsAsync,
                        currentUserId: currentUserId,
                        colors: colors,
                        sessionStart: _getSessionStart(),
                        onRefresh: () => ref.read(mySessionsProvider.notifier).refresh(),
                      ),
                    ),
                  ),
                  FTabEntry(
                    label: Text(l10n.previousSessions),
                    child: Expanded(
                      child: _HistorySessionsList(
                        sessionsAsync: sessionsAsync,
                        currentUserId: currentUserId,
                        onRefresh: () => ref.read(mySessionsProvider.notifier).refresh(),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ════════════════════════════════════════════════════════════════════
// Today's Sessions — flat list, time only
// ════════════════════════════════════════════════════════════════════

class _TodaySessionsList extends StatelessWidget {
  final AsyncValue<List<RoomSession>> sessionsAsync;
  final String? currentUserId;
  final dynamic colors;
  final DateTime sessionStart;
  final Future<void> Function() onRefresh;

  const _TodaySessionsList({
    required this.sessionsAsync,
    required this.currentUserId,
    required this.colors,
    required this.sessionStart,
    required this.onRefresh,
  });

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;

    return sessionsAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => _buildError(l10n),
      data: (allSessions) {
        final sessions = allSessions.where((s) {
          final time = s.actualStartTime ?? s.createdAt;
          return time.isAfter(sessionStart);
        }).toList();

        if (sessions.isEmpty) {
          return _buildEmpty(l10n.noSessionsToday);
        }

        return RefreshIndicator(
          color: colors.primary,
          backgroundColor: colors.background,
          onRefresh: onRefresh,
          child: ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: sessions.length,
            separatorBuilder: (_, __) => Divider(height: 1, color: colors.border),
            itemBuilder: (context, index) => SessionTile(
              session: sessions[index],
              currentUserId: currentUserId,
              showTimeOnly: true,
            ),
          ),
        );
      },
    );
  }

  Widget _buildError(AppLocalizations l10n) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(FIcons.circleAlert, size: 48, color: colors.mutedForeground),
          const SizedBox(height: 16),
          AppText(l10n.failedToLoadSessions, style: TextStyle(color: colors.foreground)),
          const SizedBox(height: 16),
          FButton(onPress: onRefresh, child: AppText(l10n.retry)),
        ],
      ),
    );
  }

  Widget _buildEmpty(String message) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(FIcons.gamepad2, size: 80, color: colors.mutedForeground),
          const SizedBox(height: 16),
          AppText(message, style: TextStyle(fontSize: 18, color: colors.foreground)),
        ],
      ),
    );
  }
}

// ════════════════════════════════════════════════════════════════════
// Previous Sessions — grouped by shift date
// ════════════════════════════════════════════════════════════════════

class _HistorySessionsList extends ConsumerWidget {
  final AsyncValue<List<RoomSession>> sessionsAsync;
  final String? currentUserId;
  final Future<void> Function() onRefresh;

  const _HistorySessionsList({
    required this.sessionsAsync,
    required this.currentUserId,
    required this.onRefresh,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.theme.colors;
    final l10n = AppLocalizations.of(context)!;
    final locale = ref.watch(localeProvider);

    return sessionsAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(FIcons.circleAlert, size: 48, color: colors.mutedForeground),
            const SizedBox(height: 16),
            AppText(l10n.failedToLoadSessions, style: TextStyle(color: colors.foreground)),
            const SizedBox(height: 16),
            FButton(onPress: onRefresh, child: AppText(l10n.retry)),
          ],
        ),
      ),
      data: (sessions) {
        if (sessions.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(FIcons.gamepad2, size: 80, color: colors.mutedForeground),
                const SizedBox(height: 16),
                AppText(l10n.noSessionsYet, style: TextStyle(fontSize: 18, color: colors.foreground)),
              ],
            ),
          );
        }

        final groups = _groupByShift(sessions, locale, l10n, ref);

        return RefreshIndicator(
          color: colors.primary,
          backgroundColor: colors.background,
          onRefresh: onRefresh,
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              for (final group in groups) ...[
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                    child: AppText(
                      group.label,
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: colors.mutedForeground),
                    ),
                  ),
                ),
                SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, index) => Column(
                      children: [
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          child: SessionTile(
                            session: group.sessions[index],
                            currentUserId: currentUserId,
                            showTimeOnly: true,
                          ),
                        ),
                        if (index < group.sessions.length - 1)
                          Divider(height: 1, color: colors.border, indent: 16, endIndent: 16),
                      ],
                    ),
                    childCount: group.sessions.length,
                  ),
                ),
              ],
              const SliverPadding(padding: EdgeInsets.only(bottom: 16)),
            ],
          ),
        );
      },
    );
  }

  List<_ShiftGroup> _groupByShift(
    List<RoomSession> sessions,
    Locale locale,
    AppLocalizations l10n,
    WidgetRef ref,
  ) {
    final groups = <String, _ShiftGroup>{};
    final now = DateTime.now();
    final dateFormat = DateFormat('EEEE, MMM d', locale.languageCode);
    final branch = ref.read(branchProvider).selectedBranch;
    final startHour = branch?.dayStartHour ?? 17;
    final isOvernight = branch?.isOvernightShift ?? true;

    for (final session in sessions) {
      final sessionTime = (session.actualStartTime ?? session.createdAt).toLocal();
      final shiftDate = isOvernight && sessionTime.hour < startHour
          ? DateTime(sessionTime.year, sessionTime.month, sessionTime.day - 1)
          : DateTime(sessionTime.year, sessionTime.month, sessionTime.day);

      final key = '${shiftDate.year}-${shiftDate.month}-${shiftDate.day}';

      if (!groups.containsKey(key)) {
        final todayShift = isOvernight && now.hour < startHour
            ? DateTime(now.year, now.month, now.day - 1)
            : DateTime(now.year, now.month, now.day);
        final yesterdayShift = todayShift.subtract(const Duration(days: 1));

        String label;
        if (_sameDay(shiftDate, todayShift)) {
          label = l10n.today;
        } else if (_sameDay(shiftDate, yesterdayShift)) {
          label = l10n.yesterday;
        } else {
          label = dateFormat.format(shiftDate);
        }
        groups[key] = _ShiftGroup(label: label, sessions: []);
      }
      groups[key]!.sessions.add(session);
    }
    return groups.values.toList();
  }

  bool _sameDay(DateTime a, DateTime b) =>
      a.year == b.year && a.month == b.month && a.day == b.day;
}

class _ShiftGroup {
  final String label;
  final List<RoomSession> sessions;
  _ShiftGroup({required this.label, required this.sessions});
}

// ════════════════════════════════════════════════════════════════════
// Session Tile
// ════════════════════════════════════════════════════════════════════

class SessionTile extends StatefulWidget {
  final RoomSession session;
  final String? currentUserId;
  final bool showTimeOnly;

  const SessionTile({
    super.key,
    required this.session,
    this.currentUserId,
    this.showTimeOnly = false,
  });

  @override
  State<SessionTile> createState() => _SessionTileState();
}

class _SessionTileState extends State<SessionTile> {
  late final bool _isActive;

  @override
  void initState() {
    super.initState();
    _isActive = widget.session.status == SessionStatus.active;
    if (_isActive) {
      _startTimer();
    }
  }

  void _startTimer() {
    Future.doWhile(() async {
      await Future.delayed(const Duration(seconds: 1));
      if (!mounted) return false;
      setState(() {});
      return _isActive && mounted;
    });
  }

  /// The colour of a rate option by its place in the tariff: the first reads
  /// as the base rate, any other as the upgrade — the way Single and Multi
  /// always did.
  Color _optionColor(SessionSegment segment, dynamic colors) =>
      widget.session.optionIndex(segment.optionCode) > 0 ? Colors.orange : colors.primary as Color;

  String _segmentDuration(SessionSegment segment, AppLocalizations l10n) {
    final end = segment.endTime ?? DateTime.now();
    final d = end.difference(segment.startTime);
    final h = d.inHours;
    final m = d.inMinutes % 60;
    if (h > 0) return '${l10n.hoursShort(h)} ${l10n.minutesShort(m)}';
    return l10n.minutesShort(m);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.theme.colors;
    final session = widget.session;
    final locale = Localizations.localeOf(context).languageCode;
    final l10n = AppLocalizations.of(context)!;
    final timeFormat = DateFormat('h:mm a', locale);

    final otherMembers = session.members
        .where((m) => m.customerId != widget.currentUserId)
        .toList();

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header: room name + status badge
          Row(
            children: [
              Icon(session.placeKind.icon, size: 20, color: colors.foreground),
              const SizedBox(width: 8),
              Expanded(
                child: AppText(
                  session.roomName.localized(context),
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                    color: colors.foreground,
                  ),
                ),
              ),
              session.paidAt != null ? _buildPaidBadge(session, l10n) : _buildStatusBadge(session.status),
            ],
          ),
          const SizedBox(height: 8),

          // Time + duration row
          Row(
            children: [
              Icon(FIcons.clock, size: 14, color: colors.mutedForeground),
              const SizedBox(width: 4),
              AppText(
                timeFormat.format(session.reservationTime.toLocal()),
                style: TextStyle(color: colors.mutedForeground, fontSize: 13),
              ),
              if (session.duration != null) ...[
                const SizedBox(width: 12),
                Icon(FIcons.timer, size: 14, color: colors.mutedForeground),
                const SizedBox(width: 4),
                AppText(
                  session.formattedDuration,
                  style: TextStyle(color: colors.mutedForeground, fontSize: 13),
                ),
              ],
              if (session.totalCost != null) ...[
                const Spacer(),
                AppText(
                  l10n.priceFormat(session.totalCost!.toStringAsFixed(2)),
                  style: TextStyle(color: colors.mutedForeground, fontSize: 13, fontWeight: FontWeight.w500),
                ),
              ],
            ],
          ),

          // Segments timeline — only where the tariff has a choice of rates;
          // a one-rate place has nothing to tell apart
          if (session.hasOptions && session.segments.length > 1) ...[
            const SizedBox(height: 8),
            ...session.segments.asMap().entries.map((entry) {
              final i = entry.key;
              final segment = entry.value;
              final isLast = i == session.segments.length - 1;
              final optionColor = _optionColor(segment, colors);

              return IntrinsicHeight(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Timeline track
                    SizedBox(
                      width: 24,
                      child: Column(
                        children: [
                          Container(
                            width: 8,
                            height: 8,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: optionColor,
                            ),
                          ),
                          if (!isLast)
                            Expanded(
                              child: Container(
                                width: 1.5,
                                color: colors.border,
                              ),
                            ),
                        ],
                      ),
                    ),
                    // Segment info
                    Expanded(
                      child: Padding(
                        padding: EdgeInsets.only(bottom: isLast ? 0 : 6),
                        child: Row(
                          children: [
                            AppText(
                              segment.optionName.localized(context),
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w500,
                                color: optionColor,
                              ),
                            ),
                            const SizedBox(width: 8),
                            AppText(
                              '${timeFormat.format(segment.startTime.toLocal())} · ${_segmentDuration(segment, l10n)}',
                              style: TextStyle(
                                fontSize: 12,
                                color: colors.mutedForeground,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              );
            }),
          ] else if (session.hasOptions && session.segments.length == 1) ...[
            // One segment — just the option badge inline
            const SizedBox(height: 4),
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: _optionColor(session.segments.first, colors).withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: AppText(
                    session.segments.first.optionName.localized(context),
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: _optionColor(session.segments.first, colors),
                    ),
                  ),
                ),
              ],
            ),
          ],

          // Other members
          if (otherMembers.isNotEmpty) ...[
            const SizedBox(height: 6),
            Row(
              children: [
                Icon(FIcons.users, size: 14, color: colors.mutedForeground),
                const SizedBox(width: 4),
                Expanded(
                  child: AppText(
                    otherMembers.map((m) => m.customerName ?? '?').join(', '),
                    style: TextStyle(color: colors.mutedForeground, fontSize: 13),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  /// Sales' receipt, projected onto the session by Spaces
  Widget _buildPaidBadge(RoomSession session, AppLocalizations l10n) {
    final receipt = session.receiptNumber != null ? ' ${l10n.receiptShort(session.receiptNumber!)}' : '';
    final label = session.paidWith == 'Account' ? l10n.onYourTab : l10n.paid;
    return GestureDetector(
      onTap: session.ticketId != null ? () => context.push('/receipts/${session.ticketId}') : null,
      child: FBadge(variant: FBadgeVariant.secondary, child: Text('$label$receipt')),
    );
  }

  Widget _buildStatusBadge(SessionStatus status) {
    final l10n = AppLocalizations.of(context)!;
    String label;
    switch (status) {
      case SessionStatus.reserved:
        label = l10n.statusReserved;
        return FBadge(variant: FBadgeVariant.secondary, child: Text(label));
      case SessionStatus.active:
        label = l10n.statusActive;
        return FBadge(child: Text(label));
      case SessionStatus.completed:
        label = l10n.statusCompleted;
        return FBadge(variant: FBadgeVariant.outline, child: Text(label));
      case SessionStatus.cancelled:
        label = l10n.statusCancelled;
        return FBadge(variant: FBadgeVariant.destructive, child: Text(label));
    }
  }
}

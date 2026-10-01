import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/models/branch.dart';
import '../../../core/ui/ui.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../core/auth/auth_service.dart';
import '../../../core/models/localized_text.dart';
import '../../../core/providers/branch_provider.dart';
import '../../../core/providers/locale_provider.dart';
import '../../../core/widgets/app_text.dart';
import '../../../l10n/app_localizations.dart';
import '../../../core/utils/money.dart';
import '../models/place.dart';
import '../services/place_service.dart';

/// Screen showing user's sessions with Today / Previous tabs
class StaysScreen extends ConsumerStatefulWidget {
  const StaysScreen({super.key});

  @override
  ConsumerState<StaysScreen> createState() => _StaysScreenState();
}

class _StaysScreenState extends ConsumerState<StaysScreen> {
  @override
  Widget build(BuildContext context) {
    final stays = ref.watch(myStaysProvider);
    final currentUserId = ref.watch(authServiceProvider).userId;
    final l10n = AppLocalizations.of(context)!;
    final c = context.theme.colors;
    final locale = ref.watch(localeProvider);
    Future<void> refresh() => ref.read(myStaysProvider.notifier).refresh();

    final List<Widget> children = stays.when(
      skipLoadingOnRefresh: true,
      loading: () => [
        for (var i = 0; i < 3; i++) Container(height: 120, decoration: BoxDecoration(color: c.muted, borderRadius: BorderRadius.circular(Ninja.panelRadius))),
      ],
      error: (_, _) => [
        EmptyState(
          icon: LucideIcons.circleAlert,
          title: l10n.failedToLoadSessions,
          action: NinjaButton(variant: NinjaButtonVariant.outline, mainAxisSize: MainAxisSize.min, onPress: refresh, child: AppText(l10n.retry)),
        ),
      ],
      data: (list) => list.isEmpty
          ? [EmptyState(icon: LucideIcons.gamepad2, title: l10n.noSessionsYet)]
          : [
              // All of them in one list by shift day, newest first, each a card (a running one the slab)
              for (final group in _groupByShift(list, locale, l10n, ref.read(branchProvider).selectedBranch))
                Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    SectionLabel(group.label),
                    for (final (i, stay) in group.sessions.indexed) ...[
                      if (i > 0) const SizedBox(height: 12),
                      stay.status == StayStatus.active
                          ? SlabCard(child: SessionTile(session: stay, currentUserId: currentUserId, showTimeOnly: true))
                          : Panel(padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8), child: SessionTile(session: stay, currentUserId: currentUserId, showTimeOnly: true)),
                    ],
                  ],
                ),
            ],
    );

    return NinjaPage(title: l10n.sessions, back: true, onRefresh: refresh, children: children);
  }
}

/// Stays by the branch's shift day: an overnight shift's small hours are the day before
List<_ShiftGroup> _groupByShift(List<Stay> sessions, Locale locale, AppLocalizations l10n, Branch? branch) {
  final groups = <String, _ShiftGroup>{};
  final now = DateTime.now();
  final dateFormat = DateFormat('EEEE, MMM d', locale.languageCode);
  final startHour = branch?.dayStartHour ?? 17;
  final overnight = branch?.isOvernightShift ?? true;
  DateTime shiftOf(DateTime t) => overnight && t.hour < startHour ? DateTime(t.year, t.month, t.day - 1) : DateTime(t.year, t.month, t.day);
  final today = shiftOf(now);
  final yesterday = DateTime(today.year, today.month, today.day - 1);

  for (final session in sessions) {
    final day = shiftOf((session.startedAt ?? session.createdAt).toLocal());
    final key = '${day.year}-${day.month}-${day.day}';
    groups.putIfAbsent(
      key,
      () => _ShiftGroup(
        label: day == today
            ? l10n.today
            : day == yesterday
                ? l10n.yesterday
                : dateFormat.format(day),
        sessions: [],
      ),
    );
    groups[key]!.sessions.add(session);
  }
  return groups.values.toList();
}

class _ShiftGroup {
  final String label;
  final List<Stay> sessions;
  _ShiftGroup({required this.label, required this.sessions});
}

// ════════════════════════════════════════════════════════════════════
// Session Tile
// ════════════════════════════════════════════════════════════════════

class SessionTile extends ConsumerStatefulWidget {
  final Stay session;
  final String? currentUserId;
  final bool showTimeOnly;

  const SessionTile({
    super.key,
    required this.session,
    this.currentUserId,
    this.showTimeOnly = false,
  });

  @override
  ConsumerState<SessionTile> createState() => _SessionTileState();
}

class _SessionTileState extends ConsumerState<SessionTile> {
  late final bool _isActive;

  @override
  void initState() {
    super.initState();
    _isActive = widget.session.status == StayStatus.active;
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
  Color _optionColor(StaySegment segment, dynamic colors) =>
      widget.session.optionIndex(segment.optionCode) > 0 ? Colors.orange : colors.primary as Color;

  String _segmentDuration(StaySegment segment, AppLocalizations l10n) {
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
                  session.placeName.localized(context),
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
              Icon(LucideIcons.clock, size: 14, color: colors.mutedForeground),
              const SizedBox(width: 4),
              AppText(
                timeFormat.format(session.reservationTime.toLocal()),
                style: TextStyle(color: colors.mutedForeground, fontSize: 13),
              ),
              if (session.duration != null) ...[
                const SizedBox(width: 12),
                Icon(LucideIcons.timer, size: 14, color: colors.mutedForeground),
                const SizedBox(width: 4),
                AppText(
                  session.formattedDuration,
                  style: TextStyle(color: colors.mutedForeground, fontSize: 13),
                ),
              ],
              if (session.totalCost != null) ...[
                const Spacer(),
                AppText(
                  ref.watch(moneyProvider)(session.totalCost!),
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
                Icon(LucideIcons.users, size: 14, color: colors.mutedForeground),
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
  Widget _buildPaidBadge(Stay session, AppLocalizations l10n) {
    final receipt = session.receiptNumber != null ? ' ${l10n.receiptShort(session.receiptNumber!)}' : '';
    final label = session.paidWith == 'Account' ? l10n.onYourTab : l10n.paid;
    return GestureDetector(
      onTap: session.ticketId != null ? () => context.push('/receipts/${session.ticketId}') : null,
      child: NinjaBadge(variant: NinjaBadgeVariant.secondary, child: Text('$label$receipt')),
    );
  }

  Widget _buildStatusBadge(StayStatus status) {
    final l10n = AppLocalizations.of(context)!;
    String label;
    switch (status) {
      case StayStatus.active:
        label = l10n.statusActive;
        return NinjaBadge(child: Text(label));
      case StayStatus.completed:
        label = l10n.statusCompleted;
        return NinjaBadge(variant: NinjaBadgeVariant.outline, child: Text(label));
      case StayStatus.cancelled:
        label = l10n.statusCancelled;
        return NinjaBadge(variant: NinjaBadgeVariant.destructive, child: Text(label));
    }
  }
}

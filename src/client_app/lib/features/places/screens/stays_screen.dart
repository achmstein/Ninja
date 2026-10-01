import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/models/branch.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme_provider.dart';
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
                      StayCard(stay: stay, currentUserId: currentUserId),
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

/// One stay in the history (client_web's stay-card.tsx): the place and
/// where it stands, how long it ran large with when, what it came to, the
/// rates it ran at, and who else was there. A running one is the dark slab
/// with its time rolling; the rest are light cards. Where the rate changed
/// along the way, a bar split by how long each rate ran shows it at a glance,
/// drawn in from the start when the card arrives.
class StayCard extends ConsumerStatefulWidget {
  final Stay stay;
  final String? currentUserId;

  const StayCard({super.key, required this.stay, this.currentUserId});

  @override
  ConsumerState<StayCard> createState() => _StayCardState();
}

class _StayCardState extends ConsumerState<StayCard> {
  Timer? _tick;

  @override
  void initState() {
    super.initState();
    // Ticks while the stay runs, so its length moves
    if (widget.stay.status == StayStatus.active) {
      _tick = Timer.periodic(const Duration(seconds: 1), (_) {
        if (mounted) setState(() {});
      });
    }
  }

  @override
  void dispose() {
    _tick?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final stay = widget.stay;
    final active = stay.status == StayStatus.active;
    final theme = context.theme;
    final face = Builder(builder: (context) => _face(context, stay, active));
    return active
        ? SlabCard(child: face)
        : Container(clipBehavior: Clip.antiAlias, padding: const EdgeInsets.all(20), decoration: theme.surface(radius: Ninja.panelRadius), child: face);
  }

  Widget _face(BuildContext context, Stay stay, bool active) {
    final l10n = AppLocalizations.of(context)!;
    final theme = context.theme;
    final c = theme.colors;
    final money = ref.watch(moneyProvider);
    final locale = Localizations.localeOf(context).languageCode;
    String timeOf(DateTime t) => DateFormat('h:mm a', locale).format(t.toLocal());
    int minutesOf(DateTime start, DateTime? end) => ((end ?? DateTime.now()).difference(start).inMinutes).clamp(0, 1 << 30);
    String durationOf(DateTime start, DateTime? end) {
      final minutes = minutesOf(start, end);
      final h = minutes ~/ 60, m = minutes % 60;
      return h > 0 ? '${l10n.hoursShort(h)} ${l10n.minutesShort(m)}' : l10n.minutesShort(m);
    }

    // The base rate wears the business's colour, which the slab is made of: on it, the slab's own ink instead
    Color colorOf(String code) => stay.optionIndex(code) > 0 ? NinjaColors.otherRate : (active ? c.foreground : c.primary);
    final start = stay.startedAt ?? stay.createdAt;
    // A stay cancelled before its clock started has no length to show
    final duration = stay.startedAt != null ? durationOf(stay.startedAt!, stay.endTime) : null;
    final segments = stay.segments;
    final caption = context.localeText(theme.typography.caption.copyWith(color: c.mutedForeground));
    // Who played with you: the owner first, then in the order they joined
    final others = stay.members.where((m) => m.customerId != widget.currentUserId).toList()
      ..sort((a, b) => a.isOwner == b.isOwner ? 0 : (a.isOwner ? -1 : 1));

    return Stack(
      clipBehavior: Clip.none,
      children: [
        PositionedDirectional(
          end: -20,
          bottom: -24,
          child: Transform.rotate(
            angle: -0.21,
            child: Icon(stay.placeKind.icon, size: 128, color: c.foreground.withValues(alpha: active ? 0.08 : 0.05)),
          ),
        ),
        Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Icon(stay.placeKind.icon, size: 16, color: c.foreground),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    stay.placeName.localized(context),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: context.localeText(theme.typography.body.copyWith(fontWeight: FontWeight.w600, color: c.foreground)),
                  ),
                ),
                const SizedBox(width: 8),
                _StatusChip(stay: stay),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (duration != null)
                        active
                            ? RollingNumber(
                                duration,
                                value: minutesOf(stay.startedAt!, null).toDouble(),
                                style: context.localeText(theme.typography.display.copyWith(fontWeight: FontWeight.w800, color: c.foreground, height: 1.15)),
                              )
                            : Text(
                                duration,
                                style: context.localeText(theme.typography.display.copyWith(fontWeight: FontWeight.w800, color: c.foreground, height: 1.15)),
                              ),
                      Row(
                        children: [
                          Icon(LucideIcons.clock, size: 14, color: c.mutedForeground),
                          const SizedBox(width: 4),
                          Flexible(
                            child: Text(
                              '${timeOf(start)}${stay.endTime != null ? ' – ${timeOf(stay.endTime!)}' : ''}',
                              style: caption.copyWith(fontFeatures: NinjaTypography.tabular),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                if (stay.totalCost != null) ...[
                  const SizedBox(width: 12),
                  Text(
                    money(stay.totalCost!),
                    style: context.localeText(theme.typography.headline.copyWith(fontWeight: FontWeight.w700, color: c.foreground, fontFeatures: NinjaTypography.tabular)),
                  ),
                ],
              ],
            ),
            // A one-rate place has nothing to tell apart: no option pill, no bar
            if (stay.hasOptions && segments.length > 1) ...[
              const SizedBox(height: 12),
              _RateBar(
                segments: segments,
                weight: (s) => minutesOf(s.startTime, s.endTime).clamp(1, 1 << 30),
                colorOf: colorOf,
                line: (s) => '${timeOf(s.startTime)} · ${durationOf(s.startTime, s.endTime)}',
              ),
            ] else if (stay.hasOptions && segments.length == 1) ...[
              const SizedBox(height: 12),
              Align(
                alignment: AlignmentDirectional.centerStart,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
                  decoration: ShapeDecoration(color: colorOf(segments.first.optionCode).withValues(alpha: 0.1), shape: const StadiumBorder()),
                  child: Text(
                    segments.first.optionName.localized(context),
                    style: context.localeText(theme.typography.caption.copyWith(fontWeight: FontWeight.w600, color: colorOf(segments.first.optionCode))),
                  ),
                ),
              ),
            ],
            if (others.isNotEmpty) ...[
              const SizedBox(height: 12),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(LucideIcons.users, size: 14, color: c.mutedForeground),
                      const SizedBox(width: 4),
                      Text(l10n.ninjaPlayedWith, style: caption),
                      const SizedBox(width: 4),
                    ],
                  ),
                  for (final member in others)
                    Builder(builder: (context) {
                      final name = (member.customerName?.trim().isNotEmpty ?? false) ? member.customerName!.trim() : '?';
                      return Container(
                        padding: const EdgeInsetsDirectional.fromSTEB(2, 2, 10, 2),
                        decoration: ShapeDecoration(color: active ? c.foreground.withValues(alpha: 0.12) : c.background, shape: const StadiumBorder()),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 20,
                              height: 20,
                              alignment: Alignment.center,
                              decoration: BoxDecoration(color: c.foreground, shape: BoxShape.circle),
                              child: Text(
                                name.characters.first.toUpperCase(),
                                style: theme.typography.micro.copyWith(fontWeight: FontWeight.w700, color: c.background),
                              ),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              name.split(' ').first,
                              style: context.localeText(theme.typography.caption.copyWith(fontWeight: FontWeight.w600, color: c.foreground)),
                            ),
                          ],
                        ),
                      );
                    }),
                ],
              ),
            ],
          ],
        ),
      ],
    );
  }
}

/// The rates a stay ran at: a bar split by how long each ran, drawn in from the start as the card
/// arrives, and each one under it with when it started and for how long
class _RateBar extends StatelessWidget {
  final List<StaySegment> segments;
  final int Function(StaySegment) weight;
  final Color Function(String code) colorOf;
  final String Function(StaySegment) line;

  const _RateBar({required this.segments, required this.weight, required this.colorOf, required this.line});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final c = theme.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TweenAnimationBuilder<double>(
          tween: Tween(begin: 0, end: 1),
          duration: Motion.slow * 2,
          curve: Motion.enter,
          builder: (context, t, child) => Align(alignment: AlignmentDirectional.centerStart, widthFactor: 1, child: FractionallySizedBox(widthFactor: t, child: child)),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: SizedBox(
              height: 8,
              child: Row(
                children: [
                  for (final (i, s) in segments.indexed) ...[
                    if (i > 0) const SizedBox(width: 2),
                    Expanded(
                      flex: weight(s),
                      child: DecoratedBox(decoration: BoxDecoration(color: colorOf(s.optionCode), borderRadius: BorderRadius.circular(999))),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: 8),
        for (final s in segments)
          Padding(
            padding: const EdgeInsets.only(bottom: 2),
            child: Row(
              children: [
                Container(width: 8, height: 8, decoration: BoxDecoration(color: colorOf(s.optionCode), shape: BoxShape.circle)),
                const SizedBox(width: 8),
                Text(
                  s.optionName.localized(context),
                  style: context.localeText(theme.typography.caption.copyWith(fontWeight: FontWeight.w600, color: colorOf(s.optionCode))),
                ),
                const SizedBox(width: 8),
                Flexible(
                  child: Text(
                    line(s),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: context.localeText(theme.typography.caption.copyWith(color: c.mutedForeground, fontFeatures: NinjaTypography.tabular)),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

/// Paid (a tap opens the receipt), running, done or cancelled
class _StatusChip extends StatelessWidget {
  final Stay stay;

  const _StatusChip({required this.stay});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final theme = context.theme;
    final c = theme.colors;
    Widget chip(String label, Color fill, Color ink, {bool dot = false}) => Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: ShapeDecoration(color: fill, shape: const StadiumBorder()),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (dot) ...[LiveDot(size: 6, color: ink), const SizedBox(width: 6)],
              Text(label, style: context.localeText(theme.typography.caption.copyWith(fontWeight: FontWeight.w700, color: ink, fontFeatures: NinjaTypography.tabular))),
            ],
          ),
        );
    final green = c.brightness == Brightness.dark ? NinjaColors.success : NinjaColors.successInk;
    if (stay.paidAt != null) {
      // Sales' receipt, projected onto the stay by Spaces
      final receipt = stay.receiptNumber != null ? ' ${l10n.receiptShort(stay.receiptNumber!)}' : '';
      return GestureDetector(
        onTap: stay.ticketId != null ? () => context.push('/receipts/${stay.ticketId}') : null,
        child: chip('${stay.paidWith == 'Account' ? l10n.onYourTab : l10n.paid}$receipt', NinjaColors.successSolid.withValues(alpha: 0.12), green),
      );
    }
    return switch (stay.status) {
      StayStatus.active => chip(l10n.statusActive, NinjaColors.successSolid.withValues(alpha: 0.15), NinjaColors.successSolid, dot: true),
      StayStatus.cancelled => chip(l10n.statusCancelled, c.destructive.withValues(alpha: 0.1), c.destructive),
      StayStatus.completed => chip(l10n.statusCompleted, c.muted, c.mutedForeground),
    };
  }
}

import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart' show DateFormat;

import '../../../core/brand/brand_provider.dart';
import '../../../core/brand/brand_style.dart';
import '../../../core/models/localized_text.dart';
import '../../../core/motion/motion.dart';
import '../../../core/providers/branch_provider.dart';
import '../../../core/theme/theme_provider.dart';
import '../../../core/ui/ui.dart';
import '../../../l10n/app_localizations.dart';
import '../models/place.dart';
import '../services/place_service.dart';

/// Under this many seconds left, the ring and the time turn to a warning
const _hurry = 120;

/// The customer's hold on a place, while they walk over (client_web's
/// reservation.tsx and reservation-face.tsx): the Book tab becomes one dark
/// slab between the top bar and the dock, the hold's time running down round
/// a ring, the place, what to do, and the way to cancel.
class ReservationPanel extends ConsumerStatefulWidget {
  final Reservation reservation;

  const ReservationPanel({super.key, required this.reservation});

  @override
  ConsumerState<ReservationPanel> createState() => _ReservationPanelState();
}

class _ReservationPanelState extends ConsumerState<ReservationPanel> with SingleTickerProviderStateMixin {
  late final Timer _tick;

  /// The parts coming in one after another as the panel opens
  late final AnimationController _enter = AnimationController(vsync: this, duration: const Duration(milliseconds: 900))..forward();

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
    _enter.dispose();
    super.dispose();
  }

  /// One part on its beat: risen and faded in from `at` (0..1 of the entrance)
  Widget _beat(double at, Widget child) => AnimatedBuilder(
        animation: _enter,
        builder: (context, child) {
          final t = Motion.enter.transform(((_enter.value - at) / 0.4).clamp(0.0, 1.0));
          return Opacity(opacity: t, child: Transform.translate(offset: Offset(0, 16 * (1 - t)), child: child));
        },
        child: child,
      );

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final theme = context.theme;
    final c = theme.colors;
    final hold = widget.reservation;
    final locale = Localizations.localeOf(context);
    final business = ref.watch(brandProvider).displayName(locale);
    final now = DateTime.now();
    // The hold's window, from when it was made to when it lapses; nothing where it does not lapse
    final left = hold.expiresAt == null ? null : math.max(0, hold.expiresAt!.difference(now).inMilliseconds / 1000);
    final total = hold.expiresAt == null ? null : math.max(1, hold.expiresAt!.difference(hold.createdAt).inMilliseconds / 1000);
    final hurry = left != null && left <= _hurry;
    final forTime = hold.forTime == null ? null : DateFormat('h:mm a', locale.languageCode).format(hold.forTime!.toLocal());
    const amber = Color(0xFFF59E0B);

    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(color: c.slab, borderRadius: BorderRadius.circular(32), boxShadow: Ninja.slabShadow),
      child: SlabInk(
        child: Builder(builder: (context) {
          final ink = context.theme.colors;
          final muted = context.localeText(theme.typography.note.copyWith(fontWeight: FontWeight.w500, color: ink.mutedForeground));
          return LayoutBuilder(
            builder: (context, box) => SingleChildScrollView(
              child: ConstrainedBox(
                constraints: BoxConstraints(minHeight: box.maxHeight),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 28),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      _beat(
                        0,
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                          decoration: ShapeDecoration(color: NinjaColors.warning.withValues(alpha: 0.15), shape: const StadiumBorder()),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(width: 6, height: 6, decoration: const BoxDecoration(color: amber, shape: BoxShape.circle)),
                              const SizedBox(width: 6),
                              Text(
                                l10n.ninjaHeldFor,
                                style: context.localeText(theme.typography.caption.copyWith(fontWeight: FontWeight.w700, color: amber)),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 24),
                      // What is held, under the time it is held for
                      Column(
                        children: [
                          _beat(
                            0.1,
                            left == null
                                ? Icon(hold.placeKind.icon, size: 64, color: ink.foreground)
                                : _CountdownRing(left: left.toDouble(), total: total!.toDouble(), hurry: hurry, enter: _enter),
                          ),
                          const SizedBox(height: 16),
                          BrandHeading(hold.placeName.localized(context), style: theme.typography.title.copyWith(color: ink.foreground)),
                          if (forTime != null) _beat(0.3, Text(l10n.ninjaHoldFor(forTime), style: muted)),
                        ],
                      ),
                      const SizedBox(height: 24),
                      _beat(
                        0.45,
                        Column(
                          children: [
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(LucideIcons.footprints, size: 16, color: ink.foreground),
                                const SizedBox(width: 8),
                                Flexible(
                                  child: Text(
                                    left == 0 ? l10n.ninjaHoldRanOut(business) : l10n.ninjaHoldWalkOver,
                                    textAlign: TextAlign.center,
                                    style: context.localeText(theme.typography.body.copyWith(fontWeight: FontWeight.w600, color: ink.foreground)),
                                  ),
                                ),
                              ],
                            ),
                            if (hold.startOnConfirm) ...[
                              const SizedBox(height: 8),
                              Wrap(
                                alignment: WrapAlignment.center,
                                crossAxisAlignment: WrapCrossAlignment.center,
                                spacing: 6,
                                runSpacing: 4,
                                children: [
                                  Icon(LucideIcons.timerReset, size: 14, color: ink.mutedForeground),
                                  Text(l10n.timeStartsOnConfirm, style: context.localeText(theme.typography.caption.copyWith(color: ink.mutedForeground))),
                                  // The rate they asked to start at, where the tariff has a choice
                                  if (hold.requestedOptionName != null)
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                      decoration: ShapeDecoration(color: ink.muted, shape: const StadiumBorder()),
                                      child: Text(
                                        hold.requestedOptionName!.localized(context),
                                        style: context.localeText(theme.typography.caption.copyWith(fontWeight: FontWeight.w600, color: ink.foreground)),
                                      ),
                                    ),
                                ],
                              ),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),
                      _beat(0.6, _CancelHold(reservationId: hold.id)),
                    ],
                  ),
                ),
              ),
            ),
          );
        }),
      ),
    );
  }
}

/// The time a hold has left inside a ring that runs down with it. As the
/// panel opens the ring draws itself round to the share left; after that it
/// steps once a second in a short ease.
class _CountdownRing extends StatelessWidget {
  final double left;
  final double total;
  final bool hurry;
  final Animation<double> enter;

  const _CountdownRing({required this.left, required this.total, required this.hurry, required this.enter});

  static const _size = 216.0;

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final c = theme.colors;
    final tone = hurry ? c.destructive : const Color(0xFFFBBF24);
    final seconds = left.ceil();
    final clock = '${(seconds ~/ 60).toString().padLeft(2, '0')}:${(seconds % 60).toString().padLeft(2, '0')}';
    return SizedBox.square(
      dimension: _size,
      child: TweenAnimationBuilder<double>(
        tween: Tween(end: math.max(0.001, left / total)),
        duration: const Duration(milliseconds: 400),
        curve: Curves.easeInOut,
        builder: (context, share, _) => AnimatedBuilder(
          animation: enter,
          builder: (context, _) {
            final drawn = Motion.enter.transform(((enter.value - 0.15) / 0.65).clamp(0.0, 1.0));
            return CustomPaint(
              painter: _RingPainter(share: share * drawn, track: c.foreground.withValues(alpha: 0.12), tone: tone),
              child: Center(
                child: Text(
                  clock,
                  textDirection: TextDirection.ltr,
                  style: TextStyle(
                    fontFamily: theme.typography.display.fontFamily,
                    fontSize: 52,
                    height: 1,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -1,
                    color: hurry ? c.destructive : c.foreground,
                    fontFeatures: NinjaTypography.tabular,
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  final double share;
  final Color track;
  final Color tone;

  const _RingPainter({required this.share, required this.track, required this.tone});

  static const _stroke = 10.0;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Rect.fromCircle(center: size.center(Offset.zero), radius: (size.width - _stroke) / 2);
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = _stroke;
    canvas.drawArc(rect, 0, 2 * math.pi, false, paint..color = track);
    if (share <= 0) return;
    canvas.drawArc(rect, -math.pi / 2, 2 * math.pi * share, false, paint
      ..color = tone
      ..strokeCap = StrokeCap.round);
  }

  @override
  bool shouldRepaint(_RingPainter old) => old.share != share || old.tone != tone || old.track != track;
}

/// One button through the whole cancel: the question, a spinner, then the
/// tick; after the tick's beat the hold is read again and the panel goes
class _CancelHold extends ConsumerStatefulWidget {
  final int reservationId;

  const _CancelHold({required this.reservationId});

  @override
  ConsumerState<_CancelHold> createState() => _CancelHoldState();
}

enum _Phase { idle, busy, done }

class _CancelHoldState extends ConsumerState<_CancelHold> {
  _Phase _phase = _Phase.idle;

  Future<void> _cancel() async {
    final l10n = AppLocalizations.of(context)!;
    final yes = await showNinjaSheet<bool>(
      context: context,
      builder: (context) => NinjaDialog(
        title: Text(l10n.cancelReservationQuestion),
        actions: [
          NinjaButton(variant: NinjaButtonVariant.secondary, onPress: () => Navigator.pop(context, false), child: Text(l10n.cancel)),
          NinjaButton(variant: NinjaButtonVariant.destructive, onPress: () => Navigator.pop(context, true), child: Text(l10n.cancelReservation)),
        ],
      ),
    );
    if (yes != true || !mounted) return;
    setState(() => _phase = _Phase.busy);
    try {
      await ref.read(placeRepositoryProvider).cancelHold(widget.reservationId);
      if (!mounted) return;
      setState(() => _phase = _Phase.done);
      await Future<void>.delayed(const Duration(milliseconds: 700));
      ref.invalidate(myReservationsProvider);
      ref.read(myStaysProvider.notifier).refresh();
      final branchId = ref.read(selectedBranchIdProvider);
      if (branchId != null) ref.invalidate(placesProvider(branchId));
    } catch (_) {
      if (!mounted) return;
      setState(() => _phase = _Phase.idle);
      showIsland(
        context: context,
        title: Text(l10n.failedToCancelReservation),
        icon: Icon(LucideIcons.circleX, color: context.theme.colors.destructive),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final theme = context.theme;
    final c = theme.colors;
    final idle = _phase == _Phase.idle;
    return Pressable(
      onTap: idle ? _cancel : null,
      scale: 0.96,
      child: AnimatedContainer(
        duration: Motion.slow,
        curve: Motion.enter,
        width: idle ? 240 : 44,
        height: 44,
        decoration: BoxDecoration(
          // On the dark panel its own light-on-dark, until the tick's green
          color: _phase == _Phase.done ? const Color(0xFF10B981) : c.foreground.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(22),
        ),
        child: Center(
          child: BlurSwap(
            alignment: Alignment.center,
            child: switch (_phase) {
              _Phase.idle => Row(
                  key: const ValueKey('idle'),
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(LucideIcons.x, size: 16, color: c.foreground),
                    const SizedBox(width: 6),
                    Text(l10n.cancelReservation, maxLines: 1, style: context.localeText(theme.typography.note.copyWith(fontWeight: FontWeight.w600, color: c.foreground))),
                  ],
                ),
              _Phase.busy => SizedBox(key: const ValueKey('busy'), width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: c.foreground)),
              _Phase.done => const Icon(LucideIcons.check, key: ValueKey('done'), size: 20, color: Colors.white),
            },
          ),
        ),
      ),
    );
  }
}

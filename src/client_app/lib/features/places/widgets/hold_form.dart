import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/brand/brand_style.dart';
import '../../../core/models/localized_text.dart';
import '../../../core/motion/motion.dart';
import '../../../core/providers/branch_provider.dart';
import '../../../core/services/sound_service.dart';
import '../../../core/theme/theme_provider.dart';
import '../../../core/ui/ui.dart';
import '../../../core/utils/money.dart';
import '../../../core/widgets/profile_gate.dart';
import '../../../l10n/app_localizations.dart';
import '../models/place.dart';
import '../screens/places_screen.dart' show tariffLine;
import '../services/place_service.dart';

/// How long the tick shows before whoever showed the form puts it away
const _successHold = Duration(milliseconds: 700);

/// The book button's height, and so the tick circle's size
const _tick = 48.0;

/// Booking a place (client_web's hold-form.tsx): the window to arrive in, the
/// start-now switch with the rate to start at, one button. It slides in under
/// a place's card on the Book tab, and sits in the sheet a scanned code opens.
/// The button becomes a spinner and then a tick; once the tick has had its
/// beat, [onDone] says how it went and whoever showed the form puts it away.
class HoldForm extends ConsumerStatefulWidget {
  final Place place;

  /// The hold went through (true) or was turned down (false)
  final ValueChanged<bool> onDone;

  const HoldForm({super.key, required this.place, required this.onDone});

  @override
  ConsumerState<HoldForm> createState() => _HoldFormState();
}

enum _Phase { idle, busy, success }

class _HoldFormState extends ConsumerState<HoldForm> {
  bool _startOnConfirm = false;

  /// The rate the clock starts at when it starts on Confirm: the first option until the customer picks another
  String? _optionCode;
  _Phase _phase = _Phase.idle;
  Timer? _done;

  Place get _place => widget.place;
  bool get _pickRate => _startOnConfirm && _place.hasOptions;
  String? get _chosenCode => _optionCode ?? _place.options.firstOrNull?.code;

  @override
  void dispose() {
    _done?.cancel();
    super.dispose();
  }

  void _refresh() {
    final branchId = ref.read(selectedBranchIdProvider);
    if (branchId != null) ref.invalidate(placesProvider(branchId));
    ref.read(myStaysProvider.notifier).refresh();
    ref.invalidate(myReservationsProvider);
  }

  Future<void> _hold() async {
    // A name and a phone to hold it under, first
    if (!await ensureProfileComplete(context, ref)) return;
    if (!mounted) return;
    final l10n = AppLocalizations.of(context)!;
    setState(() => _phase = _Phase.busy);
    final ok = await ref.read(holdProvider.notifier).holdPlace(
          _place.id,
          startOnConfirm: _startOnConfirm,
          optionCode: _pickRate ? _chosenCode : null,
        );
    if (!mounted) return;
    if (ok) {
      setState(() => _phase = _Phase.success);
      SoundService.instance.playSuccess();
      // The tick has its beat, then the hold is read again and the form goes
      _done = Timer(_successHold, () {
        _refresh();
        if (mounted) widget.onDone(true);
      });
    } else {
      setState(() => _phase = _Phase.idle);
      // The server says why, where it can (a double booking, the place just taken)
      final detail = ref.read(holdProvider).detail;
      showIsland(
        context: context,
        title: Text(detail ?? l10n.failedToReserveRoom),
        icon: Icon(LucideIcons.circleX, color: context.theme.colors.destructive),
      );
      _refresh();
      widget.onDone(false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final theme = context.theme;
    final c = theme.colors;
    final money = ref.watch(moneyProvider);
    final note = context.localeText(theme.typography.note.copyWith(fontWeight: FontWeight.w500, color: c.foreground));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(color: c.primary.withValues(alpha: 0.1), shape: BoxShape.circle),
              child: Icon(LucideIcons.clock, size: 20, color: c.primary),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                l10n.fifteenMinutesToArrive,
                style: context.localeText(theme.typography.body.copyWith(fontWeight: FontWeight.w600, color: c.foreground)),
              ),
            ),
          ],
        ),
        // The clock starts the moment the counter confirms, instead of waiting for the cashier. A place with no clock has nothing to start
        if (_place.isTimed) ...[
          const SizedBox(height: 12),
          GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => setState(() => _startOnConfirm = !_startOnConfirm),
            child: Container(
              constraints: const BoxConstraints(minHeight: 48),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(color: c.muted.withValues(alpha: 0.6), borderRadius: BorderRadius.circular(16)),
              child: Row(
                children: [
                  Expanded(child: Text(l10n.startTimeNow, style: note)),
                  NinjaSwitch(value: _startOnConfirm, onChange: (value) => setState(() => _startOnConfirm = value)),
                ],
              ),
            ),
          ),
        ],
        // Which rate the clock starts at, where the tariff has a choice: picked here, so the till confirms without asking
        AnimatedSize(
          duration: Motion.slow,
          curve: Motion.enter,
          alignment: Alignment.topCenter,
          child: !_pickRate
              ? const SizedBox(width: double.infinity)
              : Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Padding(
                        padding: const EdgeInsetsDirectional.only(start: 4, bottom: 8),
                        child: Text(
                          l10n.bookStartAt,
                          style: context.localeText(theme.typography.caption.copyWith(fontWeight: FontWeight.w600, color: c.mutedForeground)),
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.all(4),
                        decoration: BoxDecoration(color: c.muted, borderRadius: BorderRadius.circular(20)),
                        child: Row(
                          children: [
                            for (final (i, option) in _place.options.indexed) ...[
                              if (i > 0) const SizedBox(width: 4),
                              Expanded(child: _rate(option, i, money)),
                            ],
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
        ),
        const SizedBox(height: 16),
        Center(child: _button(l10n)),
      ],
    );
  }

  /// One rate to start at; the one picked stands on a white pill that slides to it
  Widget _rate(RateOption option, int index, MoneyFormat money) {
    final theme = context.theme;
    final c = theme.colors;
    final selected = option.code == _chosenCode;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => setState(() => _optionCode = option.code),
      child: AnimatedContainer(
        duration: Motion.base,
        curve: Motion.enter,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: selected ? c.background : c.background.withValues(alpha: 0),
          borderRadius: BorderRadius.circular(16),
          boxShadow: selected ? const [BoxShadow(color: Color(0x1F000000), blurRadius: 3, offset: Offset(0, 1))] : const [],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                // The first option reads as the base rate, any other as the upgrade
                Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(color: index == 0 ? c.primary : const Color(0xFFF59E0B), shape: BoxShape.circle),
                ),
                const SizedBox(width: 6),
                Flexible(
                  child: Text(
                    option.name.localized(context),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: context.localeText(theme.typography.note.copyWith(fontWeight: FontWeight.w600, color: c.foreground)),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 2),
            Text(
              AppLocalizations.of(context)!.hourlyRateFormat(money.whole(option.hourlyRate)),
              style: theme.typography.caption.copyWith(color: c.mutedForeground, fontFeatures: NinjaTypography.tabular),
            ),
          ],
        ),
      ),
    );
  }

  /// The pill that becomes a spinner and then a tick
  Widget _button(AppLocalizations l10n) {
    final c = context.theme.colors;
    return LayoutBuilder(
      builder: (context, constraints) {
        final idle = _phase == _Phase.idle;
        return Pressable(
          onTap: idle ? _hold : null,
          scale: 0.96,
          child: AnimatedContainer(
            duration: Motion.slow,
            curve: Motion.enter,
            width: idle ? constraints.maxWidth : _tick,
            height: _tick,
            decoration: BoxDecoration(
              color: _phase == _Phase.success ? const Color(0xFF10B981) : c.primary,
              borderRadius: BorderRadius.circular(_tick / 2),
              boxShadow: idle ? Ninja.ctaShadow : const [],
            ),
            child: Center(
              child: BlurSwap(
                alignment: Alignment.center,
                child: switch (_phase) {
                  _Phase.idle => Text(
                      l10n.reserveNow,
                      key: const ValueKey('idle'),
                      maxLines: 1,
                      overflow: TextOverflow.clip,
                      style: context.localeText(context.theme.typography.body.copyWith(fontWeight: FontWeight.w700, color: c.primaryForeground)),
                    ),
                  _Phase.busy => SizedBox(
                      key: const ValueKey('busy'),
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: c.primaryForeground),
                    ),
                  _Phase.success => const Icon(LucideIcons.check, key: ValueKey('success'), size: 24, color: Colors.white),
                },
              ),
            ),
          ),
        );
      },
    );
  }
}

/// Booking a place whose code was just scanned (client_web's hold-sheet.tsx):
/// the place on a card at the top of the sheet, then the same booking that
/// slides in under a card on the tab. It closes itself once the hold went
/// through or was turned down.
Future<void> showHoldSheet(BuildContext context, Place place) => showNinjaSheet<void>(
      context: context,
      padding: const EdgeInsets.fromLTRB(8, 0, 8, 8),
      builder: (context) {
        final theme = context.theme;
        final c = theme.colors;
        return Consumer(builder: (context, ref, _) {
          final l10n = AppLocalizations.of(context)!;
          final rate = tariffLine(context, ref.watch(moneyProvider), place.options);
          return Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(
                clipBehavior: Clip.antiAlias,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(color: c.primary, borderRadius: BorderRadius.circular(22)),
                child: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    PositionedDirectional(
                      end: -24,
                      bottom: -32,
                      child: Transform.rotate(angle: -0.21, child: Icon(place.kind.icon, size: 160, color: c.primaryForeground.withValues(alpha: 0.12))),
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        BrandHeading(l10n.reserveRoomName(place.name.localized(context)), style: theme.typography.headline.copyWith(color: c.primaryForeground)),
                        if (rate.isNotEmpty)
                          Text(rate, style: context.localeText(theme.typography.note.copyWith(color: c.primaryForeground.withValues(alpha: 0.8)))),
                        if (place.description != null)
                          Text(
                            place.description!.localized(context),
                            style: context.localeText(theme.typography.note.copyWith(color: c.primaryForeground.withValues(alpha: 0.8))),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 16, 12, 12),
                child: HoldForm(place: place, onDone: (_) => Navigator.of(context).maybePop()),
              ),
            ],
          );
        });
      },
    );

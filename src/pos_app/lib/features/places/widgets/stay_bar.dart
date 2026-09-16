import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import '../../../core/models/localized_text.dart';
import '../../../core/models/money.dart';
import '../../../core/theme/text_styles.dart';
import '../../../core/widgets/confirm_dialog.dart';
import '../../../l10n/app_localizations.dart';
import '../models/place.dart';
import '../stay_actions.dart';
import '../status.dart';
import 'rate_option_toggle.dart';
import 'stay_members.dart';

/// The running clock on a room ticket. Its time is not on the bill yet —
/// it lands as lines when the session ends — so the card answers the two
/// questions the cashier has while it runs: how long, and how much so far.
/// The mode switches right here (the customers' most common mid-session
/// ask), the people in the room are listed and added right here, and the
/// session ends from here. On the bill itself, customers go on lines with
/// the ticket's own Assign customer. Mirrors pos_web's StayBar.
class StayBar extends ConsumerStatefulWidget {
  final Stay session;

  const StayBar({super.key, required this.session});

  @override
  ConsumerState<StayBar> createState() => _StayBarState();
}

class _StayBarState extends ConsumerState<StayBar> {
  // Started eagerly: a lazy `late final` field is first touched in dispose,
  // so the clock would never tick while the card is on screen
  late final Timer _clock;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _clock = Timer.periodic(const Duration(seconds: 1), (_) => setState(() {}));
  }

  @override
  void dispose() {
    _clock.cancel();
    super.dispose();
  }

  Future<void> _guarded(Future<bool> Function(StayActions actions) call) async {
    if (_busy) return;
    setState(() => _busy = true);
    await call(StayActions(ref, context));
    if (mounted) setState(() => _busy = false);
  }

  Future<void> _confirmOption(String code) async {
    final l10n = AppLocalizations.of(context)!;
    final session = widget.session;
    final current = optionLabel(context, session.options, session.currentOptionCode);
    final next = optionLabel(context, session.options, code);
    final ok = await showConfirmDialog(
      context,
      title: l10n.switchToModeQuestion(next),
      cancelLabel: l10n.keepCurrent(current),
      actionLabel: l10n.switchMode,
    );
    if (ok && mounted) await _guarded((a) => a.changeOption(session.id, code));
  }

  // Ending bills the time; the quiet third answer is the session that
  // should never have started, which still gets its own confirmation
  Future<void> _end(String hoursLabel) async {
    final l10n = AppLocalizations.of(context)!;
    final session = widget.session;
    final ok = await showConfirmDialog(
      context,
      title: l10n.endThisSession,
      description: l10n.endSessionBilledAt(hoursLabel),
      cancelLabel: l10n.keepPlaying,
      actionLabel: l10n.endSessionButton,
      secondaryLabel: l10n.cancelSessionButton,
      onSecondary: _confirmCancel,
    );
    if (ok && mounted) await _guarded((a) => a.endStay(session.id));
  }

  Future<void> _confirmCancel() async {
    final l10n = AppLocalizations.of(context)!;
    final session = widget.session;
    final ok = await showConfirmDialog(
      context,
      title: l10n.cancelThisSession,
      description: l10n.cancelSessionHint,
      cancelLabel: l10n.keepIt,
      actionLabel: l10n.cancelSessionButton,
      destructive: true,
    );
    if (ok && mounted) await _guarded((a) => a.cancelStay(session.id, wasActive: true));
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final session = widget.session;
    final now = DateTime.now();
    final used = session.usedOptions(now);
    final estimate = session.estimate(now);
    final hoursLabel = l10n.billedHoursFormat(hoursText(estimate.hours));
    final muted = theme.typography.sm.copyWith(color: theme.colors.mutedForeground);
    const tabular = [FontFeature.tabularFigures()];

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: theme.colors.background,
        border: Border.all(color: theme.colors.border),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // How long, and how much: the clock leads, the money answers
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // The icon sits on the clock's own line, centred on it,
                    // whatever the font's line height turns out to be
                    Row(
                      children: [
                        Icon(FIcons.timer, size: 24, color: theme.colors.mutedForeground),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(formatClock(session.elapsedSeconds(now)),
                              style: theme.typography.xl3.copyWith(fontFeatures: tabular)),
                        ),
                      ],
                    ),
                    // Per-option split only once more than one has been used
                    if (used.length > 1)
                      Padding(
                        padding: const EdgeInsetsDirectional.only(start: 36),
                        child: Text(
                          used.map((o) => '${o.name.localized(context)} ${formatClock(session.optionSeconds(o.code, now))}').join(' · '),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: muted.copyWith(fontFeatures: tabular),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(l10n.timeSoFar, style: muted),
                  Text(money(context, estimate.amount),
                      style: theme.typography.xl2.copyWith(fontWeight: FontWeight.w700, fontFeatures: tabular)),
                  Text(hoursLabel,
                      style: theme.typography.xs.copyWith(color: theme.colors.mutedForeground, fontFeatures: tabular)),
                ],
              ),
            ],
          ),
          const SizedBox(height: 12),
          StayMembers(session: session),
          const SizedBox(height: 12),
          // Switching the rate is the common ask; ending is the last one
          Row(
            children: [
              if (session.hasOptions) ...[
                Expanded(
                  child: RateOptionToggle(
                    options: session.options,
                    value: session.currentOptionCode,
                    disabled: _busy,
                    onChange: (code) {
                      if (code != session.currentOptionCode) _confirmOption(code);
                    },
                    rates: {for (final o in session.options) o.code: money(context, o.hourlyRate)},
                  ),
                ),
                const SizedBox(width: 8),
              ] else
                const Spacer(),
              SizedBox(
                height: 48,
                child: FButton(
                  variant: FButtonVariant.outline,
                  mainAxisSize: MainAxisSize.min,
                  onPress: _busy ? null : () => _end(hoursLabel),
                  prefix: const Icon(FIcons.square, size: 20),
                  child: Text(l10n.endSessionButton, style: theme.typography.base.forButton),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

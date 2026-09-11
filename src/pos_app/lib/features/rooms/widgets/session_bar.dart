import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import '../../../core/models/money.dart';
import '../../../core/theme/text_styles.dart';
import '../../../core/widgets/confirm_dialog.dart';
import '../../../l10n/app_localizations.dart';
import '../models/room.dart';
import '../session_actions.dart';
import '../status.dart';
import 'player_mode_toggle.dart';
import 'session_members.dart';

/// The running clock on a room ticket. Its time is not on the bill yet —
/// it lands as lines when the session ends — so the card answers the two
/// questions the cashier has while it runs: how long, and how much so far.
/// The mode switches right here (the customers' most common mid-session
/// ask), the people in the room are listed and added right here, and the
/// session ends from here. On the bill itself, customers go on lines with
/// the ticket's own Assign customer. Mirrors pos_web's SessionBar.
class SessionBar extends ConsumerStatefulWidget {
  final RoomSession session;

  const SessionBar({super.key, required this.session});

  @override
  ConsumerState<SessionBar> createState() => _SessionBarState();
}

class _SessionBarState extends ConsumerState<SessionBar> {
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

  Future<void> _guarded(Future<bool> Function(SessionActions actions) call) async {
    if (_busy) return;
    setState(() => _busy = true);
    await call(SessionActions(ref, context));
    if (mounted) setState(() => _busy = false);
  }

  Future<void> _confirmMode(String mode) async {
    final l10n = AppLocalizations.of(context)!;
    final session = widget.session;
    final current = modeLabel(l10n, session.currentPlayerMode);
    final next = modeLabel(l10n, mode);
    final ok = await showConfirmDialog(
      context,
      title: l10n.switchToModeQuestion(next),
      description: l10n.switchModeDescription(current, next),
      cancelLabel: l10n.keepCurrent(current),
      actionLabel: l10n.switchMode,
    );
    if (ok && mounted) await _guarded((a) => a.changeMode(session.id, mode));
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
    if (ok && mounted) await _guarded((a) => a.endSession(session.id));
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
    if (ok && mounted) await _guarded((a) => a.cancelSession(session.id, wasActive: true));
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final session = widget.session;
    final now = DateTime.now();
    final single = session.modeSeconds('Single', now);
    final multi = session.modeSeconds('Multi', now);
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
                    // Per-mode split only once both modes have been used
                    if (single > 0 && multi > 0)
                      Padding(
                        padding: const EdgeInsetsDirectional.only(start: 36),
                        child: Text(
                          '${l10n.playerModeSingle} ${formatClock(single)} · ${l10n.playerModeMulti} ${formatClock(multi)}',
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
          SessionMembers(session: session),
          const SizedBox(height: 12),
          // Switching mode is the common ask; ending is the last one
          Row(
            children: [
              Expanded(
                child: PlayerModeToggle(
                  value: session.currentPlayerMode,
                  disabled: _busy,
                  onChange: (mode) {
                    if (mode != null && mode != session.currentPlayerMode) _confirmMode(mode);
                  },
                  rates: {'Single': money(context, session.singleRate), 'Multi': money(context, session.multiRate)},
                ),
              ),
              const SizedBox(width: 8),
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

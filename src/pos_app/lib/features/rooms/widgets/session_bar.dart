import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import '../../../core/theme/text_styles.dart';
import '../../../core/widgets/confirm_dialog.dart';
import '../../../l10n/app_localizations.dart';
import '../dialogs/room_panel.dart';
import '../models/room.dart';
import '../session_actions.dart';
import '../status.dart';

/// The running clock on a room ticket. Its time is not on the bill yet —
/// it lands as lines when the session ends — so the bar shows what is
/// accumulating, ends the session from right here, and opens the room's
/// controls for anything more.
class SessionBar extends ConsumerStatefulWidget {
  final RoomSession session;

  const SessionBar({super.key, required this.session});

  @override
  ConsumerState<SessionBar> createState() => _SessionBarState();
}

class _SessionBarState extends ConsumerState<SessionBar> {
  late final Timer _clock = Timer.periodic(const Duration(seconds: 1), (_) => setState(() {}));
  bool _busy = false;

  @override
  void dispose() {
    _clock.cancel();
    super.dispose();
  }

  Future<void> _end() async {
    final l10n = AppLocalizations.of(context)!;
    final session = widget.session;
    final ok = await showConfirmDialog(
      context,
      title: l10n.endThisSession,
      description: l10n.endSessionBilledAt(l10n.billedHoursFormat(hoursText(session.billedHours))),
      cancelLabel: l10n.keepPlaying,
      actionLabel: l10n.endSessionButton,
      destructive: true,
    );
    if (!ok || !mounted) return;
    setState(() => _busy = true);
    await SessionActions(ref, context).endSession(session.id);
    if (mounted) setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final session = widget.session;
    final now = DateTime.now();
    final billed = session.billedHours;
    final detail = [
      l10n.sessionRunning,
      if (session.currentPlayerMode != null) modeLabel(l10n, session.currentPlayerMode),
      if (billed > 0) '${l10n.billedSoFar}: ${l10n.billedHoursFormat(hoursText(billed))}',
    ].join(' · ');

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: theme.colors.background,
        border: Border.all(color: theme.colors.border),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          Icon(FIcons.timer, size: 24, color: theme.colors.mutedForeground),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(formatClock(session.elapsedSeconds(now)),
                    style: theme.typography.xl2.copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
                Text(detail,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground)),
              ],
            ),
          ),
          const SizedBox(width: 12),
          SizedBox(
            height: 48,
            child: FButton(
              variant: FButtonVariant.outline,
              mainAxisSize: MainAxisSize.min,
              onPress: () => showRoomPanel(context, session.roomId),
              prefix: const Icon(FIcons.doorOpen, size: 20),
              child: Text(l10n.room, style: theme.typography.base.forButton),
            ),
          ),
          const SizedBox(width: 8),
          SizedBox(
            height: 48,
            child: FButton(
              variant: FButtonVariant.destructive,
              mainAxisSize: MainAxisSize.min,
              onPress: _busy ? null : _end,
              prefix: const Icon(FIcons.square, size: 20),
              child: Text(l10n.endSessionButton, style: theme.typography.base.forButton),
            ),
          ),
        ],
      ),
    );
  }
}

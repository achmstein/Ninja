import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import '../../../core/models/localized_text.dart';
import '../../../core/models/money.dart';
import '../../../core/theme/text_styles.dart';
import '../../../l10n/app_localizations.dart';
import '../models/room.dart';
import '../session_actions.dart';
import '../widgets/player_mode_toggle.dart';

/// Starts the clock: a walk-in from an available room, or the reserved
/// session of a customer who just arrived. The player mode can wait — the
/// server bills at the single rate until one is chosen. Resolves to true
/// once the session runs.
Future<bool> showStartSessionDialog(BuildContext context, Room room, {RoomSession? session}) async {
  final started = await showFDialog<bool>(
    context: context,
    useRootNavigator: true,
    builder: (context, style, animation) => FDialog.raw(
      style: style,
      animation: animation,
      constraints: const BoxConstraints(maxWidth: 448),
      builder: (context, _) => _StartSessionDialog(room: room, session: session),
    ),
  );
  return started ?? false;
}

class _StartSessionDialog extends ConsumerStatefulWidget {
  final Room room;
  final RoomSession? session;
  const _StartSessionDialog({required this.room, this.session});

  @override
  ConsumerState<_StartSessionDialog> createState() => _StartSessionDialogState();
}

class _StartSessionDialogState extends ConsumerState<_StartSessionDialog> {
  String _playerMode = 'Single';
  bool _busy = false;

  // Reserve instead: the room panel used to offer this beside Start, and a
  // free room now opens this dialog directly
  Future<void> _reserve() async {
    setState(() => _busy = true);
    final ok = await SessionActions(ref, context).reserve(widget.room.id);
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok) Navigator.of(context, rootNavigator: true).pop(false);
  }

  Future<void> _start() async {
    setState(() => _busy = true);
    final actions = SessionActions(ref, context);
    final session = widget.session;
    final ok = session != null
        ? await actions.startReserved(session.id, _playerMode)
        : await actions.startWalkIn(widget.room.id, _playerMode);
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok) Navigator.of(context, rootNavigator: true).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final rtl = Directionality.of(context) == TextDirection.rtl;
    final room = widget.room;
    final session = widget.session;
    final name = room.name.localized(context);
    final playIcon = Transform.flip(flipX: rtl, child: const Icon(FIcons.play, size: 20));

    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              playIcon,
              const SizedBox(width: 8),
              Expanded(
                child: Text(session != null ? l10n.startSession : l10n.startWalkInSession,
                    style: theme.typography.xl.copyWith(fontWeight: FontWeight.w600)),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            session != null
                ? [name, if ((session.userName ?? '').isNotEmpty) session.userName!].join(' · ')
                : l10n.startWalkInDescription(name),
            style: theme.typography.base.copyWith(color: theme.colors.mutedForeground),
          ),
          const SizedBox(height: 16),
          // The card prices the mode picked below; the toggle carries both
          // rates so the other one stays in view
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(color: theme.colors.muted, borderRadius: BorderRadius.circular(14)),
            child: Column(
              children: [
                Text(name, style: theme.typography.lg.copyWith(fontWeight: FontWeight.w600)),
                Text.rich(
                  TextSpan(
                    text: money(context, _playerMode == 'Multi' ? room.multiRate : room.singleRate),
                    style: theme.typography.xl2.copyWith(
                      fontWeight: FontWeight.w700,
                      color: theme.colors.primary,
                      fontFeatures: const [FontFeature.tabularFigures()],
                    ),
                    children: [
                      TextSpan(text: ' ${l10n.perHour}', style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground)),
                    ],
                  ),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Text(l10n.playerMode, style: theme.typography.sm.copyWith(fontWeight: FontWeight.w500)),
          const SizedBox(height: 8),
          PlayerModeToggle(
            value: _playerMode,
            onChange: (mode) => setState(() => _playerMode = mode ?? _playerMode),
            rates: {'Single': money(context, room.singleRate), 'Multi': money(context, room.multiRate)},
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              if (session == null) ...[
                SizedBox(
                  height: 48,
                  child: FButton(
                    variant: FButtonVariant.outline,
                    mainAxisSize: MainAxisSize.min,
                    onPress: _busy ? null : _reserve,
                    prefix: const Icon(FIcons.clock, size: 20),
                    child: Text(l10n.reserve, style: theme.typography.base.forButton),
                  ),
                ),
                const Spacer(),
              ],
              SizedBox(
                height: 48,
                child: FButton(
                  variant: FButtonVariant.outline,
                  mainAxisSize: MainAxisSize.min,
                  onPress: _busy ? null : () => Navigator.of(context, rootNavigator: true).pop(false),
                  child: Text(l10n.cancel, style: theme.typography.base.forButton),
                ),
              ),
              const SizedBox(width: 8),
              SizedBox(
                height: 48,
                child: FButton(
                  mainAxisSize: MainAxisSize.min,
                  onPress: _busy ? null : _start,
                  prefix: _busy ? const SizedBox.square(dimension: 20, child: CircularProgressIndicator(strokeWidth: 2)) : playIcon,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    child: Text(l10n.startSession, style: theme.typography.base.forButton),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

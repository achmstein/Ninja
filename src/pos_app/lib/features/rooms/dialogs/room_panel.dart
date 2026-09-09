import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import '../../customers/dialogs/customer_card_dialog.dart';
import '../../../core/models/localized_text.dart';
import '../../../core/models/money.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/text_styles.dart';
import '../../../core/widgets/confirm_dialog.dart';
import '../../../l10n/app_localizations.dart';
import '../../sale/widgets/customer_dialog.dart';
import '../../tickets/providers/tickets_provider.dart';
import '../models/room.dart';
import '../providers/rooms_provider.dart';
import '../session_actions.dart';
import '../status.dart';
import '../widgets/player_mode_toggle.dart';
import 'start_session_dialog.dart';

/// One room's live state and every control the till has for it — the
/// admin room panel's "now" section, sized for a thumb. Hours here; the
/// money is the ticket's, one tap away while a session runs. The panel
/// reads the room and its session live, so what another till does shows
/// while it is open. Resolves to true when a session was started from it:
/// the panel closes on that, and the floor takes the till to the bill,
/// where the running session's card lives.
Future<bool> showRoomPanel(BuildContext context, int roomId) async {
  final started = await showFDialog<bool>(
    context: context,
    useRootNavigator: true,
    builder: (context, style, animation) => FDialog.raw(
      style: style,
      animation: animation,
      constraints: const BoxConstraints(maxWidth: 448),
      builder: (context, _) => _RoomPanel(roomId: roomId),
    ),
  );
  return started ?? false;
}

class _RoomPanel extends ConsumerStatefulWidget {
  final int roomId;
  const _RoomPanel({required this.roomId});

  @override
  ConsumerState<_RoomPanel> createState() => _RoomPanelState();
}

class _RoomPanelState extends ConsumerState<_RoomPanel> {
  late final Timer _clock = Timer.periodic(const Duration(seconds: 1), (_) => setState(() {}));
  bool _busy = false;

  @override
  void dispose() {
    _clock.cancel();
    super.dispose();
  }

  void _close() => Navigator.of(context, rootNavigator: true).pop();

  Future<void> _start(Room room, {RoomSession? session}) async {
    final started = await showStartSessionDialog(context, room, session: session);
    if (started && mounted) Navigator.of(context, rootNavigator: true).pop(true);
  }

  Future<void> _guarded(Future<bool> Function(SessionActions actions) call) async {
    if (_busy) return;
    setState(() => _busy = true);
    await call(SessionActions(ref, context));
    if (mounted) setState(() => _busy = false);
  }

  Future<void> _confirmEnd(RoomSession session) async {
    final l10n = AppLocalizations.of(context)!;
    final ok = await showConfirmDialog(
      context,
      title: l10n.endThisSession,
      description: l10n.endSessionBilledAt(l10n.billedHoursFormat(hoursText(session.billedHours))),
      cancelLabel: l10n.keepPlaying,
      actionLabel: l10n.endSessionButton,
      destructive: true,
    );
    if (ok && mounted) await _guarded((a) => a.endSession(session.id));
  }

  Future<void> _confirmCancel(RoomSession session) async {
    final l10n = AppLocalizations.of(context)!;
    final active = session.isActive;
    final ok = await showConfirmDialog(
      context,
      title: active ? l10n.cancelThisSession : l10n.cancelThisReservation,
      description: active ? l10n.cancelSessionHint : l10n.roomBecomesAvailable,
      cancelLabel: l10n.keepIt,
      actionLabel: active ? l10n.cancelSessionButton : l10n.cancelReservation,
      destructive: true,
    );
    if (ok && mounted) await _guarded((a) => a.cancelSession(session.id, wasActive: active));
  }

  Future<void> _confirmMode(RoomSession session, String mode) async {
    final l10n = AppLocalizations.of(context)!;
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

  // Customer picker: adds a member (running) or assigns the owner (reserved)
  Future<void> _pickCustomer(RoomSession session, {required bool assign}) async {
    final picked = await showCustomerDialog(context, accountsOnly: true);
    final id = picked?.id;
    if (picked == null || id == null || id.isEmpty || !mounted) return;
    await _guarded((a) => assign ? a.assignCustomer(session.id, id, picked.name) : a.addMember(session.id, id, picked.name));
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final rtl = Directionality.of(context) == TextDirection.rtl;
    final rooms = ref.watch(roomsProvider);
    final room = rooms.rooms.where((r) => r.id == widget.roomId).firstOrNull;
    final session = rooms.activeSessions.where((s) => s.roomId == widget.roomId && (s.isActive || s.isReserved)).firstOrNull;
    if (room == null) return const SizedBox(height: 120);

    final now = DateTime.now();
    final active = session != null && session.isActive;
    final reserved = session != null && session.isReserved;
    final maintenance = room.status == RoomStatus.maintenance;
    final amber = AppColors.amber(theme.colors.brightness);
    final muted = theme.typography.sm.copyWith(color: theme.colors.mutedForeground);
    const tabular = [FontFeature.tabularFigures()];
    final playIcon = Transform.flip(flipX: rtl, child: const Icon(FIcons.play, size: 20));
    final dot = switch (room.status) {
      RoomStatus.available => AppColors.successColor,
      RoomStatus.occupied => AppColors.red500,
      RoomStatus.reserved => AppColors.amber500,
      RoomStatus.maintenance => AppColors.gray400,
    };

    Widget circle(IconData icon, Color color, Color bg) => Container(
          width: 64,
          height: 64,
          decoration: BoxDecoration(color: bg, shape: BoxShape.circle),
          child: Icon(icon, size: 28, color: color),
        );

    Widget bigButton(String label, {required VoidCallback? onPress, FButtonVariant? variant, Widget? icon}) => SizedBox(
          height: 48,
          child: FButton(
            variant: variant,
            onPress: onPress,
            prefix: icon,
            child: Text(label, style: theme.typography.base.forButton),
          ),
        );

    final Widget body;
    if (active) {
      final elapsed = session.elapsedSeconds(now);
      final single = session.modeSeconds('Single', now);
      final multi = session.modeSeconds('Multi', now);
      final billed = session.billedHours;
      // The running session's bill, for the jump to it
      final ticket = (ref.watch(openTicketsProvider).value ?? const []).where((t) => t.sessionId == session.id).firstOrNull;
      body = Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(formatClock(elapsed),
              textAlign: TextAlign.center,
              style: theme.typography.xl4.copyWith(fontWeight: FontWeight.w300, letterSpacing: 4, fontFeatures: tabular)),
          if (single > 0 || multi > 0) ...[
            const SizedBox(height: 4),
            Text(
              [
                if (single > 0) '${l10n.playerModeSingle} ${formatClock(single)}',
                if (multi > 0) '${l10n.playerModeMulti} ${formatClock(multi)}',
              ].join('    '),
              textAlign: TextAlign.center,
              style: muted.copyWith(fontFeatures: tabular),
            ),
          ],
          const SizedBox(height: 16),
          PlayerModeToggle(
            value: session.currentPlayerMode,
            disabled: _busy,
            onChange: (mode) {
              if (mode != null && mode != session.currentPlayerMode) _confirmMode(session, mode);
            },
          ),
          const SizedBox(height: 16),
          // Who is in the room: the owner starred, members removable, and
          // a dashed chip to add the next one
          Wrap(
            alignment: WrapAlignment.center,
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final member in session.members)
                Container(
                  padding: EdgeInsetsDirectional.fromSTEB(12, 6, member.isOwner ? 12 : 4, 6),
                  decoration: BoxDecoration(border: Border.all(color: theme.colors.border), borderRadius: BorderRadius.circular(999)),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(member.isOwner ? FIcons.star : FIcons.user, size: 14, color: member.isOwner ? AppColors.amber500 : null),
                      const SizedBox(width: 6),
                      FTappable(
                        onPress: () => showCustomerCard(context, id: member.customerId, name: member.customerName ?? ''),
                        child: Text((member.customerName ?? '').isNotEmpty ? member.customerName! : l10n.guest, style: theme.typography.sm),
                      ),
                      if (!member.isOwner) ...[
                        const SizedBox(width: 4),
                        SizedBox.square(
                          dimension: 24,
                          child: FButton.icon(
                            variant: FButtonVariant.ghost,
                            onPress: _busy ? null : () => _guarded((a) => a.removeMember(session.id, member.customerId)),
                            child: Icon(FIcons.x, size: 14, color: theme.colors.mutedForeground),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              if (session.members.isEmpty && (session.userName ?? '').isNotEmpty)
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(FIcons.user, size: 16, color: theme.colors.mutedForeground),
                    const SizedBox(width: 4),
                    Text(session.userName!, style: muted),
                  ],
                ),
              SizedBox(
                height: 36,
                child: FButton(
                  variant: FButtonVariant.outline,
                  mainAxisSize: MainAxisSize.min,
                  onPress: _busy ? null : () => _pickCustomer(session, assign: false),
                  prefix: Icon(FIcons.userPlus, size: 16, color: theme.colors.mutedForeground),
                  child: Text(l10n.addCustomer, style: theme.typography.sm.forButton.copyWith(color: theme.colors.mutedForeground)),
                ),
              ),
            ],
          ),
          // Billed hours in quarter-hour steps; hidden until the first
          // quarter lands, like the admin panel
          if (billed > 0) ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(border: Border.all(color: theme.colors.border), borderRadius: BorderRadius.circular(14)),
              child: Column(
                children: [
                  if ((session.singleRoundedHours ?? 0) > 0)
                    Row(children: [
                      Text(l10n.playerModeSingle, style: muted),
                      const Spacer(),
                      Text(l10n.billedHoursFormat(hoursText(session.singleRoundedHours!)), style: theme.typography.sm.copyWith(fontFeatures: tabular)),
                    ]),
                  if ((session.multiRoundedHours ?? 0) > 0)
                    Row(children: [
                      Text(l10n.playerModeMulti, style: muted),
                      const Spacer(),
                      Text(l10n.billedHoursFormat(hoursText(session.multiRoundedHours!)), style: theme.typography.sm.copyWith(fontFeatures: tabular)),
                    ]),
                  const FDivider(),
                  Row(children: [
                    Text(l10n.billedHours, style: theme.typography.sm.copyWith(fontWeight: FontWeight.w600)),
                    const Spacer(),
                    Text(l10n.billedHoursFormat(hoursText(billed)), style: theme.typography.sm.copyWith(fontWeight: FontWeight.w600, fontFeatures: tabular)),
                  ]),
                ],
              ),
            ),
          ],
          const SizedBox(height: 16),
          if (ticket != null) ...[
            bigButton(
              '${l10n.openTicketAction} · ${money(context, ticket.total)}',
              variant: FButtonVariant.outline,
              icon: const Icon(FIcons.receipt, size: 20),
              onPress: () {
                _close();
                context.go('/ticket/${ticket.id}');
              },
            ),
            const SizedBox(height: 8),
          ],
          bigButton(l10n.endSessionButton,
              variant: FButtonVariant.destructive, icon: const Icon(FIcons.square, size: 20), onPress: _busy ? null : () => _confirmEnd(session)),
          const SizedBox(height: 4),
          SizedBox(
            height: 44,
            child: FButton(
              variant: FButtonVariant.ghost,
              onPress: _busy ? null : () => _confirmCancel(session),
              prefix: Icon(FIcons.x, size: 16, color: theme.colors.mutedForeground),
              child: Text(l10n.cancelSessionButton, style: theme.typography.base.forButton.copyWith(color: theme.colors.mutedForeground)),
            ),
          ),
        ],
      );
    } else if (reserved) {
      final expiresIn = session.secondsUntilExpiry(now);
      body = Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(child: circle(FIcons.clock, AppColors.amber500, AppColors.amber500.withValues(alpha: 0.1))),
          const SizedBox(height: 12),
          Text(l10n.readyToStart, textAlign: TextAlign.center, style: theme.typography.lg.copyWith(fontWeight: FontWeight.w500)),
          const SizedBox(height: 8),
          if ((session.userName ?? '').isNotEmpty)
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(FIcons.user, size: 16, color: theme.colors.mutedForeground),
                const SizedBox(width: 4),
                Text(session.userName!, style: theme.typography.base.copyWith(color: theme.colors.mutedForeground)),
              ],
            )
          else
            Center(
              child: SizedBox(
                height: 44,
                child: FButton(
                  variant: FButtonVariant.outline,
                  mainAxisSize: MainAxisSize.min,
                  onPress: _busy ? null : () => _pickCustomer(session, assign: true),
                  prefix: const Icon(FIcons.userPlus, size: 16),
                  child: Text(l10n.assignCustomer, style: theme.typography.base.forButton),
                ),
              ),
            ),
          if (expiresIn != null) ...[
            const SizedBox(height: 8),
            Text(l10n.expiresIn(formatCountdown(expiresIn)),
                textAlign: TextAlign.center, style: theme.typography.sm.copyWith(color: amber, fontFeatures: tabular)),
          ],
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: bigButton(l10n.cancel,
                    variant: FButtonVariant.outline, icon: const Icon(FIcons.x, size: 20), onPress: _busy ? null : () => _confirmCancel(session)),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: bigButton(l10n.startSession, icon: playIcon, onPress: _busy ? null : () => _start(room, session: session)),
              ),
            ],
          ),
        ],
      );
    } else if (maintenance) {
      body = Column(
        children: [
          circle(FIcons.wrench, theme.colors.mutedForeground, theme.colors.muted),
          const SizedBox(height: 12),
          Text(l10n.underMaintenance, style: theme.typography.lg.copyWith(fontWeight: FontWeight.w500, color: theme.colors.mutedForeground)),
        ],
      );
    } else {
      final description = room.description?.localized(context) ?? '';
      body = Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(child: circle(FIcons.circleCheck, AppColors.successColor, AppColors.successColor.withValues(alpha: 0.1))),
          const SizedBox(height: 12),
          Text(l10n.statusAvailable, textAlign: TextAlign.center, style: theme.typography.lg.copyWith(fontWeight: FontWeight.w500)),
          if (description.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(description, textAlign: TextAlign.center, style: muted),
          ],
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: bigButton(l10n.reserve,
                    variant: FButtonVariant.outline,
                    icon: const Icon(FIcons.clock, size: 20),
                    onPress: _busy ? null : () => _guarded((a) => a.reserve(room.id))),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: bigButton(l10n.startSession, icon: playIcon, onPress: _busy ? null : () => _start(room)),
              ),
            ],
          ),
        ],
      );
    }

    return ConstrainedBox(
      constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.95),
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Container(width: 12, height: 12, decoration: BoxDecoration(color: dot, shape: BoxShape.circle)),
                const SizedBox(width: 8),
                Expanded(child: Text(room.name.localized(context), style: theme.typography.xl.copyWith(fontWeight: FontWeight.w600))),
              ],
            ),
            const SizedBox(height: 4),
            Text('${money(context, room.singleRate)} · ${money(context, room.multiRate)} ${l10n.perHour}',
                style: theme.typography.base.copyWith(color: theme.colors.mutedForeground, fontFeatures: tabular)),
            const SizedBox(height: 16),
            body,
          ],
        ),
      ),
    );
  }
}

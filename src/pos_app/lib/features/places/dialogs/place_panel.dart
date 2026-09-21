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
import '../models/place.dart';
import '../providers/places_provider.dart';
import '../stay_actions.dart';
import '../status.dart';
import '../widgets/rate_option_toggle.dart';
import 'start_stay_dialog.dart';

/// One room's live state and every control the till has for it — the
/// admin room panel's "now" section, sized for a thumb. Hours here; the
/// money is the ticket's, one tap away while a session runs. The panel
/// reads the room and its session live, so what another till does shows
/// while it is open. Resolves to true when a session was started from it:
/// the panel closes on that, and the floor takes the till to the bill,
/// where the running session's card lives.
Future<bool> showPlacePanel(BuildContext context, int placeId) async {
  final started = await showFDialog<bool>(
    context: context,
    useRootNavigator: true,
    builder: (context, style, animation) => FDialog.raw(
      style: style,
      animation: animation,
      constraints: const BoxConstraints(maxWidth: 448),
      builder: (context, _) => _PlacePanel(placeId: placeId),
    ),
  );
  return started ?? false;
}

class _PlacePanel extends ConsumerStatefulWidget {
  final int placeId;
  const _PlacePanel({required this.placeId});

  @override
  ConsumerState<_PlacePanel> createState() => _PlacePanelState();
}

class _PlacePanelState extends ConsumerState<_PlacePanel> {
  late final Timer _clock = Timer.periodic(const Duration(seconds: 1), (_) => setState(() {}));
  bool _busy = false;

  @override
  void dispose() {
    _clock.cancel();
    super.dispose();
  }

  void _close() => Navigator.of(context, rootNavigator: true).pop();

  Future<void> _start(Place room, {Reservation? reservation}) async {
    final outcome = await showStartStayDialog(context, room, reservation: reservation);
    if (outcome == StartOutcome.started && mounted) Navigator.of(context, rootNavigator: true).pop(true);
  }

  /// The customer asked for the clock to start the moment the counter
  /// confirms they arrived: one tap does both
  Future<void> _confirmHold(Reservation reservation) async {
    final ok = await _guarded((a) => a.confirm(reservation.id, startsClock: reservation.startOnConfirm));
    if (ok && reservation.startOnConfirm && mounted) Navigator.of(context, rootNavigator: true).pop(true);
  }

  /// A plain table: the party sat down, and the floor opens their bill
  Future<void> _seatAtTable(Reservation reservation) async {
    final ok = await _guarded((a) => a.seat(reservation.id, null, timed: false));
    if (ok && mounted) Navigator.of(context, rootNavigator: true).pop(false);
  }

  Future<bool> _guarded(Future<bool> Function(StayActions actions) call) async {
    if (_busy) return false;
    setState(() => _busy = true);
    final ok = await call(StayActions(ref, context));
    if (mounted) setState(() => _busy = false);
    return ok;
  }

  Future<void> _confirmEnd(Stay session) async {
    final l10n = AppLocalizations.of(context)!;
    final ok = await showConfirmDialog(
      context,
      title: l10n.endThisSession,
      description: l10n.endSessionBilledAt(l10n.billedHoursFormat(hoursText(session.billedHours))),
      cancelLabel: l10n.keepPlaying,
      actionLabel: l10n.endSessionButton,
      destructive: true,
    );
    if (ok && mounted) await _guarded((a) => a.endStay(session.id));
  }

  Future<void> _confirmCancel({Stay? session, Reservation? reservation}) async {
    final l10n = AppLocalizations.of(context)!;
    final active = session != null;
    final ok = await showConfirmDialog(
      context,
      title: active ? l10n.cancelThisSession : l10n.cancelThisReservation,
      description: active ? l10n.cancelSessionHint : null,
      cancelLabel: l10n.keepIt,
      actionLabel: active ? l10n.cancelSessionButton : l10n.cancelReservation,
      destructive: true,
    );
    if (ok && mounted) {
      // Close the panel once cancelled — otherwise it reverts to the
      // available state, re-showing Start/Reserve as if prompting to start.
      final cancelled = await _guarded(
          (a) => session != null ? a.cancelStay(session.id) : a.cancelReservation(reservation!.id));
      if (cancelled && mounted) _close();
    }
  }

  Future<void> _confirmOption(Stay session, String code) async {
    final l10n = AppLocalizations.of(context)!;
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

  // Customer picker: adds a member (running) or assigns the owner (reserved)
  Future<void> _pickCustomer({Stay? session, Reservation? reservation, required bool assign}) async {
    final picked = await showCustomerDialog(context, accountsOnly: true);
    final id = picked?.id;
    if (picked == null || id == null || id.isEmpty || !mounted) return;
    await _guarded((a) => reservation != null
        ? a.assignReservationCustomer(reservation.id, id, picked.name)
        : assign
            ? a.assignCustomer(session!.id, id, picked.name)
            : a.addMember(session!.id, id, picked.name));
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final rtl = Directionality.of(context) == TextDirection.rtl;
    final placesState = ref.watch(placesProvider);
    final room = placesState.places.where((r) => r.id == widget.placeId).firstOrNull;
    final session = placesState.openStays.where((s) => s.placeId == widget.placeId && s.isRunning).firstOrNull;
    final reservation = ref.read(placesProvider.notifier).reservationHolding(widget.placeId);
    if (room == null) return const SizedBox(height: 120);

    final now = DateTime.now();
    final active = session != null && session.isRunning;
    final reserved = !active && reservation != null;
    final maintenance = room.status == PlaceStatus.outOfService;
    final amber = AppColors.amber(theme.colors.brightness);
    final muted = theme.typography.sm.copyWith(color: theme.colors.mutedForeground);
    const tabular = [FontFeature.tabularFigures()];
    final playIcon = Transform.flip(flipX: rtl, child: const Icon(FIcons.play, size: 20));
    final dot = switch (room.status) {
      PlaceStatus.available => AppColors.successColor,
      PlaceStatus.occupied => AppColors.red500,
      PlaceStatus.held => AppColors.amber500,
      PlaceStatus.outOfService => AppColors.gray400,
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
      final used = session.usedOptions(now);
      final billed = session.billedHours;
      // The running session's bill, for the jump to it
      final ticket = (ref.watch(openTicketsProvider).value ?? const []).where((t) => t.sessionId == session.id).firstOrNull;
      body = Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(formatClock(elapsed),
              textAlign: TextAlign.center,
              style: theme.typography.xl4.copyWith(fontWeight: FontWeight.w300, letterSpacing: 4, fontFeatures: tabular)),
          if (used.isNotEmpty && session.hasOptions) ...[
            const SizedBox(height: 4),
            Text(
              used.map((o) => '${o.name.localized(context)} ${formatClock(session.optionSeconds(o.code, now))}').join('    '),
              textAlign: TextAlign.center,
              style: muted.copyWith(fontFeatures: tabular),
            ),
          ],
          if (session.hasOptions) ...[
            const SizedBox(height: 16),
            RateOptionToggle(
              options: session.options,
              value: session.currentOptionCode,
              disabled: _busy,
              onChange: (code) {
                if (code != session.currentOptionCode) _confirmOption(session, code);
              },
            ),
          ],
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
                  onPress: _busy ? null : () => _pickCustomer(session: session, assign: false),
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
                  for (final c in session.costs)
                    if (c.hours > 0)
                      Row(children: [
                        Text(session.hasOptions ? c.optionName.localized(context) : l10n.time, style: muted),
                        const Spacer(),
                        Text(l10n.billedHoursFormat(hoursText(c.hours)), style: theme.typography.sm.copyWith(fontFeatures: tabular)),
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
              onPress: _busy ? null : () => _confirmCancel(session: session),
              prefix: Icon(FIcons.x, size: 16, color: theme.colors.mutedForeground),
              child: Text(l10n.cancelSessionButton, style: theme.typography.base.forButton.copyWith(color: theme.colors.mutedForeground)),
            ),
          ),
        ],
      );
    } else if (reserved) {
      final expiresIn = reservation.secondsUntilExpiry(now);
      body = Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(child: circle(FIcons.clock, AppColors.amber500, AppColors.amber500.withValues(alpha: 0.1))),
          const SizedBox(height: 12),
          Text(room.isTimed ? l10n.readyToStart : l10n.statusReserved,
              textAlign: TextAlign.center, style: theme.typography.lg.copyWith(fontWeight: FontWeight.w500)),
          const SizedBox(height: 8),
          if ((reservation.customerName ?? '').isNotEmpty)
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(FIcons.user, size: 16, color: theme.colors.mutedForeground),
                const SizedBox(width: 4),
                Text(reservation.customerName!, style: theme.typography.base.copyWith(color: theme.colors.mutedForeground)),
              ],
            )
          else
            Center(
              child: SizedBox(
                height: 44,
                child: FButton(
                  variant: FButtonVariant.outline,
                  mainAxisSize: MainAxisSize.min,
                  onPress: _busy ? null : () => _pickCustomer(reservation: reservation, assign: true),
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
          // The customer asked for the clock to start the moment the counter
          // confirms the reservation, at the rate they picked: one tap does both
          if (reservation.startOnConfirm) ...[
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(FIcons.timerReset, size: 16, color: theme.colors.mutedForeground),
                const SizedBox(width: 6),
                Text(l10n.startsOnConfirm, style: muted),
                if (reservation.requestedOptionName != null) ...[
                  const SizedBox(width: 6),
                  FBadge(
                    variant: FBadgeVariant.secondary,
                    child: Text(reservation.requestedOptionName!.localized(context)),
                  ),
                ],
              ],
            ),
          ],
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: bigButton(l10n.cancel,
                    variant: FButtonVariant.outline,
                    icon: const Icon(FIcons.x, size: 20),
                    onPress: _busy ? null : () => _confirmCancel(reservation: reservation)),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: !room.isTimed
                    ? bigButton(l10n.seatParty,
                        icon: const Icon(FIcons.circleCheck, size: 20), onPress: _busy ? null : () => _seatAtTable(reservation))
                    : reservation.startOnConfirm
                        ? bigButton(l10n.confirmHold, icon: playIcon, onPress: _busy ? null : () => _confirmHold(reservation))
                        : bigButton(l10n.startSession,
                            icon: playIcon, onPress: _busy ? null : () => _start(room, reservation: reservation)),
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
            Text('${tariffLine(context, room.options, (v) => money(context, v))} ${l10n.perHour}',
                style: theme.typography.base.copyWith(color: theme.colors.mutedForeground, fontFeatures: tabular)),
            const SizedBox(height: 16),
            body,
          ],
        ),
      ),
    );
  }
}

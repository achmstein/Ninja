import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/models/localized_text.dart';
import '../../../core/models/money.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import 'package:ninja_app_core/theme/text_styles.dart';
import '../../../l10n/app_localizations.dart';
import '../models/place.dart';
import '../stay_actions.dart';
import '../widgets/rate_option_toggle.dart';

/// What the start dialog ended in
enum StartOutcome {
  /// The clock runs
  started,

  /// A timed table that only wants a bill, no clock
  billOnly,

  /// Nothing started
  none,
}

/// Starts the clock: a walk-in on a free place, or the hold of a customer
/// who just arrived. Where the tariff has options the cashier picks one;
/// where it has one rate there is nothing to pick.
Future<StartOutcome> showStartStayDialog(BuildContext context, Place room, {Reservation? reservation}) async {
  final outcome = await showFDialog<StartOutcome>(
    context: context,
    useRootNavigator: true,
    builder: (context, style, animation) => FDialog.raw(
      style: style,
      animation: animation,
      constraints: const BoxConstraints(maxWidth: 448),
      builder: (context, _) => _StartStayDialog(room: room, reservation: reservation),
    ),
  );
  return outcome ?? StartOutcome.none;
}

class _StartStayDialog extends ConsumerStatefulWidget {
  final Place room;
  final Reservation? reservation;
  const _StartStayDialog({required this.room, this.reservation});

  @override
  ConsumerState<_StartStayDialog> createState() => _StartStayDialogState();
}

class _StartStayDialogState extends ConsumerState<_StartStayDialog> {
  String? _optionCode;
  bool _busy = false;

  RateOption? get _chosen => widget.room.option(_optionCode) ?? widget.room.options.firstOrNull;

  // Reserve instead: the room panel used to offer this beside Start, and a
  // free room now opens this dialog directly
  Future<void> _reserve() async {
    setState(() => _busy = true);
    final ok = await StayActions(ref, context).reserve(widget.room.id);
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok) Navigator.of(context, rootNavigator: true).pop(StartOutcome.none);
  }

  Future<void> _start() async {
    setState(() => _busy = true);
    final actions = StayActions(ref, context);
    final reservation = widget.reservation;
    final code = _chosen?.code;
    final ok = reservation != null
        ? await actions.seat(reservation.id, code, timed: true)
        : await actions.startWalkIn(widget.room.id, code);
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok) Navigator.of(context, rootNavigator: true).pop(StartOutcome.started);
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final rtl = Directionality.of(context) == TextDirection.rtl;
    final room = widget.room;
    final session = widget.reservation;
    final name = room.name.localized(context);
    final playIcon = Transform.flip(flipX: rtl, child: const Icon(FIcons.play, size: Sizes.icon));

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
          if (session != null) ...[
            const SizedBox(height: 4),
            Text(
              [name, if ((session.customerName ?? '').isNotEmpty) session.customerName!].join(' · '),
              style: theme.typography.base.copyWith(color: theme.colors.mutedForeground),
            ),
          ],
          const SizedBox(height: 16),
          // The card prices the option picked below; the toggle carries every
          // rate so the others stay in view
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(color: theme.colors.muted, borderRadius: BorderRadius.circular(Sizes.radiusCard)),
            child: Column(
              children: [
                Text(name, style: theme.typography.lg.copyWith(fontWeight: FontWeight.w600)),
                Text.rich(
                  TextSpan(
                    text: money(context, _chosen?.hourlyRate ?? 0),
                    style: theme.typography.heading.copyWith(
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
          if (room.hasOptions) ...[
            const SizedBox(height: 16),
            Text(l10n.rate, style: theme.typography.sm.copyWith(fontWeight: FontWeight.w500)),
            const SizedBox(height: 8),
            RateOptionToggle(
              options: room.options,
              value: _chosen?.code,
              onChange: (code) => setState(() => _optionCode = code),
              rates: {for (final o in room.options) o.code: money(context, o.hourlyRate)},
            ),
          ],
          const SizedBox(height: 16),
          // Two rows, each the dialog's own width: the other ways to take the
          // place, then cancel and start. On one row the four buttons did not fit
          if (session == null) ...[
            Row(
              children: [
                Expanded(
                  child: SizedBox(
                    height: Sizes.control,
                    child: FButton(
                      variant: FButtonVariant.outline,
                      onPress: _busy ? null : _reserve,
                      prefix: const Icon(FIcons.clock, size: Sizes.icon),
                      child: Text(l10n.reserve, style: theme.typography.base.forButton),
                    ),
                  ),
                ),
                // A timed table still seats people who only order
                if (room.kind != PlaceKind.room) ...[
                  const SizedBox(width: 8),
                  Expanded(
                    child: SizedBox(
                      height: Sizes.control,
                      child: FButton(
                        variant: FButtonVariant.outline,
                        onPress: _busy ? null : () => Navigator.of(context, rootNavigator: true).pop(StartOutcome.billOnly),
                        prefix: const Icon(FIcons.receiptText, size: Sizes.icon),
                        child: Text(l10n.billOnly, style: theme.typography.base.forButton),
                      ),
                    ),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 8),
          ],
          Row(
            children: [
              Expanded(
                child: SizedBox(
                  height: Sizes.control,
                  child: FButton(
                    variant: FButtonVariant.outline,
                    onPress: _busy ? null : () => Navigator.of(context, rootNavigator: true).pop(StartOutcome.none),
                    child: Text(l10n.cancel, style: theme.typography.base.forButton),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                flex: 2,
                child: SizedBox(
                  height: Sizes.control,
                  child: FButton(
                    onPress: _busy ? null : _start,
                    prefix: _busy ? const SizedBox.square(dimension: Sizes.icon, child: CircularProgressIndicator(strokeWidth: 2)) : playIcon,
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

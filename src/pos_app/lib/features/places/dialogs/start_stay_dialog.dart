import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import '../../../core/models/localized_text.dart';
import '../../../core/models/money.dart';
import '../../../core/theme/text_styles.dart';
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
Future<StartOutcome> showStartStayDialog(BuildContext context, Place room, {Stay? session}) async {
  final outcome = await showFDialog<StartOutcome>(
    context: context,
    useRootNavigator: true,
    builder: (context, style, animation) => FDialog.raw(
      style: style,
      animation: animation,
      constraints: const BoxConstraints(maxWidth: 448),
      builder: (context, _) => _StartStayDialog(room: room, session: session),
    ),
  );
  return outcome ?? StartOutcome.none;
}

class _StartStayDialog extends ConsumerStatefulWidget {
  final Place room;
  final Stay? session;
  const _StartStayDialog({required this.room, this.session});

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
    final session = widget.session;
    final code = _chosen?.code;
    final ok = session != null
        ? await actions.startHeld(session.id, code)
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
          if (session != null) ...[
            const SizedBox(height: 4),
            Text(
              [name, if ((session.userName ?? '').isNotEmpty) session.userName!].join(' · '),
              style: theme.typography.base.copyWith(color: theme.colors.mutedForeground),
            ),
          ],
          const SizedBox(height: 16),
          // The card prices the option picked below; the toggle carries every
          // rate so the others stay in view
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(color: theme.colors.muted, borderRadius: BorderRadius.circular(14)),
            child: Column(
              children: [
                Text(name, style: theme.typography.lg.copyWith(fontWeight: FontWeight.w600)),
                Text.rich(
                  TextSpan(
                    text: money(context, _chosen?.hourlyRate ?? 0),
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
                // A timed table still seats people who only order
                if (room.kind != PlaceKind.room) ...[
                  const SizedBox(width: 8),
                  SizedBox(
                    height: 48,
                    child: FButton(
                      variant: FButtonVariant.outline,
                      mainAxisSize: MainAxisSize.min,
                      onPress: _busy ? null : () => Navigator.of(context, rootNavigator: true).pop(StartOutcome.billOnly),
                      prefix: const Icon(FIcons.receiptText, size: 20),
                      child: Text(l10n.billOnly, style: theme.typography.base.forButton),
                    ),
                  ),
                ],
                const Spacer(),
              ],
              SizedBox(
                height: 48,
                child: FButton(
                  variant: FButtonVariant.outline,
                  mainAxisSize: MainAxisSize.min,
                  onPress: _busy ? null : () => Navigator.of(context, rootNavigator: true).pop(StartOutcome.none),
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

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/theme/app_theme.dart';
import 'package:ninja_app_core/theme/text_styles.dart';
import 'package:ninja_app_core/widgets/confirm_dialog.dart';
import '../../../core/network/api_errors.dart';
import '../../../core/widgets/rider_toast.dart';
import '../../../l10n/app_localizations.dart';
import '../providers/deliveries_provider.dart';

/// The rider's own switch, first on the deliveries screen. Off duty it is the
/// obvious thing to press: a card that says so with one big "Go on duty".
/// On duty it is a calm green card that says the till can give them
/// deliveries, with a small "Go off duty" that asks first, so a stray tap on
/// the road does not. While the till has not answered, a spinner.
class DutyCard extends ConsumerWidget {
  const DutyCard({super.key});

  /// Flips duty; when the till does not hear it the switch goes back and the rider is told
  static Future<void> _set(BuildContext context, WidgetRef ref, bool onDuty) async {
    final l10n = AppLocalizations.of(context)!;
    try {
      await ref.read(dutyProvider.notifier).set(onDuty);
    } catch (e) {
      if (context.mounted) showRiderToast(context, RiderToastType.error, l10n.dutyNotChanged, description: describeError(e, l10n));
    }
  }

  Future<void> _goOff(BuildContext context, WidgetRef ref) async {
    final l10n = AppLocalizations.of(context)!;
    final yes = await showConfirmDialog(
      context,
      title: l10n.goOffDutyConfirm,
      description: l10n.goOffDutyHint,
      cancelLabel: l10n.stayOnDuty,
      actionLabel: l10n.goOffDuty,
    );
    if (yes && context.mounted) await _set(context, ref, false);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final duty = ref.watch(dutyProvider);
    final green = AppColors.emerald(theme.colors.brightness);
    const spinner = SizedBox.square(dimension: 18, child: FCircularProgress());

    if (!duty.onDuty) {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: theme.colors.card,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: theme.colors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(color: theme.colors.muted, shape: BoxShape.circle),
                  child: Icon(FIcons.moon, size: 20, color: theme.colors.mutedForeground),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(l10n.offDuty, style: theme.typography.lg.copyWith(fontWeight: FontWeight.w700)),
                      Text(l10n.offDutyHint, style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground)),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            SizedBox(
              height: 56,
              child: FButton(
                onPress: duty.pending ? null : () => _set(context, ref, true),
                prefix: duty.pending ? spinner : const Icon(FIcons.power, size: 20),
                child: Text(l10n.goOnDuty, style: theme.typography.lg.copyWith(fontWeight: FontWeight.w700).forButton),
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      padding: const EdgeInsetsDirectional.fromSTEB(16, 14, 10, 14),
      decoration: BoxDecoration(
        color: green.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: green.withValues(alpha: 0.4)),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(color: green.withValues(alpha: 0.16), shape: BoxShape.circle),
            alignment: Alignment.center,
            child: duty.pending
                ? spinner
                : Container(
                    width: 14,
                    height: 14,
                    decoration: BoxDecoration(
                      color: green,
                      shape: BoxShape.circle,
                      boxShadow: [BoxShadow(color: green.withValues(alpha: 0.5), blurRadius: 8)],
                    ),
                  ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(l10n.onDuty, style: theme.typography.lg.copyWith(fontWeight: FontWeight.w700, color: green)),
                Text(l10n.onDutyHint, style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground)),
              ],
            ),
          ),
          const SizedBox(width: 8),
          SizedBox(
            height: 44,
            child: FButton(
              variant: FButtonVariant.outline,
              mainAxisSize: MainAxisSize.min,
              onPress: duty.pending ? null : () => _goOff(context, ref),
              child: Text(l10n.goOff, style: theme.typography.sm.copyWith(fontWeight: FontWeight.w600).forButton),
            ),
          ),
        ],
      ),
    );
  }
}

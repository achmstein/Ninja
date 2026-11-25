import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/theme/app_theme.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import 'package:ninja_app_core/theme/text_styles.dart';
import '../../../core/network/api_errors.dart';
import '../../../core/widgets/rider_sheet.dart';
import '../../../core/widgets/rider_toast.dart';
import '../../../l10n/app_localizations.dart';
import '../providers/deliveries_provider.dart';

/// The rider's own switch, first on the deliveries screen. Off duty it is one
/// big "Start work". On duty it is a calm green line with a small "End" that
/// asks first, from the foot of the screen, so a stray tap on the road does
/// not. While the till has not answered, a spinner.
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
    final yes = await showRiderConfirm(
      context,
      title: l10n.goOffDutyConfirm,
      actionLabel: l10n.goOffDuty,
      cancelLabel: l10n.stayOnDuty,
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
      return SizedBox(
        height: Sizes.controlLarge,
        child: FButton(
          onPress: duty.pending ? null : () => _set(context, ref, true),
          prefix: duty.pending ? spinner : const Icon(FIcons.power, size: Sizes.icon),
          child: Text(l10n.goOnDuty, style: theme.typography.lg.copyWith(fontWeight: FontWeight.w700).forButton),
        ),
      );
    }

    return Container(
      padding: const EdgeInsetsDirectional.fromSTEB(16, 8, 8, 8),
      decoration: BoxDecoration(
        color: green.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(Sizes.radiusCard),
        border: Border.all(color: green.withValues(alpha: 0.4)),
      ),
      child: Row(
        children: [
          SizedBox.square(
            dimension: 18,
            child: duty.pending
                ? spinner
                : Center(
                    child: Container(
                      width: 12,
                      height: 12,
                      decoration: BoxDecoration(
                        color: green,
                        shape: BoxShape.circle,
                        boxShadow: [BoxShadow(color: green.withValues(alpha: 0.5), blurRadius: 8)],
                      ),
                    ),
                  ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(l10n.onDuty, style: theme.typography.lg.copyWith(fontWeight: FontWeight.w700, color: green)),
          ),
          SizedBox(
            height: Sizes.control,
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

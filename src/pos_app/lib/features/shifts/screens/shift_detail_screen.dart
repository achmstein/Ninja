import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import 'package:shimmer/shimmer.dart';
import '../../../core/printing/print_service.dart';
import '../../../core/theme/text_styles.dart';
import '../../../core/widgets/pos_toast.dart';
import '../../../l10n/app_localizations.dart';
import '../models/shift.dart';
import '../providers/shifts_provider.dart';
import '../services/shifts_service.dart';
import '../widgets/shift_report.dart';
import 'shift_screen.dart' show ShiftStatusPill;

/// One shift from the history, laid out exactly like the Z shown at close
/// time, with the same 80 mm print. (An open shift's id renders too — as
/// its X — but the history only links to closed ones.)
class ShiftDetailScreen extends ConsumerWidget {
  final int shiftId;

  const ShiftDetailScreen({super.key, required this.shiftId});

  Future<void> _print(BuildContext context, WidgetRef ref, ShiftView shift) async {
    final l10n = AppLocalizations.of(context)!;
    try {
      await ref.read(printServiceProvider).printShiftReport(shift, l10n: l10n, locale: Localizations.localeOf(context));
      if (context.mounted) showPosToast(context, PosToastType.success, l10n.printed);
    } catch (e) {
      if (context.mounted) showPosToast(context, PosToastType.error, describePrintError(e, l10n));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final async = ref.watch(shiftProvider(shiftId));
    final shift = async.value;

    Widget frame(Widget child) => Align(
          alignment: Alignment.topCenter,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 768),
            child: SingleChildScrollView(padding: const EdgeInsets.all(16), child: child),
          ),
        );

    if (shift == null) {
      if (async.isLoading) {
        return frame(Shimmer.fromColors(
          baseColor: theme.colors.muted,
          highlightColor: theme.colors.background,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (final (h, w) in const [(48.0, 256.0), (128.0, double.infinity), (256.0, double.infinity)]) ...[
                Container(width: w, height: h, decoration: BoxDecoration(color: theme.colors.muted, borderRadius: BorderRadius.circular(12))),
                const SizedBox(height: 12),
              ],
            ],
          ),
        ));
      }
      final gone = async.error is ShiftNotFound;
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 96),
        child: Column(
          children: [
            Text(gone ? l10n.shiftNotFound : l10n.somethingWentWrong,
                style: theme.typography.lg.copyWith(color: theme.colors.mutedForeground)),
            const SizedBox(height: 16),
            SizedBox(
              height: 48,
              child: FButton(
                mainAxisSize: MainAxisSize.min,
                onPress: () => context.go('/shifts'),
                child: Text(l10n.shiftHistory, style: theme.typography.base.forButton),
              ),
            ),
          ],
        ),
      );
    }

    return frame(Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            SizedBox.square(
              dimension: 48,
              child: FButton.icon(
                variant: FButtonVariant.ghost,
                onPress: () => context.go('/shifts'),
                child: Icon(FIcons.arrowLeft, size: 24),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(l10n.shiftNumber(shift.id),
                  maxLines: 1, overflow: TextOverflow.ellipsis, style: theme.typography.xl.copyWith(fontWeight: FontWeight.w700)),
            ),
            const SizedBox(width: 8),
            ShiftStatusPill(open: !shift.isClosed),
            const SizedBox(width: 8),
            SizedBox(
              height: 48,
              child: FButton(
                mainAxisSize: MainAxisSize.min,
                onPress: () => _print(context, ref, shift),
                prefix: const Icon(FIcons.printer, size: 20),
                child: Text(l10n.print, style: theme.typography.base.forButton),
              ),
            ),
          ],
        ),
        const FDivider(),
        ShiftReport(shift: shift),
      ],
    ));
  }
}

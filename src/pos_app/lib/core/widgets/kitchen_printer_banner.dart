import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import '../../l10n/app_localizations.dart';
import '../brand/brand_provider.dart';
import '../printing/kitchen_printing.dart';
import '../theme/app_theme.dart';

/// A strip under the header while kitchen tickets wait past a minute for
/// their printer: which station, and what the printer said. A till that
/// prints the kitchen's tickets offers to try again now; one that does not
/// says where printing is switched on, since nobody may be doing it.
class KitchenPrinterBanner extends ConsumerWidget {
  const KitchenPrinterBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!ref.watch(featuresProvider).kds) return const SizedBox.shrink();
    final stuck = ref.watch(stuckKitchenTicketsProvider);
    if (stuck.isEmpty) return const SizedBox.shrink();

    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final locale = Localizations.localeOf(context);
    final amber = AppColors.amber(theme.colors.brightness);
    final printsHere = ref.watch(kitchenPrintingProvider);

    final stations = {for (final ticket in stuck) stationLabel(ticket, locale)}.join('، ');
    final reason = stuck.map((t) => t.lastError).whereType<String>().firstOrNull;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      color: AppColors.amber500.withValues(alpha: 0.12),
      child: Row(
        children: [
          Icon(FIcons.printer, size: 20, color: amber),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  l10n.kitchenPrinterStuck(stations),
                  style: theme.typography.sm.copyWith(fontWeight: FontWeight.w600, color: amber),
                ),
                Text(
                  printsHere ? (reason ?? l10n.kitchenPrinterStuckHint) : l10n.kitchenPrintingOffHere,
                  style: theme.typography.xs.copyWith(color: theme.colors.mutedForeground),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          if (printsHere)
            FButton(
              variant: FButtonVariant.outline,
              mainAxisSize: MainAxisSize.min,
              onPress: () async {
                await ref.read(kitchenPrintHostProvider).nudge();
                await ref.read(stuckKitchenTicketsProvider.notifier).refresh();
              },
              child: Text(l10n.retry),
            ),
        ],
      ),
    );
  }
}

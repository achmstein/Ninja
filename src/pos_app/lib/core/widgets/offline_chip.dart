import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import '../../l10n/app_localizations.dart';
import '../network/network_status.dart';
import '../offline/offline_queue.dart';
import '../offline/offline_sale.dart';
import '../theme/app_theme.dart';
import '../theme/text_styles.dart';

/// Header chip for the one state the cashier must know about: the network
/// is down (sales are kept on the till), sales are being sent now that it
/// is back, or one of them was refused. Gone while everything is normal.
/// Tap → Settings, where the queue is listed.
class OfflineChip extends ConsumerWidget {
  const OfflineChip({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final online = ref.watch(onlineProvider);
    final sales = ref.watch(offlineQueueProvider);
    final queued = sales.where((s) => s.status == OfflineSaleStatus.queued).length;
    final failed = sales.where((s) => s.status == OfflineSaleStatus.failed).length;
    if (online && sales.isEmpty) return const SizedBox.shrink();

    final (Color dot, String label) = !online
        ? (theme.colors.destructive, queued > 0 ? '${l10n.offline} · ${l10n.offlineQueued(queued)}' : l10n.offline)
        : failed > 0
            ? (theme.colors.destructive, l10n.offlineSalesFailed(failed))
            : (AppColors.amber500, l10n.syncingSales(queued));

    return Padding(
      padding: const EdgeInsetsDirectional.only(end: 8),
      child: SizedBox(
        height: 40,
        child: FButton(
          variant: FButtonVariant.outline,
          mainAxisSize: MainAxisSize.min,
          onPress: () => context.go('/settings'),
          prefix: Container(width: 8, height: 8, decoration: BoxDecoration(color: dot, shape: BoxShape.circle)),
          child: Text(label, style: theme.typography.sm.forButton.copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
        ),
      ),
    );
  }
}

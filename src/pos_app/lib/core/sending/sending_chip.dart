import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import 'package:ninja_app_core/theme/text_styles.dart';
import '../../l10n/app_localizations.dart';
import '../models/money.dart';
import 'sending.dart';

/// Header chip, red, while a charge never reached the server: wherever the
/// cashier has gone since, it is in sight. Tap → each one with its bill, why
/// it failed, and a retry or a remove.
class SendingChip extends ConsumerWidget {
  const SendingChip({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final failed = ref.watch(sendingProvider).where((s) => s.status == SendStatus.failed).length;
    if (failed == 0) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsetsDirectional.only(end: 8),
      child: SizedBox(
        height: 40,
        child: FButton(
          variant: FButtonVariant.outline,
          mainAxisSize: MainAxisSize.min,
          onPress: () => _showFailed(context),
          prefix: Icon(FIcons.triangleAlert, size: 16, color: theme.colors.destructive),
          child: Text(
            l10n.sendsFailed(failed),
            style: theme.typography.sm.forButton.copyWith(
              color: theme.colors.destructive,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        ),
      ),
    );
  }

  static Future<void> _showFailed(BuildContext context) => showFDialog<void>(
        context: context,
        useRootNavigator: true,
        builder: (context, style, animation) => FDialog.raw(
          style: style,
          animation: animation,
          constraints: const BoxConstraints(maxWidth: 512),
          builder: (context, _) => const _FailedSends(),
        ),
      );
}

class _FailedSends extends ConsumerWidget {
  const _FailedSends();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final failed = ref.watch(sendingProvider).where((s) => s.status == SendStatus.failed).toList();
    final notifier = ref.read(sendingProvider.notifier);
    final navigator = Navigator.of(context, rootNavigator: true);

    // All sorted out: nothing left to show
    if (failed.isEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (navigator.canPop()) navigator.pop();
      });
    }

    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(l10n.notSent, style: theme.typography.xl.copyWith(fontWeight: FontWeight.w600)),
          const SizedBox(height: 4),
          Text(l10n.sendsFailedHint, style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground)),
          const SizedBox(height: 16),
          ConstrainedBox(
            constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.6),
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (final (index, send) in failed.indexed) ...[
                    if (index > 0) Container(height: 1, color: theme.colors.border),
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          FTappable(
                            onPress: () {
                              navigator.pop();
                              context.go(send.ticketId != null ? '/ticket/${send.ticketId}' : '/ticket/sending/${send.requestId}');
                            },
                            child: Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    send.ticketId != null ? '#${send.ticketId}' : l10n.newTicket,
                                    style: theme.typography.base.copyWith(fontWeight: FontWeight.w600),
                                  ),
                                ),
                                Text(
                                  money(context, send.total),
                                  style: theme.typography.base.copyWith(
                                    fontWeight: FontWeight.w600,
                                    fontFeatures: const [FontFeature.tabularFigures()],
                                  ),
                                ),
                              ],
                            ),
                          ),
                          if ((send.error ?? '').isNotEmpty)
                            Text(send.error!, style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground)),
                          const SizedBox(height: 8),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.end,
                            children: [
                              SizedBox(
                                height: 44,
                                child: FButton(
                                  variant: FButtonVariant.outline,
                                  mainAxisSize: MainAxisSize.min,
                                  onPress: () => notifier.drop(send.requestId),
                                  prefix: const Icon(FIcons.trash2, size: 16),
                                  child: Text(l10n.remove, style: theme.typography.sm.forButton),
                                ),
                              ),
                              const SizedBox(width: 8),
                              SizedBox(
                                height: 44,
                                child: FButton(
                                  mainAxisSize: MainAxisSize.min,
                                  onPress: () => notifier.send(send.requestId),
                                  prefix: const Icon(FIcons.refreshCw, size: 16),
                                  child: Text(l10n.retrySync, style: theme.typography.sm.forButton),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

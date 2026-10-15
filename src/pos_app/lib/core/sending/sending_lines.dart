import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/models/localized_text.dart';
import 'package:ninja_app_core/theme/text_styles.dart';
import '../../l10n/app_localizations.dart';
import '../models/money.dart';
import 'sending.dart';

/// Lines the cashier has charged that the server has not confirmed yet,
/// laid out as the bill's own rows. On their way they read a little faded,
/// with a small upload mark at the end; once their order lands the real rows
/// replace them. One that never got in turns red, with what went wrong and a
/// retry or a remove — it never just disappears.
class SendingLines extends ConsumerWidget {
  final List<Sending> sends;

  const SendingLines({super.key, required this.sends});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (sends.isEmpty) return const SizedBox.shrink();
    final theme = context.theme;
    return Container(
      margin: const EdgeInsets.only(top: 4),
      padding: const EdgeInsets.only(top: 4),
      decoration: BoxDecoration(border: Border(top: BorderSide(color: theme.colors.border))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final (index, send) in sends.indexed) ...[
            if (index > 0) const SizedBox(height: 8),
            _SendBlock(send: send),
          ],
        ],
      ),
    );
  }
}

class _SendBlock extends ConsumerWidget {
  final Sending send;

  const _SendBlock({required this.send});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final failed = send.status == SendStatus.failed;
    final notifier = ref.read(sendingProvider.notifier);

    final rows = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final (index, line) in send.lines.indexed) ...[
          if (index > 0) Container(height: 1, color: theme.colors.border),
          _SendRow(name: line.name, details: line.details, quantity: line.quantity, price: line.price, failed: failed),
        ],
      ],
    );

    if (!failed) return Opacity(opacity: 0.7, child: rows);

    return Container(
      decoration: BoxDecoration(
        color: theme.colors.destructive.withValues(alpha: 0.05),
        border: Border.all(color: theme.colors.destructive.withValues(alpha: 0.4)),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          rows,
          Container(height: 1, color: theme.colors.border),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Row(
              children: [
                Icon(FIcons.triangleAlert, size: 20, color: theme.colors.destructive),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(l10n.notSent,
                          style: theme.typography.base.copyWith(fontWeight: FontWeight.w600, color: theme.colors.destructive)),
                      if ((send.error ?? '').isNotEmpty)
                        Text(send.error!, style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground)),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
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
          ),
        ],
      ),
    );
  }
}

class _SendRow extends StatelessWidget {
  final LocalizedText name;
  final LocalizedText? details;
  final int quantity;
  final double price;
  final bool failed;

  const _SendRow({required this.name, required this.details, required this.quantity, required this.price, required this.failed});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final muted = theme.typography.sm.copyWith(color: theme.colors.mutedForeground);
    const tabular = [FontFeature.tabularFigures()];
    final options = details?.localized(context) ?? '';
    return Container(
      constraints: const BoxConstraints(minHeight: 48),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name.localized(context),
                    maxLines: 1, overflow: TextOverflow.ellipsis, style: theme.typography.base.copyWith(fontWeight: FontWeight.w500)),
                if (options.isNotEmpty) Text(options, maxLines: 1, overflow: TextOverflow.ellipsis, style: muted),
                // The mark rides on this line, not after the price, so the
                // price never moves when it comes and goes
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text('$quantity × ${money(context, price)}', style: muted.copyWith(fontFeatures: tabular)),
                    if (!failed) ...[
                      const SizedBox(width: 6),
                      Semantics(
                        label: l10n.sending,
                        child: Icon(FIcons.cloudUpload, size: 14, color: theme.colors.mutedForeground),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Text(
            money(context, price * quantity),
            style: theme.typography.lg.copyWith(
              fontWeight: FontWeight.w600,
              color: failed ? theme.colors.mutedForeground : null,
              decoration: failed ? TextDecoration.lineThrough : null,
              fontFeatures: tabular,
            ),
          ),
        ],
      ),
    );
  }
}

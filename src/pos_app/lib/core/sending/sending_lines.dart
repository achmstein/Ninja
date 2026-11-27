import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/models/localized_text.dart';
import 'package:ninja_app_core/motion/motion.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import '../../l10n/app_localizations.dart';
import '../models/money.dart';
import 'sending.dart';
import '../theme/type_roles.dart';

/// Lines the cashier has charged that the server has not confirmed yet,
/// laid out as the bill's own rows. On their way they read a little faded,
/// with a small upload mark at the end; once their order lands the real rows
/// replace them. One that never got in turns red, with what went wrong and a
/// retry or a remove — it never just disappears.
class SendingLines extends ConsumerWidget {
  final List<Sending> sends;

  /// Ruled off from the bill's own lines above them. Left off on the order
  /// screen, where they lead the sent lines under a heading of their own
  final bool ruled;

  const SendingLines({super.key, required this.sends, this.ruled = true});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (sends.isEmpty) return const SizedBox.shrink();
    final theme = context.theme;
    final blocks = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final (index, send) in sends.indexed) ...[
          if (index > 0) const SizedBox(height: 8),
          _SendBlock(send: send),
        ],
      ],
    );
    if (!ruled) return blocks;
    return Container(
      margin: const EdgeInsets.only(top: 4),
      padding: const EdgeInsets.only(top: 4),
      decoration: BoxDecoration(border: Border(top: BorderSide(color: theme.colors.border))),
      child: blocks,
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

    if (!failed) return _Breathing(child: rows);

    Widget way(String label, IconData icon, VoidCallback onPress, {FButtonVariant? variant}) => Expanded(
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: Sizes.controlSmall),
            child: FButton(
              variant: variant,
              onPress: onPress,
              prefix: Icon(icon, size: Sizes.iconSmall),
              child: Flexible(
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Text(label, maxLines: 1, style: theme.type.buttonSmall),
                ),
              ),
            ),
          ),
        );

    return Container(
      decoration: BoxDecoration(
        color: theme.colors.destructive.withValues(alpha: 0.05),
        border: Border.all(color: theme.colors.destructive.withValues(alpha: 0.4)),
        borderRadius: BorderRadius.circular(Sizes.radius),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          rows,
          Container(height: 1, color: theme.colors.border),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            // The two ways on stand under the words, at one width: beside them
            // they left a narrow order no room for what went wrong
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Icon(FIcons.triangleAlert, size: Sizes.icon, color: theme.colors.destructive),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(l10n.notSent,
                              style: theme.type.heading.copyWith(color: theme.colors.destructive)),
                          if ((send.error ?? '').isNotEmpty)
                            Text(send.error!, style: theme.type.detail.copyWith(color: theme.colors.mutedForeground)),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                // Each a half of the row; the words shrink to their half before they are cut
                Row(
                  children: [
                    way(l10n.remove, FIcons.trash2, () => notifier.drop(send.requestId), variant: FButtonVariant.outline),
                    const SizedBox(width: 8),
                    way(l10n.retrySync, FIcons.refreshCw, () => notifier.send(send.requestId)),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Lines on their way, breathing: a slow pulse between faint and nearly
/// full, so "still going" reads without a mark. Still, at the middle of the
/// pulse, where the system asks for less motion.
class _Breathing extends StatefulWidget {
  final Widget child;

  const _Breathing({required this.child});

  @override
  State<_Breathing> createState() => _BreathingState();
}

class _BreathingState extends State<_Breathing> with SingleTickerProviderStateMixin {
  late final AnimationController _pulse =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 900))..repeat(reverse: true);

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (reduceMotion(context)) return Opacity(opacity: 0.65, child: widget.child);
    return FadeTransition(
      opacity: _pulse.drive(Tween(begin: 0.45, end: 0.85).chain(CurveTween(curve: Curves.easeInOut))),
      child: widget.child,
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
    final muted = theme.type.detail.copyWith(color: theme.colors.mutedForeground);
    const tabular = [FontFeature.tabularFigures()];
    final options = details?.localized(context) ?? '';
    return Container(
      constraints: const BoxConstraints(minHeight: Sizes.control),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name.localized(context),
                    maxLines: 1, overflow: TextOverflow.ellipsis, style: theme.type.body.copyWith(fontWeight: FontWeight.w500)),
                if (options.isNotEmpty) Text(options, maxLines: 1, overflow: TextOverflow.ellipsis, style: muted),
                // On its way it breathes (no mark); a reader is told in words
                Semantics(
                  label: failed ? null : l10n.sending,
                  child: Text('$quantity × ${money(context, price)}', style: muted.copyWith(fontFeatures: tabular)),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Text(
            money(context, price * quantity),
            style: theme.type.heading.copyWith(
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

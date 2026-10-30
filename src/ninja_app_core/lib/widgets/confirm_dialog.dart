import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import '../theme/sizes.dart';
import '../theme/text_styles.dart';

/// One question, two big buttons. The apps' answer to every "are you
/// sure": a thumb-sized cancel on the start side, the action on the end
/// side. Resolves to true when the action was picked.
Future<bool> showConfirmDialog(
  BuildContext context, {
  required String title,
  /// A datum the decision turns on (an amount, hours); never an explanation
  String? description,
  required String cancelLabel,
  required String actionLabel,
  /// Paint the action red: something ends, or money-relevant state changes
  bool destructive = false,
  /// A third answer, quieter than the other two and kept apart from them on
  /// the start side: the rare outcome of the same decision (end the session,
  /// or cancel it without charging). The dialog closes as "not the action"
  /// and then calls it. Both must be given, or neither.
  String? secondaryLabel,
  VoidCallback? onSecondary,
}) async {
  final picked = await showFDialog<bool>(
    context: context,
    useRootNavigator: true,
    builder: (context, style, animation) => FDialog.raw(
      style: style,
      animation: animation,
      constraints: const BoxConstraints(maxWidth: 448),
      builder: (context, _) {
        final theme = context.theme;
        return Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(title, style: theme.typography.heading.copyWith(fontWeight: FontWeight.w600)),
              if (description != null) ...[
                const SizedBox(height: Sizes.gapSm),
                Text(description, style: theme.typography.body.copyWith(color: theme.colors.mutedForeground)),
              ],
              const SizedBox(height: Sizes.gapLg),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  Flexible(
                    child: SizedBox(
                      height: Sizes.control,
                      child: FButton(
                        variant: FButtonVariant.outline,
                        mainAxisSize: MainAxisSize.min,
                        onPress: () => Navigator.of(context, rootNavigator: true).pop(false),
                        child: Text(cancelLabel,
                            maxLines: 1, overflow: TextOverflow.ellipsis, style: theme.typography.body.forButton),
                      ),
                    ),
                  ),
                  const SizedBox(width: Sizes.gapSm),
                  Flexible(
                    child: SizedBox(
                      height: Sizes.control,
                      child: FButton(
                        variant: destructive ? FButtonVariant.destructive : null,
                        mainAxisSize: MainAxisSize.min,
                        onPress: () => Navigator.of(context, rootNavigator: true).pop(true),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: Sizes.gapSm),
                          child: Text(actionLabel,
                              maxLines: 1, overflow: TextOverflow.ellipsis, style: theme.typography.body.forButton),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              // The rare third answer on a row of its own under the two, so
              // the three never have to share one (in Arabic they did not fit)
              if (secondaryLabel != null && onSecondary != null) ...[
                const SizedBox(height: Sizes.gapSm),
                Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: SizedBox(
                    height: Sizes.control,
                    child: FButton(
                      variant: FButtonVariant.ghost,
                      mainAxisSize: MainAxisSize.min,
                      onPress: () {
                        Navigator.of(context, rootNavigator: true).pop(false);
                        onSecondary();
                      },
                      child: Text(secondaryLabel,
                          style: theme.typography.body.forButton.copyWith(color: theme.colors.destructive)),
                    ),
                  ),
                ),
              ],
            ],
          ),
        );
      },
    ),
  );
  return picked ?? false;
}

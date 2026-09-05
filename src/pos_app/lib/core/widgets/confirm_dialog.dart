import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import '../theme/text_styles.dart';

/// One question, two big buttons. The till's answer to every "are you
/// sure": a thumb-sized cancel on the start side, the action on the end
/// side. Resolves to true when the action was picked.
Future<bool> showConfirmDialog(
  BuildContext context, {
  required String title,
  required String description,
  required String cancelLabel,
  required String actionLabel,
  /// Paint the action red: something ends, or money-relevant state changes
  bool destructive = false,
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
              Text(title, style: theme.typography.xl.copyWith(fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              Text(description, style: theme.typography.base.copyWith(color: theme.colors.mutedForeground)),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  SizedBox(
                    height: 48,
                    child: FButton(
                      variant: FButtonVariant.outline,
                      mainAxisSize: MainAxisSize.min,
                      onPress: () => Navigator.of(context, rootNavigator: true).pop(false),
                      child: Text(cancelLabel, style: theme.typography.base.forButton),
                    ),
                  ),
                  const SizedBox(width: 8),
                  SizedBox(
                    height: 48,
                    child: FButton(
                      variant: destructive ? FButtonVariant.destructive : null,
                      mainAxisSize: MainAxisSize.min,
                      onPress: () => Navigator.of(context, rootNavigator: true).pop(true),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 8),
                        child: Text(actionLabel, style: theme.typography.base.forButton),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    ),
  );
  return picked ?? false;
}

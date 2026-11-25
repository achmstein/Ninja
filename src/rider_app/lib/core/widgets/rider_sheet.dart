import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import 'package:ninja_app_core/theme/text_styles.dart';

/// A question from the foot of the screen, where the rider's thumb already
/// is: a title, a line under it when there is something to know, and the
/// answers stacked the whole width, each a target a thumb cannot miss and
/// its label centred. Swiping it down or tapping above it is "no".
Future<T?> showRiderSheet<T>(
  BuildContext context, {
  required String title,
  String? description,
  required List<Widget> Function(BuildContext context) actions,
}) {
  return showFSheet<T>(
    context: context,
    useRootNavigator: true,
    side: FLayout.btt,
    mainAxisMaxRatio: null,
    builder: (context) {
      final theme = context.theme;
      return Container(
        decoration: BoxDecoration(
          color: theme.colors.background,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
          border: Border(top: BorderSide(color: theme.colors.border)),
        ),
        child: SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 10, 20, 16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // The handle: it can be pulled down
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(color: theme.colors.border, borderRadius: BorderRadius.circular(2)),
                  ),
                ),
                const SizedBox(height: 16),
                Text(title, style: theme.typography.xl.copyWith(fontWeight: FontWeight.w700)),
                if (description != null) ...[
                  const SizedBox(height: 6),
                  Text(description, style: theme.typography.base.copyWith(color: theme.colors.mutedForeground)),
                ],
                const SizedBox(height: 20),
                for (final (index, action) in actions(context).indexed) ...[
                  if (index > 0) const SizedBox(height: 10),
                  action,
                ],
              ],
            ),
          ),
        ),
      );
    },
  );
}

/// One answer in a [showRiderSheet]: the whole width, its label centred
class SheetButton extends StatelessWidget {
  final String label;
  final VoidCallback onPress;
  final FButtonVariant? variant;

  /// The label in red, for the answer that ends something (going off duty, changing business)
  final bool destructive;

  const SheetButton({super.key, required this.label, required this.onPress, this.variant, this.destructive = false});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    return SizedBox(
      height: Sizes.controlLarge,
      child: FButton(
        variant: variant,
        onPress: onPress,
        child: Text(
          label,
          textAlign: TextAlign.center,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: theme.typography.lg
              .copyWith(fontWeight: FontWeight.w600, color: destructive ? theme.colors.destructive : null)
              .forButton,
        ),
      ),
    );
  }
}

/// Yes or no from the foot of the screen: the action first, filled, and
/// "not now" under it. Resolves to true when the action was picked.
Future<bool> showRiderConfirm(
  BuildContext context, {
  required String title,
  String? description,
  required String actionLabel,
  required String cancelLabel,
  bool destructive = false,
}) async {
  final picked = await showRiderSheet<bool>(
    context,
    title: title,
    description: description,
    actions: (context) => [
      SheetButton(
        label: actionLabel,
        variant: destructive ? FButtonVariant.destructive : null,
        onPress: () => Navigator.of(context, rootNavigator: true).pop(true),
      ),
      SheetButton(
        label: cancelLabel,
        variant: FButtonVariant.outline,
        onPress: () => Navigator.of(context, rootNavigator: true).pop(false),
      ),
    ],
  );
  return picked ?? false;
}

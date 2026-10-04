import 'package:flutter/material.dart';
import 'package:forui/forui.dart';

/// The one place an explanation lives on the till: a small ⓘ that opens a
/// popover. A screen shows a label, a value and a control; the rule behind
/// them is here, a tap away — never a paragraph on the screen.
class InfoTip extends StatelessWidget {
  final String text;

  const InfoTip({super.key, required this.text});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    return FPopover(
      popoverBuilder: (context, _) => ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 288),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Text(text, style: theme.typography.sm),
        ),
      ),
      builder: (context, controller, _) => FButton.icon(
        variant: FButtonVariant.ghost,
        onPress: () => controller.toggle(),
        child: Icon(FIcons.info, size: 16, color: theme.colors.mutedForeground),
      ),
    );
  }
}

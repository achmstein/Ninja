import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/theme/sizes.dart';

/// A header chip on a phone: its sign alone in a 48 dp square, as pos_web's
/// chips are below `sm`, because four labelled chips are wider than the
/// phone. The words it lost are still there for whoever needs them: a long
/// press shows them, and a screen reader says them.
class CompactChip extends StatelessWidget {
  /// What the labelled chip reads
  final String label;

  /// The chip's dot or icon
  final Widget icon;

  /// How many, for a chip that counts: the one part of its label a glance needs
  final int? count;
  final Color? countColor;
  final VoidCallback onPress;

  const CompactChip({
    super.key,
    required this.label,
    required this.icon,
    required this.onPress,
    this.count,
    this.countColor,
  });

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    return FTooltip(
      tipBuilder: (context, _) => Text(label),
      // A square the button fills, as the header's menu button is: stretched
      // only by a minimum size, the button grew and left its sign off-centre.
      // A chip that counts is as wide as its sign and number need
      child: SizedBox(
        width: count == null ? Sizes.control : null,
        height: Sizes.control,
        child: FButton.icon(
          variant: FButtonVariant.outline,
          onPress: onPress,
          child: Semantics(
            label: label,
            child: ExcludeSemantics(
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  icon,
                  if (count != null) ...[
                    const SizedBox(width: 6),
                    Text(
                      '$count',
                      style: theme.typography.sm.copyWith(
                        fontWeight: FontWeight.w600,
                        color: countColor ?? theme.colors.foreground,
                        fontFeatures: const [FontFeature.tabularFigures()],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import '../../../core/widgets/numeric_keypad.dart';

/// A labelled read-only amount box over the keypad — the only way to type
/// money on the till (no OS keyboard). Shared by the open-shift,
/// close-shift and movement dialogs.
class AmountEntry extends StatelessWidget {
  final String label;
  final String value;
  final ValueChanged<String> onChange;

  const AmountEntry({super.key, required this.label, required this.value, required this.onChange});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(label, style: theme.typography.sm.copyWith(fontWeight: FontWeight.w500)),
        const SizedBox(height: 6),
        Container(
          // Sized to the figure: a taller box looked like an empty field around it
          height: Sizes.controlLarge,
          alignment: AlignmentDirectional.centerEnd,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            border: Border.all(color: theme.colors.border),
            borderRadius: BorderRadius.circular(Sizes.radius),
          ),
          child: Directionality(
            textDirection: TextDirection.ltr,
            // Shrinks to fit rather than clip: a phone's larger font setting overflows the box
            child: FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerRight,
              child: Text(
                value.isEmpty ? '0' : value,
                maxLines: 1,
                style: theme.typography.xl3.copyWith(
                  // The line as tall as the figures, so they sit in the box's middle
                  height: 1,
                  fontWeight: FontWeight.w700,
                  fontFeatures: const [FontFeature.tabularFigures()],
                  color: value.isEmpty ? theme.colors.mutedForeground : null,
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),
        NumericKeypad(value: value, onChange: onChange),
      ],
    );
  }
}

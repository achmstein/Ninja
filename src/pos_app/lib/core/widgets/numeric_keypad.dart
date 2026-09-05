import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import '../theme/text_styles.dart';

const _maxLength = 9;

/// Applies one keypad key to a decimal-string value. Exported so inputs
/// share the exact same editing rules (ported from pos_web's
/// numeric-keypad.tsx).
String applyKeypadKey(String value, String key) {
  if (key == 'backspace') {
    return value.isEmpty ? value : value.substring(0, value.length - 1);
  }
  if (value.length >= _maxLength) return value;
  if (key == '.') {
    if (value.contains('.')) return value;
    return value.isEmpty ? '0.' : '$value.';
  }
  if (key == '00') {
    if (value.isEmpty || value == '0') return value;
    final next = '${value}00';
    return next.length > _maxLength ? next.substring(0, _maxLength) : next;
  }
  // Single digit: replace a bare leading zero instead of building "05"
  if (value == '0') return key;
  return value + key;
}

/// Big on-screen keypad for amounts — the paired displays are read-only so
/// the OS keyboard never pops on the till's touchscreen. Digits are always
/// rendered western (tabular) regardless of UI language, matching the
/// amounts everywhere else.
class NumericKeypad extends StatelessWidget {
  final String value;
  final ValueChanged<String> onChange;

  const NumericKeypad({super.key, required this.value, required this.onChange});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final keyStyle = theme.typography.xl.forButton.copyWith(
      fontWeight: FontWeight.w600,
      fontFeatures: const [FontFeature.tabularFigures()],
    );

    void press(String key) => onChange(applyKeypadKey(value, key));

    Widget keyButton(String key) => SizedBox(
      height: 56,
      child: FButton(
        variant: FButtonVariant.outline,
        onPress: () => press(key),
        child: Text(key, style: keyStyle),
      ),
    );

    Widget row(List<String> keys) => Row(
      children: [
        for (final (index, key) in keys.indexed) ...[
          if (index > 0) const SizedBox(width: 8),
          Expanded(child: keyButton(key)),
        ],
      ],
    );

    // Four 56 dp rows and three 8 dp gaps: a fixed height is what lets the
    // backspace key span all four rows (pos_web's `row-span-4 h-full`)
    return SizedBox(
      height: 4 * 56 + 3 * 8,
      child: Directionality(
        textDirection: TextDirection.ltr,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              flex: 3,
              child: Column(
                children: [
                  row(const ['1', '2', '3']),
                  const SizedBox(height: 8),
                  row(const ['4', '5', '6']),
                  const SizedBox(height: 8),
                  row(const ['7', '8', '9']),
                  const SizedBox(height: 8),
                  row(const ['00', '0', '.']),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: FButton(
                variant: FButtonVariant.outline,
                onPress: () => press('backspace'),
                child: const Icon(FIcons.delete, size: 24),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

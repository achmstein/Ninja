import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import '../../../core/models/localized_text.dart';
import '../../../core/theme/text_styles.dart';
import '../models/place.dart';

/// Segmented picker over a tariff's rate options — the Single/Multi toggle
/// the tills always had, now one button per option, sized for a thumb.
/// [rates] prints each option's hourly price after its name, so the
/// cashier sees them all while choosing. Renders nothing for a one-rate
/// tariff: there is nothing to pick.
class RateOptionToggle extends StatelessWidget {
  final List<RateOption> options;

  /// The option code in force
  final String? value;
  final ValueChanged<String> onChange;
  final bool disabled;
  final Map<String, String>? rates;

  const RateOptionToggle({
    super.key,
    required this.options,
    required this.value,
    required this.onChange,
    this.disabled = false,
    this.rates,
  });

  @override
  Widget build(BuildContext context) {
    if (options.length < 2) return const SizedBox.shrink();
    final theme = context.theme;
    return Row(
      children: [
        for (final (index, option) in options.indexed) ...[
          if (index > 0) const SizedBox(width: 8),
          Expanded(
            child: SizedBox(
              height: 48,
              child: FButton(
                variant: value == option.code ? null : FButtonVariant.outline,
                onPress: disabled ? null : () => onChange(option.code),
                // The first option is the base rate, the rest the upgrades
                prefix: Icon(index == 0 ? FIcons.user : FIcons.users, size: 20),
                child: Text.rich(
                  TextSpan(
                    text: option.name.localized(context),
                    style: theme.typography.base.forButton,
                    children: [
                      if (rates?[option.code] case final rate?)
                        TextSpan(
                          text: ' · $rate',
                          style: theme.typography.sm.copyWith(
                            color: value == option.code
                                ? theme.colors.primaryForeground.withValues(alpha: 0.8)
                                : theme.colors.mutedForeground,
                            fontFeatures: const [FontFeature.tabularFigures()],
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }
}

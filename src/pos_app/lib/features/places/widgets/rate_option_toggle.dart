import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/models/localized_text.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import 'package:ninja_app_core/theme/text_styles.dart';
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

  /// One option a row, the name at the start and the rate at the end: for a
  /// narrow column (the bill's panel), where side by side they overflow
  final bool stacked;

  const RateOptionToggle({
    super.key,
    required this.options,
    required this.value,
    required this.onChange,
    this.disabled = false,
    this.rates,
    this.stacked = false,
  });

  @override
  Widget build(BuildContext context) {
    if (options.length < 2) return const SizedBox.shrink();
    final theme = context.theme;
    if (stacked) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final (index, option) in options.indexed) ...[
            if (index > 0) const SizedBox(height: Sizes.gapSm),
            SizedBox(
              height: Sizes.control,
              child: FButton(
                // The one in force in the till's dark fill with a tick beside its
                // rate: a light grey fill next to a white row did not say which
                // was chosen
                variant: value == option.code ? null : FButtonVariant.outline,
                onPress: disabled ? null : () => onChange(option.code),
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                prefix: Icon(index == 0 ? FIcons.user : FIcons.users, size: Sizes.icon),
                suffix: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (rates?[option.code] case final rate?)
                      Text(rate,
                          style: theme.typography.label.copyWith(
                            color: value == option.code
                                ? theme.colors.primaryForeground.withValues(alpha: 0.8)
                                : theme.colors.mutedForeground,
                            fontFeatures: const [FontFeature.tabularFigures()],
                          )),
                    if (value == option.code) ...[
                      const SizedBox(width: Sizes.gapSm),
                      const Icon(FIcons.check, size: Sizes.icon),
                    ],
                  ],
                ),
                child: Text(option.name.localized(context),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.typography.body.forButton
                        .copyWith(fontWeight: value == option.code ? FontWeight.w600 : FontWeight.w400)),
              ),
            ),
          ],
        ],
      );
    }
    return Row(
      children: [
        for (final (index, option) in options.indexed) ...[
          if (index > 0) const SizedBox(width: 8),
          Expanded(
            child: SizedBox(
              height: Sizes.control,
              child: FButton(
                variant: value == option.code ? null : FButtonVariant.outline,
                onPress: disabled ? null : () => onChange(option.code),
                // The first option is the base rate, the rest the upgrades
                prefix: Icon(index == 0 ? FIcons.user : FIcons.users, size: Sizes.icon),
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

import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/models/localized_text.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import '../models/place.dart';
import '../../../core/theme/type_roles.dart';

/// Segmented picker over a tariff's rate options — the Single/Multi toggle
/// the tills always had, now one button per option, sized for a thumb.
/// [rates] prints each option's hourly price after its name, so the
/// cashier sees them all while choosing; side by side, the rate goes under
/// the name so two options fit a phone. Renders nothing for a one-rate
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
                          style: theme.type.detail.copyWith(
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
                    style: theme.type.button
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
            // The button lays its child out as wide as it asks, so the name and
            // rate are held to the button's own width here: side by side on one
            // line, two options were wider than a phone
            child: LayoutBuilder(
              builder: (context, box) => SizedBox(
                // Taller with a rate: it sits under the name, not beside it
                height: rates == null ? Sizes.control : Sizes.control + 12,
                child: FButton(
                  variant: value == option.code ? null : FButtonVariant.outline,
                  onPress: disabled ? null : () => onChange(option.code),
                  child: SizedBox(
                    width: (box.maxWidth - 34).clamp(0, double.infinity),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        // The first option is the base rate, the rest the upgrades
                        Icon(index == 0 ? FIcons.user : FIcons.users, size: Sizes.icon),
                        const SizedBox(width: Sizes.gapSm),
                        Flexible(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(option.name.localized(context),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: theme.type.button.copyWith(height: 20 / 16)),
                              if (rates?[option.code] case final rate?)
                                Text(rate,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: theme.type.caption.copyWith(
                                      height: 16 / 12,
                                      color: value == option.code
                                          ? theme.colors.primaryForeground.withValues(alpha: 0.8)
                                          : theme.colors.mutedForeground,
                                      fontFeatures: const [FontFeature.tabularFigures()],
                                    )),
                            ],
                          ),
                        ),
                      ],
                    ),
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

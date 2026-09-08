import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import '../../../core/theme/text_styles.dart';
import '../../../l10n/app_localizations.dart';

/// Segmented Single/Multi picker, the same one the admin apps use, sized
/// for a thumb. With `allowNone`, leaving both unselected means "not
/// decided yet" — the server bills at the single rate until a mode is set.
/// [rates] prints each mode's hourly price after its label, so the cashier
/// sees both while choosing.
class PlayerModeToggle extends StatelessWidget {
  final String? value;
  final ValueChanged<String?> onChange;
  final bool allowNone;
  final bool disabled;
  final Map<String, String>? rates;

  const PlayerModeToggle({
    super.key,
    required this.value,
    required this.onChange,
    this.allowNone = false,
    this.disabled = false,
    this.rates,
  });

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    return Row(
      children: [
        for (final (index, (mode, label, icon)) in [
          ('Single', l10n.playerModeSingle, FIcons.user),
          ('Multi', l10n.playerModeMulti, FIcons.users),
        ].indexed) ...[
          if (index > 0) const SizedBox(width: 8),
          Expanded(
            child: SizedBox(
              height: 48,
              child: FButton(
                variant: value == mode ? null : FButtonVariant.outline,
                onPress: disabled ? null : () => onChange(value == mode && allowNone ? null : mode),
                prefix: Icon(icon, size: 20),
                child: Text.rich(
                  TextSpan(
                    text: label,
                    style: theme.typography.base.forButton,
                    children: [
                      if (rates?[mode] case final rate?)
                        TextSpan(
                          text: ' · $rate',
                          style: theme.typography.sm.copyWith(
                            color: value == mode
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

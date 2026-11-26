import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/theme/app_theme.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import '../../../l10n/app_localizations.dart';
import '../../orders/models/order.dart';
import '../../../core/theme/type_roles.dart';

/// How good a delivery's pin is, in the till's words: the door itself (the
/// customer's, or where a rider found it before), near it (a map search), or
/// nothing to go by but the address
String pinQualityText(AppLocalizations l10n, PinSource quality) => switch (quality) {
      PinSource.customer || PinSource.shared => l10n.pinQualityCustomer,
      PinSource.rider => l10n.pinQualityRider,
      PinSource.search => l10n.pinQualitySearch,
      PinSource.none => l10n.pinQualityNone,
    };

/// Green for the door itself, amber for near it, red for no pin
Color pinQualityColor(FThemeData theme, PinSource quality) => switch (quality) {
      PinSource.customer || PinSource.shared || PinSource.rider => AppColors.emerald(theme.colors.brightness),
      PinSource.search => AppColors.amber(theme.colors.brightness),
      PinSource.none => theme.colors.destructive,
    };

/// One line saying how good the pin is, coloured by it. [quality] is the
/// pin's source as the till reads it ([PinSource.of]): none without a pin.
class PinQualityLabel extends StatelessWidget {
  final PinSource quality;

  const PinQualityLabel({super.key, required this.quality});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final color = pinQualityColor(theme, quality);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          switch (quality) {
            PinSource.customer || PinSource.shared || PinSource.rider => FIcons.mapPinCheck,
            PinSource.search => FIcons.mapPin,
            PinSource.none => FIcons.mapPinOff,
          },
          size: Sizes.iconSmall,
          color: color,
        ),
        const SizedBox(width: 6),
        Flexible(
          child: Text(pinQualityText(l10n, quality), style: theme.type.detail.copyWith(color: color, fontWeight: FontWeight.w600)),
        ),
      ],
    );
  }
}

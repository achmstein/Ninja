import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/theme/app_theme.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import '../../../l10n/app_localizations.dart';
import '../models/delivery_order.dart';

/// How good a delivery's pin is, in the rider's words: the door itself (the
/// customer's, or where a rider found it before), near it (a map search at
/// the till), or nothing to go by but the address
String pinQualityText(AppLocalizations l10n, PinSource quality) => switch (quality) {
      PinSource.customer || PinSource.shared => l10n.pinQualityCustomer,
      PinSource.rider => l10n.pinQualityRider,
      PinSource.search => l10n.pinQualitySearch,
      PinSource.none => l10n.pinQualityNone,
    };

/// One line saying how good the pin is: green for the door itself, amber for
/// near it, red for none
class PinQualityLabel extends StatelessWidget {
  final PinSource quality;

  const PinQualityLabel({super.key, required this.quality});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final (icon, color) = switch (quality) {
      PinSource.customer || PinSource.shared || PinSource.rider => (FIcons.mapPinCheck, AppColors.emerald(theme.colors.brightness)),
      PinSource.search => (FIcons.mapPin, AppColors.amber(theme.colors.brightness)),
      PinSource.none => (FIcons.mapPinOff, theme.colors.destructive),
    };
    return Row(
      children: [
        Icon(icon, size: Sizes.iconSmall, color: color),
        const SizedBox(width: 6),
        Expanded(
          child: Text(pinQualityText(l10n, quality), style: theme.typography.sm.copyWith(color: color, fontWeight: FontWeight.w600)),
        ),
      ],
    );
  }
}

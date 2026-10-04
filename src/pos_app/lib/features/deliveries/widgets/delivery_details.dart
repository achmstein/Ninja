import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/models/money.dart';
import '../../../core/theme/text_styles.dart';
import '../../../core/widgets/pos_toast.dart';
import '../../../l10n/app_localizations.dart';
import '../../orders/models/order.dart';
import '../models/delivery_order.dart';

/// "800 m", "2.4 km" in the app's language
String distanceLabel(AppLocalizations l10n, int meters) =>
    distanceText(meters, metres: l10n.distanceMeters, kilometres: l10n.distanceKilometres);

/// The address on one line, the street first, with the language's list comma
String addressLine(AppLocalizations l10n, OrderDelivery d) => d.line(
      building: l10n.deliveryBuilding,
      floor: l10n.deliveryFloor,
      apartment: l10n.deliveryApartment,
      separator: l10n.listSeparator,
    );

/// Why the rider could not hand it over, in the till's language (the server keeps a code)
String failReasonLabel(AppLocalizations l10n, String? code) => switch (code) {
      'NoAnswer' => l10n.failReasonNoAnswer,
      'Refused' => l10n.failReasonRefused,
      'WrongAddress' => l10n.failReasonWrongAddress,
      _ => l10n.failReasonOther,
    };

/// Opens Maps or the dialer; says so when the till has nothing to open it with
Future<void> openOrSay(BuildContext context, Uri uri, String failed) async {
  var opened = false;
  try {
    opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
  } catch (_) {
    opened = false;
  }
  if (!opened && context.mounted) showPosToast(context, PosToastType.error, failed);
}

/// Where an order is going, for the till: the address with the map at the
/// end of its line, the rider's note, then the number to call (its digits
/// alone left to right, the icon at the line's start), how far, and the fee;
/// and why it came back, when it did.
class DeliveryDetails extends StatelessWidget {
  final OrderDelivery delivery;

  const DeliveryDetails({super.key, required this.delivery});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final muted = theme.typography.sm.copyWith(color: theme.colors.mutedForeground);

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: theme.colors.muted, borderRadius: BorderRadius.circular(10)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Icon(FIcons.mapPin, size: 16, color: theme.colors.mutedForeground),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(addressLine(l10n, delivery), style: theme.typography.sm.copyWith(fontWeight: FontWeight.w500)),
                    if ((delivery.directions ?? '').isNotEmpty)
                      Text('"${delivery.directions}"', style: muted.copyWith(fontStyle: FontStyle.italic)),
                    if (!delivery.hasPin) Text(l10n.deliveryNoPin, style: muted),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              SizedBox(
                height: 48,
                child: FButton(
                  variant: FButtonVariant.outline,
                  mainAxisSize: MainAxisSize.min,
                  onPress: () => openOrSay(context, delivery.directionsUri, l10n.couldNotOpenMaps),
                  prefix: const Icon(FIcons.navigation, size: 16),
                  child: Text(l10n.deliveryMap, style: theme.typography.sm.forButton),
                ),
              ),
            ],
          ),
          if (delivery.stage == DeliveryStage.failed || delivery.stage == DeliveryStage.returned) ...[
            const SizedBox(height: 8),
            Text(l10n.deliveryFailedBecause(failReasonLabel(l10n, delivery.failureReason)),
                style: theme.typography.sm.copyWith(fontWeight: FontWeight.w600)),
          ],
          const SizedBox(height: 8),
          Wrap(
            spacing: 16,
            runSpacing: 4,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              if (delivery.phone.isNotEmpty)
                Semantics(
                  button: true,
                  label: delivery.phone,
                  excludeSemantics: true,
                  child: InkWell(
                    onTap: () => openOrSay(context, delivery.phoneUri, l10n.couldNotOpenDialer),
                    borderRadius: BorderRadius.circular(8),
                    child: ConstrainedBox(
                      // A thumb's target, though the line itself is small
                      constraints: const BoxConstraints(minHeight: 48),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(FIcons.phone, size: 14, color: theme.colors.foreground),
                          const SizedBox(width: 6),
                          Text(delivery.phone,
                              textDirection: TextDirection.ltr, style: theme.typography.sm.copyWith(fontWeight: FontWeight.w500)),
                        ],
                      ),
                    ),
                  ),
                ),
              if (delivery.distanceMeters != null) Text(distanceLabel(l10n, delivery.distanceMeters!), style: muted),
              Text('${l10n.deliveryFee}: ${delivery.fee > 0 ? money(context, delivery.fee) : l10n.deliveryFree}', style: muted),
            ],
          ),
        ],
      ),
    );
  }
}

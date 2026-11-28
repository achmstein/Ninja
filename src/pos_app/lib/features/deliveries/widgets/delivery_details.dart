import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/models/localized_text.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/models/money.dart';
import '../../../core/widgets/pos_toast.dart';
import '../../../l10n/app_localizations.dart';
import '../../orders/models/order.dart';
import '../models/delivery_order.dart';
import 'pin_quality.dart';

import 'package:ninja_app_core/utils/phone.dart';
import '../../../core/theme/type_roles.dart';
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

/// The same line with the branch's named area before it ("Maadi Degla · Road 9 · Building 4"),
/// when the delivery was priced by one
String areaAddressLine(BuildContext context, AppLocalizations l10n, OrderDelivery d) {
  final area = d.zoneName?.localized(context) ?? '';
  return area.isEmpty ? addressLine(l10n, d) : '$area · ${addressLine(l10n, d)}';
}

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
/// and why it came back, when it did. How good the pin is is said under the
/// address; with none, calling the customer is the big button.
class DeliveryDetails extends StatelessWidget {
  final OrderDelivery delivery;

  const DeliveryDetails({super.key, required this.delivery});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final muted = theme.type.detail.copyWith(color: theme.colors.mutedForeground);
    // Nothing on the map to go by: the rider calls before leaving, so the call is the first thing offered
    final callFirst = delivery.pinQuality == PinSource.none && delivery.phone.isNotEmpty;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: theme.colors.muted, borderRadius: BorderRadius.circular(Sizes.radius)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Icon(FIcons.mapPin, size: Sizes.iconSmall, color: theme.colors.mutedForeground),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(areaAddressLine(context, l10n, delivery), style: theme.type.detail.copyWith(fontWeight: FontWeight.w500)),
                    if ((delivery.directions ?? '').isNotEmpty)
                      Text('"${delivery.directions}"', style: muted.copyWith(fontStyle: FontStyle.italic)),
                    const SizedBox(height: 4),
                    PinQualityLabel(quality: delivery.pinQuality),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              SizedBox(
                height: Sizes.control,
                child: FButton(
                  variant: FButtonVariant.outline,
                  mainAxisSize: MainAxisSize.min,
                  onPress: () => openOrSay(context, delivery.directionsUri, l10n.couldNotOpenMaps),
                  prefix: const Icon(FIcons.navigation, size: Sizes.iconSmall),
                  child: Text(l10n.deliveryMap, style: theme.type.buttonSmall),
                ),
              ),
            ],
          ),
          if (delivery.stage == DeliveryStage.failed || delivery.stage == DeliveryStage.returned) ...[
            const SizedBox(height: 8),
            Text(l10n.deliveryFailedBecause(failReasonLabel(l10n, delivery.failureReason)),
                style: theme.type.detail.copyWith(fontWeight: FontWeight.w600)),
          ],
          if (callFirst) ...[
            const SizedBox(height: 8),
            SizedBox(
              height: Sizes.controlLarge,
              child: FButton(
                onPress: () => openOrSay(context, delivery.phoneUri, l10n.couldNotOpenDialer),
                prefix: const Icon(FIcons.phone),
                child: Flexible(
                  child: Text.rich(
                    TextSpan(children: [
                      TextSpan(text: '${l10n.deliveryCallCustomer} · '),
                      TextSpan(text: showPhone(delivery.phone)),
                    ]),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.type.button,
                  ),
                ),
              ),
            ),
          ],
          const SizedBox(height: 8),
          Wrap(
            spacing: 16,
            runSpacing: 4,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              if (delivery.phone.isNotEmpty && !callFirst)
                Semantics(
                  button: true,
                  label: showPhone(delivery.phone),
                  excludeSemantics: true,
                  child: InkWell(
                    onTap: () => openOrSay(context, delivery.phoneUri, l10n.couldNotOpenDialer),
                    borderRadius: BorderRadius.circular(Sizes.radius),
                    child: ConstrainedBox(
                      // A thumb's target, though the line itself is small
                      constraints: const BoxConstraints(minHeight: Sizes.control),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(FIcons.phone, size: Sizes.iconSmall, color: theme.colors.foreground),
                          const SizedBox(width: 6),
                          Text(showPhone(delivery.phone),
                              textDirection: TextDirection.ltr, style: theme.type.detail.copyWith(fontWeight: FontWeight.w500)),
                        ],
                      ),
                    ),
                  ),
                ),
              if (delivery.distanceMeters != null) Text(distanceLabel(l10n, delivery.distanceMeters!), style: muted),
              Text('${l10n.deliveryFee}: ${delivery.fee > 0 ? money(context, delivery.fee) : l10n.deliveryFree}', style: muted),
              if (delivery.etaMinutes != null) Text(l10n.deliveryAboutMinutes(delivery.etaMinutes!), style: muted),
            ],
          ),
        ],
      ),
    );
  }
}

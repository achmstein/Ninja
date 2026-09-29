import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import '../../../core/models/money.dart';
import '../../../l10n/app_localizations.dart';
import '../models/order.dart';

/// The delivery platforms whose own mark we show; anything else falls back to its name
const _platformLogos = {'Talabat': 'assets/images/talabat.png'};

/// Why staff turn a platform's order down, as the platform spells it; the
/// platform tells its customer. Too busy is the answer when nothing else fits.
const platformRejectReasons = [
  'TOO_BUSY',
  'ITEM_UNAVAILABLE',
  'CLOSED',
  'NO_COURIER',
  'OUTSIDE_DELIVERY_AREA',
  'FRAUD_PRANK',
];

String platformRejectReasonLabel(AppLocalizations l10n, String reason) => switch (reason) {
      'ITEM_UNAVAILABLE' => l10n.rejectItemUnavailable,
      'CLOSED' => l10n.rejectClosed,
      'NO_COURIER' => l10n.rejectNoCourier,
      'OUTSIDE_DELIVERY_AREA' => l10n.rejectOutsideArea,
      'FRAUD_PRANK' => l10n.rejectPrank,
      _ => l10n.rejectTooBusy,
    };

/// A delivery platform's order, as the counter needs it: the platform's own
/// logo (so it is never mistaken for one of ours) and the code its rider
/// asks for
class PlatformBadge extends StatelessWidget {
  final PlatformOrder platform;
  final double logoHeight;

  const PlatformBadge({super.key, required this.platform, this.logoHeight = 16});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final logo = _platformLogos[platform.name];
    return Wrap(
      spacing: 8,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        if (logo != null)
          Image.asset(logo, height: logoHeight, semanticLabel: platform.name)
        else
          Text(platform.name, style: theme.typography.sm.copyWith(fontWeight: FontWeight.w600)),
        Directionality(
          textDirection: TextDirection.ltr,
          child: Text(
            platform.displayCode,
            style: theme.typography.sm.copyWith(
              fontWeight: FontWeight.w600,
              fontFamily: 'monospace',
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        ),
        if (platform.cancelledAt != null)
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(FIcons.triangleAlert, size: 14, color: theme.colors.destructive),
              const SizedBox(width: 4),
              Text(l10n.platformCancelled, style: theme.typography.sm.copyWith(color: theme.colors.destructive)),
            ],
          ),
      ],
    );
  }
}

/// How a platform's order leaves: the platform's rider (and when), the
/// customer, or ours to an address with the cash to collect
class PlatformHandover extends StatelessWidget {
  final PlatformOrder platform;

  const PlatformHandover({super.key, required this.platform});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final muted = theme.typography.sm.copyWith(color: theme.colors.mutedForeground);
    String? time(DateTime? value) => value == null ? null : MaterialLocalizations.of(context).formatTimeOfDay(TimeOfDay.fromDateTime(value));

    final (icon, text) = switch (platform.expedition) {
      PlatformExpedition.pickup => (
          FIcons.store,
          [l10n.platformCollect, if (time(platform.dueAt) != null) time(platform.dueAt)!].join(' · '),
        ),
      PlatformExpedition.vendorDelivery => (
          FIcons.bike,
          [
            l10n.platformOwnRider,
            if ((platform.deliveryAddress ?? '').isNotEmpty) platform.deliveryAddress!,
            if (!platform.paidOnline && (platform.collectFromCustomer ?? 0) > 0)
              l10n.platformCollectCash(money(context, platform.collectFromCustomer!)),
          ].join(' · '),
        ),
      PlatformExpedition.platformDelivery => (
          FIcons.bike,
          time(platform.riderPickupAt) != null ? l10n.platformRiderAt(time(platform.riderPickupAt)!) : l10n.sourceTalabat,
        ),
    };

    return Row(
      children: [
        Icon(icon, size: 14, color: theme.colors.mutedForeground),
        const SizedBox(width: 4),
        Expanded(child: Text(text, maxLines: 2, overflow: TextOverflow.ellipsis, style: muted)),
      ],
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/network/api_errors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/text_styles.dart';
import '../../../core/widgets/confirm_dialog.dart';
import '../../../core/widgets/rider_toast.dart';
import '../../../l10n/app_localizations.dart';
import '../models/delivery_order.dart';
import '../providers/deliveries_provider.dart';

/// One delivery still to go: whom it is for and where (the address, the
/// note that finds the door), what is in the bag, the cash to collect, the
/// way there and the phone a tap away, and the one next step in a button
/// a thumb cannot miss: on the way, then delivered.
class DeliveryCard extends ConsumerStatefulWidget {
  final DeliveryOrder order;
  final String Function(double) money;

  const DeliveryCard({super.key, required this.order, required this.money});

  @override
  ConsumerState<DeliveryCard> createState() => _DeliveryCardState();
}

class _DeliveryCardState extends ConsumerState<DeliveryCard> {
  bool _busy = false;

  Future<void> _open(Uri uri) async {
    try {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {}
  }

  Future<void> _next() async {
    final order = widget.order;
    final l10n = AppLocalizations.of(context)!;
    final notifier = ref.read(deliveriesProvider.notifier);

    if (order.isOut) {
      // Handing it over is the step that cannot be taken back: the cash with it
      final yes = await showConfirmDialog(
        context,
        title: l10n.deliveredConfirm(order.customerName ?? l10n.guest, widget.money(order.total)),
        cancelLabel: l10n.notYet,
        actionLabel: l10n.deliveredConfirmAction,
      );
      if (!yes || !mounted) return;
    }

    setState(() => _busy = true);
    try {
      if (order.isOut) {
        await notifier.markDelivered(order.orderNumber);
      } else {
        await notifier.markOut(order.orderNumber);
      }
    } catch (e) {
      if (mounted) showRiderToast(context, RiderToastType.error, l10n.failedToUpdate, description: describeError(e, l10n));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final order = widget.order;
    final muted = theme.colors.mutedForeground;
    final locale = Localizations.localeOf(context);
    final ready = order.readyAt != null;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: theme.colors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: order.isOut ? theme.colors.primary : theme.colors.border, width: order.isOut ? 1.5 : 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  order.customerName ?? l10n.guest,
                  style: theme.typography.lg.copyWith(fontWeight: FontWeight.w700),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              Text(l10n.orderNumber(order.orderNumber), style: theme.typography.sm.copyWith(color: muted)),
            ],
          ),
          const SizedBox(height: 4),
          // Whether the kitchen is done: a bag still being made is not one to wait at the door for
          if (!order.isOut)
            Text(
              ready ? l10n.readyToGo : l10n.stillCooking,
              style: theme.typography.sm.copyWith(
                fontWeight: FontWeight.w600,
                color: ready ? AppColors.emerald(theme.colors.brightness) : AppColors.amber(theme.colors.brightness),
              ),
            )
          else
            Text(l10n.onTheWay, style: theme.typography.sm.copyWith(fontWeight: FontWeight.w600, color: theme.colors.primary)),
          const SizedBox(height: 10),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(FIcons.mapPin, size: 18, color: muted),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      order.addressLine(building: l10n.building, floor: l10n.floor, apartment: l10n.apartment),
                      style: theme.typography.base.copyWith(fontWeight: FontWeight.w500),
                    ),
                    if (order.directions != null)
                      Text('"${order.directions}"', style: theme.typography.sm.copyWith(color: muted, fontStyle: FontStyle.italic)),
                  ],
                ),
              ),
            ],
          ),
          if (order.customerNote != null) ...[
            const SizedBox(height: 8),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(FIcons.messageSquare, size: 18, color: muted),
                const SizedBox(width: 8),
                Expanded(child: Text(order.customerNote!, style: theme.typography.sm)),
              ],
            ),
          ],
          const SizedBox(height: 10),
          // The bag, to check against before leaving
          for (final line in order.lines)
            Padding(
              padding: const EdgeInsets.only(bottom: 2),
              child: Text(
                '${line.units}× ${line.name.getText(locale)}${line.options == null || line.options!.isEmpty ? '' : ' · ${line.options!.getText(locale)}'}',
                style: theme.typography.sm.copyWith(color: muted),
              ),
            ),
          const SizedBox(height: 10),
          Row(
            children: [
              Icon(FIcons.banknote, size: 18, color: muted),
              const SizedBox(width: 8),
              Text(l10n.collectCash, style: theme.typography.sm.copyWith(color: muted)),
              const Spacer(),
              Text(widget.money(order.total), style: theme.typography.xl.copyWith(fontWeight: FontWeight.w700)),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: SizedBox(
                  height: 48,
                  child: FButton(
                    variant: FButtonVariant.outline,
                    onPress: () => _open(order.directionsUri),
                    prefix: const Icon(FIcons.navigation, size: 18),
                    child: Text(l10n.navigate, style: theme.typography.base.forButton),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: SizedBox(
                  height: 48,
                  child: FButton(
                    variant: FButtonVariant.outline,
                    onPress: order.phone.isEmpty ? null : () => _open(order.phoneUri),
                    prefix: const Icon(FIcons.phone, size: 18),
                    child: Text(l10n.call, style: theme.typography.base.forButton),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          SizedBox(
            height: 56,
            child: FButton(
              onPress: _busy ? null : _next,
              prefix: _busy
                  ? const SizedBox.square(dimension: 18, child: FCircularProgress())
                  : Icon(order.isOut ? FIcons.circleCheck : FIcons.bike, size: 22),
              child: Text(
                order.isOut ? l10n.markDelivered : l10n.markOnTheWay,
                style: theme.typography.lg.copyWith(fontWeight: FontWeight.w700).forButton,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

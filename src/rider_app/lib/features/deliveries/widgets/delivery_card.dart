import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import '../../../core/network/api_errors.dart';
import '../../../core/services/launcher.dart';
import 'package:ninja_app_core/theme/app_theme.dart';
import 'package:ninja_app_core/theme/text_styles.dart';
import 'package:ninja_app_core/widgets/confirm_dialog.dart';
import '../../../core/widgets/rider_toast.dart';
import '../../../l10n/app_localizations.dart';
import '../models/delivery_order.dart';
import '../providers/deliveries_provider.dart';
import 'fail_reason_dialog.dart';

/// One delivery still to do: whom it is for and where (the address, the
/// note that finds the door), what is in the bag, the cash to collect, the
/// way there and the phone a tap away, and the one next step in a button
/// a thumb cannot miss: on the way, then delivered. On the way, it can also
/// not be handed over; then the bag goes back to the branch.
class DeliveryCard extends ConsumerStatefulWidget {
  final DeliveryOrder order;
  final String Function(double) money;

  const DeliveryCard({super.key, required this.order, required this.money});

  @override
  ConsumerState<DeliveryCard> createState() => _DeliveryCardState();
}

class _DeliveryCardState extends ConsumerState<DeliveryCard> {
  bool _busy = false;

  Future<void> _open(Uri uri, String Function(AppLocalizations) failed) async {
    final opened = await openExternal(uri);
    if (!opened && mounted) {
      showRiderToast(context, RiderToastType.error, failed(AppLocalizations.of(context)!));
    }
  }

  /// One move, with the button showing it is under way and the reason told if it does not go through
  Future<void> _run(Future<void> Function() move) async {
    final l10n = AppLocalizations.of(context)!;
    setState(() => _busy = true);
    try {
      await move();
    } catch (e) {
      if (mounted) showRiderToast(context, RiderToastType.error, l10n.failedToUpdate, description: describeError(e, l10n));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
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
      await _run(() => notifier.markDelivered(order.orderNumber));
    } else {
      await _run(() => notifier.markOut(order.orderNumber));
    }
  }

  Future<void> _couldNotDeliver() async {
    final reason = await showFailReasonDialog(context);
    if (reason == null || !mounted) return;
    await _run(() => ref.read(deliveriesProvider.notifier).markFailed(widget.order.orderNumber, reason.code));
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final order = widget.order;
    final muted = theme.colors.mutedForeground;
    final locale = Localizations.localeOf(context);
    final ready = order.readyAt != null;
    final amber = AppColors.amber(theme.colors.brightness);

    final (statusText, statusColor) = switch (order.stage) {
      DeliveryStage.onTheWay => (l10n.onTheWay, theme.colors.primary),
      DeliveryStage.failed => (l10n.bringItBack, amber),
      _ => ready ? (l10n.readyToGo, AppColors.emerald(theme.colors.brightness)) : (l10n.stillCooking, amber),
    };

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: theme.colors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: order.isOut ? theme.colors.primary : order.isFailed ? amber : theme.colors.border,
          width: order.isOut || order.isFailed ? 1.5 : 1,
        ),
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
          // Where it stands, in words (never colour alone): being made, ready, on the way, or to bring back
          Text(statusText, style: theme.typography.sm.copyWith(fontWeight: FontWeight.w600, color: statusColor)),
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
                      order.addressLine(
                        building: l10n.building,
                        floor: l10n.floor,
                        apartment: l10n.apartment,
                        separator: l10n.listSeparator,
                      ),
                      style: theme.typography.base.copyWith(fontWeight: FontWeight.w500),
                    ),
                    if (order.directions != null)
                      Text('"${order.directions}"', style: theme.typography.sm.copyWith(color: muted, fontStyle: FontStyle.italic)),
                    // Taken over the phone without a shared location: Maps searches the words
                    if (!order.hasPin) Text(l10n.noPin, style: theme.typography.sm.copyWith(color: muted)),
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
          // The bag, to check against before leaving: the count kept apart
          // from the dish's name, so a Latin name in Arabic still reads count first
          for (final line in order.lines)
            Padding(
              padding: const EdgeInsets.only(bottom: 2),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('${line.units}×', style: theme.typography.sm.copyWith(color: muted, fontWeight: FontWeight.w600)),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      line.options == null || line.options!.isEmpty
                          ? line.name.getText(locale)
                          : '${line.name.getText(locale)} · ${line.options!.getText(locale)}',
                      style: theme.typography.sm.copyWith(color: muted),
                    ),
                  ),
                ],
              ),
            ),
          const SizedBox(height: 10),
          if (!order.isFailed)
            Row(
              children: [
                Icon(FIcons.banknote, size: 18, color: muted),
                const SizedBox(width: 8),
                Text(l10n.collectCash, style: theme.typography.sm.copyWith(color: muted)),
                const Spacer(),
                Text(widget.money(order.total), style: theme.typography.xl.copyWith(fontWeight: FontWeight.w700)),
              ],
            )
          else
            Text(l10n.bringItBackHint, style: theme.typography.sm.copyWith(color: muted)),
          const SizedBox(height: 12),
          if (!order.isFailed)
            Row(
              children: [
                Expanded(
                  child: SizedBox(
                    height: 48,
                    child: FButton(
                      variant: FButtonVariant.outline,
                      onPress: () => _open(order.directionsUri, (l10n) => l10n.couldNotOpenMaps),
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
                      onPress: order.phone.isEmpty ? null : () => _open(order.phoneUri, (l10n) => l10n.couldNotOpenDialer),
                      prefix: const Icon(FIcons.phone, size: 18),
                      child: Text(l10n.call, style: theme.typography.base.forButton),
                    ),
                  ),
                ),
              ],
            ),
          if (!order.isFailed) ...[
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
          // On the way and the door did not open: the other answer, kept quieter
          if (order.isOut) ...[
            const SizedBox(height: 8),
            SizedBox(
              height: 48,
              child: FButton(
                variant: FButtonVariant.ghost,
                onPress: _busy ? null : _couldNotDeliver,
                child: Text(l10n.couldNotDeliver, style: theme.typography.base.forButton.copyWith(color: theme.colors.destructive)),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

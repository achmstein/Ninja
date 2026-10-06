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
import 'parts.dart';

/// One delivery still to do, read top to bottom as the rider needs it:
/// where it stands and whose it is; where it goes (the street, the door, the
/// note that finds it); what is in the bag; the cash to collect; then the way
/// there and the phone a tap away, and the one next step in a button a thumb
/// cannot miss: on the way, then delivered. On the way, it can also not be
/// handed over; then the bag goes back to the branch.
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
    final green = AppColors.emerald(theme.colors.brightness);
    final sky = theme.colors.brightness == Brightness.dark ? const Color(0xFF38BDF8) : const Color(0xFF0284C7);

    final (statusText, statusColor) = switch (order.stage) {
      DeliveryStage.onTheWay => (l10n.onTheWay, sky),
      DeliveryStage.failed => (l10n.bringItBack, amber),
      _ => ready ? (l10n.readyToGo, green) : (l10n.stillCooking, amber),
    };
    final details = order.addressDetails(
      building: l10n.building,
      floor: l10n.floor,
      apartment: l10n.apartment,
      separator: l10n.listSeparator,
    );

    return Container(
      decoration: BoxDecoration(
        color: theme.colors.card,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: order.isOut ? sky : order.isFailed ? amber : theme.colors.border,
          width: order.isOut || order.isFailed ? 1.5 : 1,
        ),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: theme.colors.brightness == Brightness.dark ? 0.3 : 0.05), blurRadius: 12, offset: const Offset(0, 4)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Where it stands (being made, ready, on the way, to bring back), and its number
                Row(
                  children: [
                    StatusChip(text: statusText, color: statusColor),
                    const Spacer(),
                    Text(
                      l10n.orderNumber(order.orderNumber),
                      style: theme.typography.sm.copyWith(color: muted, fontWeight: FontWeight.w500, fontFeatures: tabular),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  order.customerName == null ? l10n.guest : typed(order.customerName!),
                  style: theme.typography.xl.copyWith(fontWeight: FontWeight.w700, height: 1.25),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 12),
                // Where: the street, the door under it, the note that finds it
                _Inset(
                  icon: FIcons.mapPin,
                  children: [
                    Text(typed(order.address), style: theme.typography.base.copyWith(fontWeight: FontWeight.w600)),
                    if (details != null) Text(details, style: theme.typography.sm.copyWith(color: theme.colors.foreground)),
                    if (order.directions != null) ...[
                      const SizedBox(height: 4),
                      Text(typed('"${order.directions}"'), style: theme.typography.sm.copyWith(color: muted, fontStyle: FontStyle.italic)),
                    ],
                    // Taken over the phone without a shared location: Maps searches the words
                    if (!order.hasPin) ...[
                      const SizedBox(height: 4),
                      Text(l10n.noPin, style: theme.typography.xs.copyWith(color: amber, fontWeight: FontWeight.w500)),
                    ],
                  ],
                ),
                if (order.customerNote != null) ...[
                  const SizedBox(height: 8),
                  _Inset(
                    icon: FIcons.messageSquare,
                    children: [Text(typed(order.customerNote!), style: theme.typography.sm)],
                  ),
                ],
                const SizedBox(height: 14),
                // The bag, to check against before leaving: the count kept apart
                // from the dish's name, so a Latin name in Arabic still reads count first
                Text(l10n.inTheBag, style: theme.typography.xs.copyWith(color: muted, fontWeight: FontWeight.w600)),
                const SizedBox(height: 6),
                for (final line in order.lines)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          constraints: const BoxConstraints(minWidth: 30),
                          height: 24,
                          padding: const EdgeInsets.symmetric(horizontal: 6),
                          alignment: Alignment.center,
                          decoration: BoxDecoration(color: theme.colors.secondary, borderRadius: BorderRadius.circular(6)),
                          child: Text(
                            '${line.units}×',
                            style: theme.typography.sm.copyWith(fontWeight: FontWeight.w700, fontFeatures: tabular, height: 1),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Padding(
                            padding: const EdgeInsets.only(top: 2),
                            child: Text(
                              line.options == null || line.options!.isEmpty
                                  ? line.name.getText(locale)
                                  : '${line.name.getText(locale)} · ${line.options!.getText(locale)}',
                              style: theme.typography.sm,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          // The money, on a band of its own: what to collect at the door, or that the bag goes back
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 16),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: order.isFailed ? amber.withValues(alpha: 0.1) : theme.colors.muted,
              borderRadius: BorderRadius.circular(14),
            ),
            child: order.isFailed
                ? Row(
                    children: [
                      Icon(FIcons.undo2, size: 18, color: amber),
                      const SizedBox(width: 10),
                      Expanded(child: Text(l10n.bringItBackHint, style: theme.typography.sm)),
                    ],
                  )
                : Row(
                    children: [
                      Icon(FIcons.banknote, size: 20, color: muted),
                      const SizedBox(width: 10),
                      Text(l10n.collectCash, style: theme.typography.sm.copyWith(color: muted, fontWeight: FontWeight.w500)),
                      const SizedBox(width: 8),
                      Expanded(
                        child: FittedBox(
                          fit: BoxFit.scaleDown,
                          alignment: AlignmentDirectional.centerEnd,
                          child: Text(
                            widget.money(order.total),
                            maxLines: 1,
                            style: theme.typography.xl2.copyWith(fontWeight: FontWeight.w700, fontFeatures: tabular),
                          ),
                        ),
                      ),
                    ],
                  ),
          ),
          if (!order.isFailed)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: SizedBox(
                          height: 52,
                          child: FButton(
                            variant: FButtonVariant.outline,
                            onPress: () => _open(order.directionsUri, (l10n) => l10n.couldNotOpenMaps),
                            prefix: const Icon(FIcons.navigation, size: 18),
                            child: Text(l10n.navigate, style: theme.typography.base.copyWith(fontWeight: FontWeight.w600).forButton),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: SizedBox(
                          height: 52,
                          child: FButton(
                            variant: FButtonVariant.outline,
                            onPress: order.phone.isEmpty ? null : () => _open(order.phoneUri, (l10n) => l10n.couldNotOpenDialer),
                            prefix: const Icon(FIcons.phone, size: 18),
                            child: Text(l10n.call, style: theme.typography.base.copyWith(fontWeight: FontWeight.w600).forButton),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  SizedBox(
                    height: 60,
                    child: FButton(
                      onPress: _busy ? null : _next,
                      prefix: _busy
                          ? const SizedBox.square(dimension: 20, child: FCircularProgress())
                          : Icon(order.isOut ? FIcons.circleCheck : FIcons.motorbike, size: 24),
                      child: Text(
                        order.isOut ? l10n.markDelivered : l10n.markOnTheWay,
                        style: theme.typography.lg.copyWith(fontWeight: FontWeight.w700).forButton,
                      ),
                    ),
                  ),
                  // On the way and the door did not open: the other answer, kept quieter
                  if (order.isOut) ...[
                    const SizedBox(height: 4),
                    SizedBox(
                      height: 48,
                      child: FButton(
                        variant: FButtonVariant.ghost,
                        onPress: _busy ? null : _couldNotDeliver,
                        child: Text(
                          l10n.couldNotDeliver,
                          style: theme.typography.base.forButton.copyWith(color: theme.colors.destructive, fontWeight: FontWeight.w600),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            )
          else
            const SizedBox(height: 16),
        ],
      ),
    );
  }
}

/// A soft block with its icon at the start: the address, the customer's note
class _Inset extends StatelessWidget {
  final IconData icon;
  final List<Widget> children;

  const _Inset({required this.icon, required this.children});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(color: theme.colors.secondary, borderRadius: BorderRadius.circular(10)),
          child: Icon(icon, size: 16, color: theme.colors.foreground),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: children),
          ),
        ),
      ],
    );
  }
}

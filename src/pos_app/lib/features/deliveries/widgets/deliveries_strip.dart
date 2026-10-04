import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import '../../../core/brand/brand_provider.dart';
import '../../../core/models/localized_text.dart';
import '../../../core/models/money.dart';
import '../../../core/network/api_errors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/text_styles.dart';
import '../../../core/utils/bidi.dart';
import '../../../core/widgets/pos_dialog.dart';
import '../../../core/widgets/pos_toast.dart';
import '../../../l10n/app_localizations.dart';
import '../../orders/status.dart';
import '../../tickets/providers/tickets_provider.dart';
import '../models/delivery_order.dart';
import '../providers/deliveries_provider.dart';
import '../services/delivery_service.dart';
import 'delivery_details.dart';

/// The branch's deliveries on the floor, by where each one stands: waiting
/// for a rider, with a rider (and whether they have left), delivered with
/// the cash still out. A tap gives one to a rider or takes the cash in.
/// Gone when there is nothing out, and where the business does not deliver.
class DeliveriesStrip extends ConsumerStatefulWidget {
  const DeliveriesStrip({super.key});

  @override
  ConsumerState<DeliveriesStrip> createState() => _DeliveriesStripState();
}

class _DeliveriesStripState extends ConsumerState<DeliveriesStrip> {
  Timer? _clock;

  @override
  void dispose() {
    _clock?.cancel();
    super.dispose();
  }

  // The ages tick while anything is out
  void _syncClock(bool running) {
    if (running && _clock == null) {
      _clock = Timer.periodic(const Duration(seconds: 30), (_) => setState(() {}));
    } else if (!running && _clock != null) {
      _clock!.cancel();
      _clock = null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    if (!ref.watch(featuresProvider.select((f) => f.delivery))) {
      _syncClock(false);
      return const SizedBox.shrink();
    }
    final deliveries = ref.watch(deliveriesProvider).value ?? const <DeliveryOrder>[];
    _syncClock(deliveries.isNotEmpty);
    if (deliveries.isEmpty) return const SizedBox.shrink();
    final now = DateTime.now();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Icon(FIcons.bike, size: 20, color: theme.colors.primary),
            const SizedBox(width: 8),
            Text(l10n.deliveries, style: theme.typography.lg.copyWith(fontWeight: FontWeight.w600)),
            const SizedBox(width: 8),
            FBadge(child: Text('${deliveries.length}', style: const TextStyle(fontFeatures: [FontFeature.tabularFigures()]))),
          ],
        ),
        const SizedBox(height: 8),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.only(bottom: 4),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (final (index, order) in deliveries.indexed) ...[
                if (index > 0) const SizedBox(width: 12),
                _DeliveryCard(order: order, now: now, onTap: () => showDeliveryDialog(context, order.orderNumber)),
              ],
            ],
          ),
        ),
        const SizedBox(height: 16),
      ],
    );
  }
}

class _DeliveryCard extends StatelessWidget {
  final DeliveryOrder order;
  final DateTime now;
  final VoidCallback onTap;

  const _DeliveryCard({required this.order, required this.now, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final lane = order.lane;
    final name = (order.customerName ?? '').isEmpty ? l10n.guest : order.customerName!;
    final border = switch (lane) {
      DeliveryLane.waiting => AppColors.amber500.withValues(alpha: 0.7),
      DeliveryLane.cashDue => AppColors.emerald500.withValues(alpha: 0.7),
      _ => theme.colors.border,
    };

    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        width: 300,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: theme.colors.background,
          border: Border.all(color: border),
          borderRadius: BorderRadius.circular(14),
        ),
        // Who and what to collect; where; then how it stands and since when.
        // Each line holds one thing, so no language's longer words push
        // another out of the card
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                Flexible(
                  child: Text(name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.typography.base.copyWith(fontWeight: FontWeight.w600)),
                ),
                const SizedBox(width: 6),
                Text(bidiIsolate('#${order.orderNumber}'),
                    style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground)),
                const Spacer(),
                Text(money(context, order.total),
                    style: theme.typography.sm.copyWith(
                        fontWeight: FontWeight.w600, fontFeatures: const [FontFeature.tabularFigures()])),
              ],
            ),
            const SizedBox(height: 4),
            Row(
              children: [
                Icon(FIcons.mapPin, size: 14, color: theme.colors.mutedForeground),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(addressLine(l10n, order.delivery),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground)),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(child: _StageChip(order: order)),
                const SizedBox(width: 8),
                Text(relativeTime(context, l10n, order.since, now),
                    style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Where the delivery has got to: a long rider name wraps under its first
/// line rather than being cut, and the icon keeps its size beside that line
class _StageChip extends StatelessWidget {
  final DeliveryOrder order;

  const _StageChip({required this.order});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final d = order.delivery;
    final rider = d.riderName ?? '';
    final (icon, text, color) = switch (order.lane) {
      DeliveryLane.waiting => (
          FIcons.clock,
          order.readyAt != null ? l10n.deliveryReadyNoRider : l10n.deliveryNoRider,
          AppColors.amber(theme.colors.brightness)
        ),
      DeliveryLane.cashDue => (FIcons.banknote, l10n.deliveryCashWith(rider), AppColors.emerald(theme.colors.brightness)),
      _ when d.outAt != null => (FIcons.bike, l10n.deliveryOnTheWayWith(rider), theme.colors.foreground),
      _ => (FIcons.circleDot, l10n.deliveryWith(rider), theme.colors.foreground),
    };
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(padding: const EdgeInsets.only(top: 2), child: Icon(icon, size: 14, color: color)),
        const SizedBox(width: 4),
        Expanded(child: Text(text, style: theme.typography.sm.copyWith(fontWeight: FontWeight.w500, color: color))),
      ],
    );
  }
}

/// One delivery: where it goes and what is in it, who has it, and the cash.
/// Reads the board live, so a rider's step lands while it is open.
Future<void> showDeliveryDialog(BuildContext context, int orderNumber) =>
    showPosDialog<void>(context, builder: (_) => _DeliveryDialog(orderNumber: orderNumber));

class _DeliveryDialog extends ConsumerStatefulWidget {
  final int orderNumber;

  const _DeliveryDialog({required this.orderNumber});

  @override
  ConsumerState<_DeliveryDialog> createState() => _DeliveryDialogState();
}

class _DeliveryDialogState extends ConsumerState<_DeliveryDialog> {
  bool _busy = false;

  Future<void> _act(Future<void> Function(DeliveryRepository repository) call, {String? done, bool close = false}) async {
    final l10n = AppLocalizations.of(context)!;
    setState(() => _busy = true);
    try {
      await call(ref.read(deliveryRepositoryProvider));
      await ref.read(deliveriesProvider.notifier).refresh();
      ref.invalidate(tillRidersProvider);
      ref.read(openTicketsProvider.notifier).refresh();
      if (!mounted) return;
      if (done != null) showPosToast(context, PosToastType.success, done);
      if (close) Navigator.of(context, rootNavigator: true).pop();
    } catch (e) {
      if (!mounted) return;
      // The server's reason when it gave one; otherwise "try again"
      final said = describeError(e, l10n);
      showPosToast(context, PosToastType.error, said == l10n.somethingWentWrong ? l10n.deliveryActionFailed : said);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final order = (ref.watch(deliveriesProvider).value ?? const <DeliveryOrder>[])
        .where((d) => d.orderNumber == widget.orderNumber)
        .firstOrNull;
    // Settled (or gone from the board) while open: nothing left to do here
    if (order == null) {
      return DialogScroll(child: Center(child: Text(l10n.orderNumber(widget.orderNumber), style: theme.typography.lg)));
    }
    final lane = order.lane;
    final d = order.delivery;
    final out = d.outAt != null;
    final choosing = lane == DeliveryLane.waiting || (lane == DeliveryLane.withRider && !out);
    final id = order.orderNumber;
    final rider = d.riderName ?? '';

    return DialogScroll(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(l10n.orderNumber(id), style: theme.typography.xl.copyWith(fontWeight: FontWeight.w700)),
          const SizedBox(height: 2),
          Text('${(order.customerName ?? '').isEmpty ? l10n.guest : order.customerName!} · ${money(context, order.total)}',
              style: theme.typography.base.copyWith(color: theme.colors.mutedForeground)),
          const SizedBox(height: 16),
          DeliveryDetails(delivery: d),
          const SizedBox(height: 12),
          // The count and the name apart, so an English dish name in Arabic still reads count first
          for (final item in order.items)
            Padding(
              padding: const EdgeInsets.only(bottom: 2),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('${item.units}×', style: theme.typography.sm.copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      [item.name.localized(context), if (item.options != null) item.options!.localized(context)].join(' · '),
                      style: theme.typography.sm,
                    ),
                  ),
                ],
              ),
            ),
          if (choosing) ...[
            const SizedBox(height: 16),
            Text(l10n.deliveryGiveTo, style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground)),
            const SizedBox(height: 8),
            _RiderPicker(
              currentRiderId: d.riderUserId,
              busy: _busy,
              onPick: (picked) => _act((r) => r.assignRider(id, picked)),
            ),
            if (lane == DeliveryLane.withRider) ...[
              const SizedBox(height: 8),
              SizedBox(
                height: 44,
                child: FButton(
                  variant: FButtonVariant.outline,
                  onPress: _busy ? null : () => _act((r) => r.unassignRider(id)),
                  prefix: const Icon(FIcons.x, size: 16),
                  child: Text(l10n.deliveryTakeBack, style: theme.typography.base.forButton),
                ),
              ),
            ],
          ],
          // For a rider whose phone cannot say it (a flat battery, no app):
          // the till says it left, then that it arrived, so the cash can come in
          if (lane == DeliveryLane.withRider) ...[
            const SizedBox(height: 16),
            Container(height: 1, color: theme.colors.border),
            const SizedBox(height: 12),
            Text(l10n.deliveryForRider(rider), style: theme.typography.xs.copyWith(color: theme.colors.mutedForeground)),
            const SizedBox(height: 6),
            SizedBox(
              height: 44,
              child: FButton(
                variant: FButtonVariant.outline,
                onPress: _busy ? null : () => _act((r) => out ? r.markDelivered(id) : r.markOut(id)),
                prefix: Icon(out ? FIcons.check : FIcons.bike, size: 16),
                child: Text(out ? l10n.deliveryMarkDelivered : l10n.deliveryMarkOut, style: theme.typography.base.forButton),
              ),
            ),
          ],
          if (lane == DeliveryLane.cashDue) ...[
            const SizedBox(height: 16),
            SizedBox(
              height: 52,
              child: FButton(
                onPress: _busy ? null : () => _act((r) => r.cashIn(id), done: l10n.deliveryCashTaken, close: true),
                prefix: const Icon(FIcons.banknote, size: 20),
                child: Text(l10n.deliveryTakeCash(money(context, order.total), rider), style: theme.typography.base.forButton),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// The branch's riders, on duty first, then those who have not opened the
/// rider app yet; the one that has it is ticked
class _RiderPicker extends ConsumerWidget {
  final String? currentRiderId;
  final bool busy;
  final void Function(TillRider rider) onPick;

  const _RiderPicker({required this.currentRiderId, required this.busy, required this.onPick});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final riders = ref.watch(tillRidersProvider);
    return riders.when(
      loading: () => const SizedBox(height: 56, child: Center(child: FCircularProgress())),
      error: (_, _) => Text(l10n.somethingWentWrong, style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground)),
      data: (riders) {
        if (riders.isEmpty) {
          return Text(l10n.deliveryNoRiders, style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground));
        }
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (final rider in riders)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: _RiderRow(
                  rider: rider,
                  current: rider.userId == currentRiderId,
                  disabled: busy,
                  onTap: () => onPick(rider),
                  status: !rider.signedIn
                      ? l10n.riderNotSignedIn
                      : rider.onDuty
                          ? (rider.out > 0 ? l10n.riderOut(rider.out) : l10n.riderFree)
                          : l10n.riderOffDuty,
                ),
              ),
          ],
        );
      },
    );
  }
}

class _RiderRow extends StatelessWidget {
  final TillRider rider;
  final bool current;
  final bool disabled;
  final String status;
  final VoidCallback onTap;

  const _RiderRow({required this.rider, required this.current, required this.disabled, required this.status, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final dot = rider.onDuty ? AppColors.emerald500 : theme.colors.mutedForeground;
    return Opacity(
      opacity: rider.onDuty || current ? 1 : 0.6,
      child: InkWell(
        onTap: disabled || current ? null : onTap,
        borderRadius: BorderRadius.circular(10),
        child: Container(
          height: 56,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            color: current ? theme.colors.primary.withValues(alpha: 0.05) : null,
            border: Border.all(color: current ? theme.colors.primary : theme.colors.border),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Row(
            children: [
              Stack(
                clipBehavior: Clip.none,
                children: [
                  const Icon(FIcons.userRound, size: 20),
                  PositionedDirectional(
                    end: -2,
                    bottom: -2,
                    child: Container(
                      width: 10,
                      height: 10,
                      decoration: BoxDecoration(
                        color: dot,
                        shape: BoxShape.circle,
                        border: Border.all(color: theme.colors.background, width: 2),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(rider.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: theme.typography.base.copyWith(fontWeight: FontWeight.w500)),
                    Text(status, style: theme.typography.xs.copyWith(color: theme.colors.mutedForeground)),
                  ],
                ),
              ),
              if (current) Icon(FIcons.check, size: 20, color: theme.colors.primary),
            ],
          ),
        ),
      ),
    );
  }
}

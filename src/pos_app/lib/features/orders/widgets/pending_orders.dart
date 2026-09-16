import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import '../../../core/models/localized_text.dart';
import '../../../core/models/money.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/text_styles.dart';
import '../../../core/widgets/pos_toast.dart';
import '../../../l10n/app_localizations.dart';
import '../models/order.dart';
import '../providers/pending_orders_provider.dart';
import '../status.dart';
import 'order_detail_dialog.dart';
import '../../../core/utils/bidi.dart';

/// The queue of customer app orders waiting for a cashier's tap, wherever
/// it is shown: sideways on the floor, stacked on the ticket they will land
/// on. Confirm is right on the card — the usual answer — and the card body
/// opens the items for a look, or a cancel.
class PendingOrders extends ConsumerStatefulWidget {
  final List<Order> orders;
  final bool horizontal;

  const PendingOrders({super.key, required this.orders, this.horizontal = false});

  @override
  ConsumerState<PendingOrders> createState() => _PendingOrdersState();
}

class _PendingOrdersState extends ConsumerState<PendingOrders> {
  // Ages and urgency advance every half minute without a refetch
  late final Timer _clock = Timer.periodic(const Duration(seconds: 30), (_) => setState(() {}));
  int? _acting;

  @override
  void dispose() {
    _clock.cancel();
    super.dispose();
  }

  Future<void> _confirm(int orderId) async {
    final l10n = AppLocalizations.of(context)!;
    setState(() => _acting = orderId);
    final ok = await ref.read(pendingOrdersProvider.notifier).confirm(orderId);
    if (!mounted) return;
    setState(() => _acting = null);
    showPosToast(context, ok ? PosToastType.success : PosToastType.error, ok ? l10n.orderConfirmed : l10n.failedToConfirmOrder);
  }

  Future<void> _cancel(int orderId) async {
    final l10n = AppLocalizations.of(context)!;
    setState(() => _acting = orderId);
    final ok = await ref.read(pendingOrdersProvider.notifier).cancel(orderId);
    if (!mounted) return;
    setState(() => _acting = null);
    showPosToast(context, ok ? PosToastType.success : PosToastType.error, ok ? l10n.orderCancelled : l10n.failedToCancelOrder);
  }

  Future<void> _open(int orderId) async {
    final action = await showOrderDetailDialog(context, orderId);
    if (!mounted || action == null) return;
    switch (action) {
      case OrderDetailAction.confirm:
        await _confirm(orderId);
      case OrderDetailAction.cancel:
        await _cancel(orderId);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (widget.orders.isEmpty) return const SizedBox.shrink();
    final now = DateTime.now();
    final cards = [
      for (final order in widget.orders)
        _PendingOrderCard(
          order: order,
          now: now,
          horizontal: widget.horizontal,
          acting: _acting == order.id,
          onOpen: () => _open(order.id),
          onConfirm: () => _confirm(order.id),
        ),
    ];
    if (widget.horizontal) {
      return SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.only(bottom: 4),
        child: Row(
          children: [
            for (final (index, card) in cards.indexed) ...[if (index > 0) const SizedBox(width: 12), card],
          ],
        ),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final (index, card) in cards.indexed) ...[if (index > 0) const SizedBox(height: 8), card],
      ],
    );
  }
}

class _PendingOrderCard extends StatelessWidget {
  final Order order;
  final DateTime now;
  final bool horizontal;
  final bool acting;
  final VoidCallback onOpen;
  final VoidCallback onConfirm;

  const _PendingOrderCard({
    required this.order,
    required this.now,
    required this.horizontal,
    required this.acting,
    required this.onOpen,
    required this.onConfirm,
  });

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final urgency = orderUrgency(order.date, now);
    final amber = AppColors.amber(theme.colors.brightness);

    // Named the way the floor names its tiles: the room or table the order
    // is for, or — for an order with neither — the person who placed it
    // LEGACY(places): old roomName/tableName read instead of placeName — remove when Sales, Ordering and Notification stop sending the old room/table fields.
    final room = order.roomName?.localized(context) ?? '';
    final table = order.tableName?.localized(context) ?? '';
    final who = (order.userName ?? '').isNotEmpty ? order.userName! : l10n.guest;
    final title = room.isNotEmpty ? room : (table.isNotEmpty ? table : who);
    final subtitle = room.isNotEmpty || table.isNotEmpty ? who : order.guestPhone;
    final placeIcon = room.isNotEmpty ? FIcons.doorOpen : (table.isNotEmpty ? FIcons.armchair : FIcons.user);
    final ageColor = switch (urgency) {
      OrderUrgency.delayed => theme.colors.destructive,
      OrderUrgency.warning => amber,
      OrderUrgency.fresh => theme.colors.mutedForeground,
    };

    return Container(
      width: horizontal ? 340 : null,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: theme.colors.background,
        border: Border.all(
          color: switch (urgency) {
            OrderUrgency.delayed => theme.colors.destructive.withValues(alpha: 0.7),
            OrderUrgency.warning => AppColors.amber500.withValues(alpha: 0.7),
            OrderUrgency.fresh => theme.colors.border,
          },
        ),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          // The body opens the items; a separate button confirms, so neither
          // tap can be mistaken for the other
          Expanded(
            child: FTappable(
              onPress: onOpen,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(placeIcon, size: 16, color: theme.colors.mutedForeground),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: theme.typography.base.copyWith(fontWeight: FontWeight.w600)),
                      ),
                    ],
                  ),
                  Text(
                    subtitle == null || subtitle.isEmpty ? '#${order.id}' : '${bidiIsolate('#${order.id}')} · $subtitle',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground),
                  ),
                  Text(
                    '${relativeTime(context, l10n, order.date, now)} · ${money(context, order.total)}',
                    style: theme.typography.sm.copyWith(
                      color: ageColor,
                      fontWeight: urgency == OrderUrgency.fresh ? FontWeight.w400 : FontWeight.w500,
                      fontFeatures: const [FontFeature.tabularFigures()],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(width: 12),
          SizedBox(
            height: 48,
            child: FButton(
              mainAxisSize: MainAxisSize.min,
              onPress: acting ? null : onConfirm,
              prefix: const Icon(FIcons.check, size: 20),
              child: Text(l10n.confirmOrder, style: theme.typography.base.forButton),
            ),
          ),
        ],
      ),
    );
  }
}

/// The floor's strip: heading, count and the queue — and nothing at all
/// when it is empty, so the tiles keep the whole screen on a quiet afternoon.
class PendingOrdersStrip extends ConsumerWidget {
  const PendingOrdersStrip({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final pending = ref.watch(pendingOrdersProvider).value ?? const <Order>[];
    if (pending.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Icon(FIcons.clock, size: 20, color: AppColors.amber(theme.colors.brightness)),
            const SizedBox(width: 8),
            Text(l10n.pendingOrders, style: theme.typography.lg.copyWith(fontWeight: FontWeight.w600)),
            const SizedBox(width: 8),
            FBadge(child: Text('${pending.length}', style: const TextStyle(fontFeatures: [FontFeature.tabularFigures()]))),
          ],
        ),
        const SizedBox(height: 8),
        PendingOrders(orders: pending, horizontal: true),
        const SizedBox(height: 16),
      ],
    );
  }
}

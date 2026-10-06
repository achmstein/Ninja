import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import 'package:ninja_app_core/theme/app_theme.dart';
import 'package:ninja_app_core/theme/text_styles.dart';
import '../../../core/brand/brand_provider.dart';
import '../../../core/models/money.dart';
import '../../../core/widgets/pos_toast.dart';
import '../../../l10n/app_localizations.dart';
import '../delivery_errors.dart';
import '../models/delivery_board.dart';
import '../models/delivery_order.dart';
import '../providers/deliveries_provider.dart';
import '../widgets/delivery_card.dart';
import '../widgets/delivery_dialog.dart';
import '../widgets/rider_cash_dialog.dart';

/// Below this the four columns would be too narrow to read: one at a time, picked by its chip
const _fourColumnsFrom = 1000.0;

/// What the board's chips and columns say of each lane
extension BoardLaneText on BoardLane {
  String label(AppLocalizations l10n) => switch (this) {
        BoardLane.waiting => l10n.laneWaiting,
        BoardLane.withRiders => l10n.laneWithRiders,
        BoardLane.comingBack => l10n.laneComingBack,
        BoardLane.cashDue => l10n.laneCashDue,
      };

  IconData get icon => switch (this) {
        BoardLane.waiting => FIcons.clock,
        BoardLane.withRiders => FIcons.bike,
        BoardLane.comingBack => FIcons.undo2,
        BoardLane.cashDue => FIcons.banknote,
      };

  /// The lanes that need the cashier are tinted: someone is waiting on them
  Color? tint(Brightness brightness) => switch (this) {
        BoardLane.waiting || BoardLane.comingBack => AppColors.amber(brightness),
        BoardLane.cashDue => AppColors.emerald(brightness),
        BoardLane.withRiders => null,
      };
}

/// The branch's deliveries on a screen of their own, however many there are:
/// four columns, each scrolling on its own (waiting for a rider, with riders,
/// coming back, cash to take in). Riders out and riders owing cash are
/// grouped by rider, and a rider's cash is taken in for all their
/// deliveries at once. A card opens the delivery, as it does anywhere.
class DeliveriesBoardScreen extends ConsumerStatefulWidget {
  const DeliveriesBoardScreen({super.key});

  @override
  ConsumerState<DeliveriesBoardScreen> createState() => _DeliveriesBoardScreenState();
}

class _DeliveriesBoardScreenState extends ConsumerState<DeliveriesBoardScreen> {
  /// The lane shown where only one fits
  BoardLane? _picked;

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final delivering = ref.watch(featuresProvider.select((f) => f.delivery));
    final deliveries = ref.watch(deliveriesProvider);
    final now = ref.watch(deliveriesClockProvider).value ?? DateTime.now();
    final lanes = byLane(deliveries.value ?? const []);
    final total = lanes.values.fold(0, (sum, l) => sum + l.length);
    // The narrow board opens on the lane the cashier most likely came for
    final shown = _picked ??
        [BoardLane.cashDue, BoardLane.waiting, BoardLane.comingBack].where((l) => lanes[l]!.isNotEmpty).firstOrNull ??
        BoardLane.withRiders;

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              SizedBox.square(
                dimension: 48,
                child: FButton.icon(
                  variant: FButtonVariant.ghost,
                  onPress: () => context.go('/'),
                  child: const Icon(FIcons.arrowLeft, size: 24),
                ),
              ),
              const SizedBox(width: 8),
              Text(l10n.deliveries, style: theme.typography.xl.copyWith(fontWeight: FontWeight.w700)),
              const SizedBox(width: 10),
              FBadge(child: Text('$total', style: const TextStyle(fontFeatures: [FontFeature.tabularFigures()]))),
              const Spacer(),
              SizedBox.square(
                dimension: 48,
                child: FButton.icon(
                  variant: FButtonVariant.outline,
                  onPress: () => ref.read(deliveriesProvider.notifier).refresh(),
                  child: const Icon(FIcons.refreshCw, size: 20),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Expanded(
            child: !delivering
                ? Center(child: Text(l10n.deliveryErrorNotDelivering, style: theme.typography.base.copyWith(color: theme.colors.mutedForeground)))
                : deliveries.isLoading && !deliveries.hasValue
                    ? const Center(child: FCircularProgress())
                    : LayoutBuilder(
                        builder: (context, constraints) {
                          if (constraints.maxWidth >= _fourColumnsFrom) {
                            return Row(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                for (final (index, lane) in BoardLane.values.indexed) ...[
                                  if (index > 0) const SizedBox(width: 12),
                                  Expanded(child: _Column(lane: lane, orders: lanes[lane]!, now: now)),
                                ],
                              ],
                            );
                          }
                          return Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              SingleChildScrollView(
                                scrollDirection: Axis.horizontal,
                                child: Row(
                                  children: [
                                    for (final lane in BoardLane.values)
                                      Padding(
                                        padding: const EdgeInsetsDirectional.only(end: 8),
                                        child: _LaneChip(
                                          lane: lane,
                                          count: lanes[lane]!.length,
                                          selected: lane == shown,
                                          onPress: () => setState(() => _picked = lane),
                                        ),
                                      ),
                                  ],
                                ),
                              ),
                              const SizedBox(height: 12),
                              Expanded(child: _Column(lane: shown, orders: lanes[shown]!, now: now, header: false)),
                            ],
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }
}

/// A lane's chip on the narrow board: its name and how many
class _LaneChip extends StatelessWidget {
  final BoardLane lane;
  final int count;
  final bool selected;
  final VoidCallback onPress;

  const _LaneChip({required this.lane, required this.count, required this.selected, required this.onPress});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    return SizedBox(
      height: 44,
      child: FButton(
        variant: selected ? null : FButtonVariant.outline,
        mainAxisSize: MainAxisSize.min,
        onPress: onPress,
        prefix: Icon(lane.icon, size: 16),
        child: Text('${lane.label(l10n)} · $count', style: theme.typography.sm.copyWith(fontWeight: FontWeight.w600).forButton),
      ),
    );
  }
}

/// One lane: its heading and count, then its deliveries, scrolling on their
/// own. With riders and cash due come grouped by rider.
class _Column extends ConsumerWidget {
  final BoardLane lane;
  final List<DeliveryOrder> orders;
  final DateTime now;
  final bool header;

  const _Column({required this.lane, required this.orders, required this.now, this.header = true});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final tint = lane.tint(theme.colors.brightness);
    final grouped = lane == BoardLane.withRiders || lane == BoardLane.cashDue;

    Widget card(DeliveryOrder order) => Padding(
          key: ValueKey(order.orderNumber),
          padding: const EdgeInsets.only(bottom: 8),
          child: DeliveryCard(order: order, now: now, onTap: () => showDeliveryDialog(context, order.orderNumber)),
        );

    return Container(
      decoration: BoxDecoration(
        color: theme.colors.muted.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (header)
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 14, 14, 10),
              child: Row(
                children: [
                  Icon(lane.icon, size: 18, color: tint ?? theme.colors.mutedForeground),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(lane.label(l10n),
                        maxLines: 1, overflow: TextOverflow.ellipsis, style: theme.typography.base.copyWith(fontWeight: FontWeight.w600)),
                  ),
                  Container(
                    height: 24,
                    constraints: const BoxConstraints(minWidth: 24),
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: orders.isNotEmpty && tint != null ? tint.withValues(alpha: 0.15) : theme.colors.background,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text('${orders.length}',
                        style: theme.typography.sm.copyWith(fontWeight: FontWeight.w600, fontFeatures: const [FontFeature.tabularFigures()])),
                  ),
                ],
              ),
            ),
          Expanded(
            child: orders.isEmpty
                ? Center(child: Text(l10n.laneEmpty, style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground)))
                : ListView(
                    padding: EdgeInsets.fromLTRB(10, header ? 0 : 10, 10, 10),
                    children: [
                      if (!grouped)
                        for (final order in orders) card(order)
                      else
                        for (final group in byRider(orders))
                          _RiderBlock(
                            key: ValueKey('rider-${group.riderUserId}'),
                            group: group,
                            cash: lane == BoardLane.cashDue,
                            children: [for (final order in group.orders) card(order)],
                          ),
                    ],
                  ),
          ),
        ],
      ),
    );
  }
}

/// A rider's deliveries in a lane, under their name: how many, and in the
/// cash lane what they owe with the one button that takes it all in
class _RiderBlock extends ConsumerStatefulWidget {
  final RiderGroup group;
  final bool cash;
  final List<Widget> children;

  const _RiderBlock({super.key, required this.group, required this.cash, required this.children});

  @override
  ConsumerState<_RiderBlock> createState() => _RiderBlockState();
}

class _RiderBlockState extends ConsumerState<_RiderBlock> {
  bool _busy = false;

  Future<void> _takeCash() async {
    final l10n = AppLocalizations.of(context)!;
    final amounts = await showRiderCashDialog(context, rider: widget.group);
    if (amounts == null || amounts.isEmpty || !mounted) return;
    setState(() => _busy = true);
    try {
      await ref.read(deliveryActionsProvider).cashInMany(amounts);
      if (mounted) showPosToast(context, PosToastType.success, l10n.riderCashTaken(amounts.length));
    } catch (e) {
      if (mounted) showPosToast(context, PosToastType.error, describeDeliveryError(e, l10n));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final group = widget.group;
    final name = group.riderName ?? l10n.deliveryNoRider;
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.fromLTRB(10, 10, 10, 2),
      decoration: BoxDecoration(
        color: theme.colors.background,
        border: Border.all(color: theme.colors.border),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                width: 32,
                height: 32,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: theme.colors.secondary, shape: BoxShape.circle),
                child: Text(
                  name.characters.first.toUpperCase(),
                  style: theme.typography.sm.copyWith(fontWeight: FontWeight.w700),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: theme.typography.base.copyWith(fontWeight: FontWeight.w600)),
                    Text(
                      widget.cash ? '${l10n.riderOrders(group.orders.length)} · ${money(context, group.total)}' : l10n.riderOrders(group.orders.length),
                      style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground, fontFeatures: const [FontFeature.tabularFigures()]),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (widget.cash) ...[
            const SizedBox(height: 10),
            SizedBox(
              height: 48,
              child: FButton(
                onPress: _busy ? null : _takeCash,
                prefix: _busy ? const SizedBox.square(dimension: 18, child: FCircularProgress()) : const Icon(FIcons.banknote, size: 18),
                child: Text(l10n.riderCashTake, style: theme.typography.base.forButton),
              ),
            ),
          ],
          const SizedBox(height: 10),
          ...widget.children,
        ],
      ),
    );
  }
}

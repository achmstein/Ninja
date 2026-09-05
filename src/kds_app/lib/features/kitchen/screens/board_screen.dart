import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:shimmer/shimmer.dart';
import '../../../core/network/api_errors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/kds_toast.dart';
import '../../../l10n/app_localizations.dart';
import '../models/kitchen_order.dart';
import '../providers/kitchen_orders_provider.dart';
import '../widgets/order_card.dart';

/// The kitchen board, as kds_web's Board: three lanes — New, In progress,
/// Ready — each scrolling on its own, oldest order first. Everything
/// confirmed lands in New the moment it is confirmed (app order, table QR
/// or counter sale alike); Start and Ready move it right, Recall brings a
/// bumped card back, and Ready cards clear themselves after half an hour.
/// Sized to be read from across a kitchen and tapped with a wet finger.
class BoardScreen extends ConsumerStatefulWidget {
  const BoardScreen({super.key});

  @override
  ConsumerState<BoardScreen> createState() => _BoardScreenState();
}

class _BoardScreenState extends ConsumerState<BoardScreen> {
  // One second-hand for the whole board; every card reads the same `now`
  Timer? _clock;
  final Set<int> _acting = {};

  @override
  void initState() {
    super.initState();
    _clock = Timer.periodic(const Duration(seconds: 1), (_) => setState(() {}));
  }

  @override
  void dispose() {
    _clock?.cancel();
    super.dispose();
  }

  Future<void> _act(KitchenOrder order, PreparationStatus target) async {
    final id = order.orderNumber;
    if (_acting.contains(id)) return;
    setState(() => _acting.add(id));
    try {
      await ref.read(kitchenOrdersProvider.notifier).setPreparation(id, target);
    } catch (e) {
      if (mounted) {
        final l10n = AppLocalizations.of(context)!;
        showKdsToast(context, KdsToastType.error, l10n.failedToUpdate, description: describeError(e, l10n));
      }
    } finally {
      if (mounted) setState(() => _acting.remove(id));
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final async = ref.watch(kitchenOrdersProvider);
    final orders = async.value ?? const <KitchenOrder>[];
    final isLoading = async.isLoading && async.value == null;
    final now = DateTime.now();

    if (!isLoading && orders.isEmpty) return const _EmptyBoard();

    final lanes = [
      (PreparationStatus.notStarted, l10n.laneNew, AppColors.sky500),
      (PreparationStatus.preparing, l10n.laneInProgress, AppColors.amber500),
      (PreparationStatus.ready, l10n.laneReady, AppColors.emerald500),
    ];

    return Padding(
      padding: const EdgeInsets.all(12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final (index, lane) in lanes.indexed) ...[
            if (index > 0) const SizedBox(width: 12),
            Expanded(
              child: _Lane(
                title: lane.$2,
                dot: lane.$3,
                orders: laneOrders(orders, lane.$1),
                loading: isLoading && lane.$1 == PreparationStatus.notStarted,
                now: now,
                acting: _acting,
                onAct: _act,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _Lane extends StatelessWidget {
  final String title;
  final Color dot;
  final List<KitchenOrder> orders;
  final bool loading;
  final DateTime now;
  final Set<int> acting;
  final void Function(KitchenOrder order, PreparationStatus target) onAct;

  const _Lane({
    required this.title,
    required this.dot,
    required this.orders,
    required this.loading,
    required this.now,
    required this.acting,
    required this.onAct,
  });

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    return Container(
      decoration: BoxDecoration(
        color: theme.colors.muted.withValues(alpha: 0.3),
        border: Border.all(color: theme.colors.border),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            child: Row(
              children: [
                Container(width: 12, height: 12, decoration: BoxDecoration(color: dot, shape: BoxShape.circle)),
                const SizedBox(width: 8),
                Text(title, style: theme.typography.lg.copyWith(fontWeight: FontWeight.w600)),
                const SizedBox(width: 8),
                FBadge(
                  variant: FBadgeVariant.secondary,
                  child: Text('${orders.length}', style: const TextStyle(fontFeatures: [FontFeature.tabularFigures()])),
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
              children: [
                if (loading)
                  for (var i = 0; i < 2; i++)
                    const Padding(padding: EdgeInsets.only(bottom: 12), child: _CardSkeleton()),
                for (final (index, order) in orders.indexed)
                  Padding(
                    padding: EdgeInsets.only(top: index > 0 ? 12 : 0),
                    child: OrderCard(
                      key: ValueKey(order.orderNumber),
                      order: order,
                      now: now,
                      acting: acting.contains(order.orderNumber),
                      onStart: () => onAct(order, PreparationStatus.preparing),
                      onReady: () => onAct(order, PreparationStatus.ready),
                      onRecall: () => onAct(order, PreparationStatus.preparing),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// A card-sized placeholder while the first board loads
class _CardSkeleton extends StatelessWidget {
  const _CardSkeleton();

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    return Shimmer.fromColors(
      baseColor: theme.colors.muted,
      highlightColor: theme.colors.background,
      child: Container(
        height: 160,
        decoration: BoxDecoration(color: theme.colors.muted, borderRadius: BorderRadius.circular(12)),
      ),
    );
  }
}

/// Nothing to prepare — the state a kitchen hopes to see at the end of the night
class _EmptyBoard extends StatelessWidget {
  const _EmptyBoard();

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final muted = theme.colors.mutedForeground;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(FIcons.chefHat, size: 64, color: muted.withValues(alpha: 0.4)),
            const SizedBox(height: 12),
            Text(l10n.noOrders, style: theme.typography.xl2.copyWith(fontWeight: FontWeight.w600, color: muted), textAlign: TextAlign.center),
            const SizedBox(height: 12),
            Text(l10n.noOrdersHint, style: theme.typography.base.copyWith(color: muted), textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }
}

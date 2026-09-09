import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:shimmer/shimmer.dart';
import '../../../core/network/api_errors.dart';
import '../../../core/widgets/kds_toast.dart';
import '../../../l10n/app_localizations.dart';
import '../models/kitchen_order.dart';
import '../providers/kitchen_orders_provider.dart';
import '../widgets/order_card.dart';
import '../widgets/order_grid.dart';

/// The kitchen board, as kds_web's Board: one grid of open orders, oldest
/// first, as many across as the screen fits. Everything confirmed lands
/// here the moment it is confirmed (app order, table QR or counter sale
/// alike); Ready takes it off the board and into the history behind the
/// clock icon in the header, from where it can be brought back. Sized for
/// a tablet at arm's length, tapped with a wet finger.
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

  Future<void> _markReady(KitchenOrder order) async {
    final id = order.orderNumber;
    if (_acting.contains(id)) return;
    setState(() => _acting.add(id));
    try {
      await ref.read(kitchenOrdersProvider.notifier).setReady(id, true);
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
    final async = ref.watch(kitchenOrdersProvider);
    final orders = async.value ?? const <KitchenOrder>[];
    final isLoading = async.isLoading && async.value == null;
    final now = DateTime.now();
    final open = openOrders(orders);

    if (!isLoading && open.isEmpty) return const _EmptyBoard();

    return OrderGrid(
      children: [
        if (isLoading)
          for (var i = 0; i < 3; i++) const _CardSkeleton(),
        for (final order in open)
          OrderCard(
            key: ValueKey(order.orderNumber),
            order: order,
            now: now,
            acting: _acting.contains(order.orderNumber),
            onReady: () => _markReady(order),
          ),
      ],
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
        height: 144,
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

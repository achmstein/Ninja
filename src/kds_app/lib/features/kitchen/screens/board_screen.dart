import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:shimmer/shimmer.dart';
import '../../../core/brand/brand_provider.dart';
import '../../../core/motion/motion.dart';
import '../../../core/network/api_errors.dart';
import '../../../core/widgets/kds_toast.dart';
import '../../../l10n/app_localizations.dart';
import '../models/kitchen_order.dart';
import '../providers/kitchen_orders_provider.dart';
import '../providers/station_provider.dart';
import '../widgets/bump_exit.dart';
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
  // The board stays up while the last ticket is still leaving
  bool _hadOrders = false;
  DateTime? _emptySince;

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
    // The kitchen display is a module of the plan: without it there is nothing to show but that
    if (!ref.watch(featuresProvider).kds) return const _NotInPlan();

    final async = ref.watch(kitchenOrdersProvider);
    final orders = async.value ?? const <KitchenOrder>[];
    final isLoading = async.isLoading && async.value == null;
    final now = DateTime.now();
    final open = openOrders(orders);
    final stationId = ref.watch(selectedStationIdProvider);
    final onPass = stationId == null;
    final l10n = AppLocalizations.of(context)!;
    final primary = context.theme.colors.primary;

    if (!isLoading && open.isEmpty) {
      // The last ticket bumped: let it leave before the empty board shows
      final since = _emptySince ??= now;
      if (!_hadOrders || now.difference(since) > bumpDuration) return const _EmptyBoard();
    } else if (!isLoading) {
      _emptySince = null;
      _hadOrders = true;
    }

    // A new ticket slides in from the reading edge with one soft outline
    // that fades; a bumped one draws in to a "Ready #123" chip that rises
    // away, and the board closes up behind it. Another station, or the
    // first load, just draws.
    return ReflowScope(
      child: Presence(
        epoch: (stationId, isLoading),
        exitDuration: bumpDuration,
        enter: (context, key, child) => SlideInItem(distance: 40, highlight: primary.withValues(alpha: 0.55), child: child),
        exit: (context, key, child, exit) => key is ValueKey<int>
            ? BumpExit(exit: exit, label: '${l10n.ready} #${key.value}', child: child)
            : FadeTransition(opacity: ReverseAnimation(exit), child: child),
        builder: (context, children) => OrderGrid(children: children),
        children: [
          if (isLoading)
            for (final (i, items) in const [2, 3, 1, 2].indexed) _CardSkeleton(key: ValueKey('skeleton-$i'), items: items),
          for (final order in open)
            OrderCard(
              key: ValueKey(order.orderNumber),
              order: order,
              now: now,
              acting: _acting.contains(order.orderNumber),
              onReady: () => _markReady(order),
              showParts: onPass,
            ),
        ],
      ),
    );
  }
}

/// The module is off: the board says so instead of asking for orders it may not show
class _NotInPlan extends StatelessWidget {
  const _NotInPlan();

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
            Icon(FIcons.lock, size: 48, color: muted.withValues(alpha: 0.6)),
            const SizedBox(height: 12),
            Text(
              l10n.kdsNotInPlan,
              style: theme.typography.xl.copyWith(fontWeight: FontWeight.w600),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Text(
                l10n.kdsNotInPlanNote,
                style: theme.typography.sm.copyWith(color: muted),
                textAlign: TextAlign.center,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A card-shaped placeholder while the first board loads, the same outline
/// kds_web draws: the header band with the number, the place and the clock,
/// a few item lines and the Ready bar
class _CardSkeleton extends StatelessWidget {
  final int items;

  const _CardSkeleton({super.key, this.items = 2});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    Widget bar({double? width, double height = 16, double radius = 4}) => Container(
      width: width,
      height: height,
      decoration: BoxDecoration(color: theme.colors.muted, borderRadius: BorderRadius.circular(radius)),
    );
    return Container(
      decoration: BoxDecoration(
        color: theme.colors.card,
        border: Border.all(color: theme.colors.border),
        borderRadius: BorderRadius.circular(12),
      ),
      clipBehavior: Clip.antiAlias,
      child: Shimmer.fromColors(
        baseColor: theme.colors.muted,
        highlightColor: theme.colors.background,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              child: Row(
                children: [bar(width: 40), const SizedBox(width: 8), bar(width: 80, height: 24, radius: 6), const Spacer(), bar(width: 48, height: 20)],
              ),
            ),
            Container(height: 1, color: theme.colors.border),
            for (var i = 0; i < items; i++)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                child: Row(
                  children: [
                    bar(width: 28, height: 20),
                    const SizedBox(width: 8),
                    Expanded(child: bar(height: 20)),
                  ],
                ),
              ),
            Padding(padding: const EdgeInsets.fromLTRB(12, 4, 12, 12), child: bar(height: 48, radius: 8)),
          ],
        ),
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
            Text(
              l10n.noOrders,
              style: theme.typography.xl2.copyWith(fontWeight: FontWeight.w600, color: muted),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

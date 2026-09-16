import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:intl/intl.dart';
import '../../../core/models/localized_text.dart';
import '../../../core/providers/branch_provider.dart';
import '../../../core/providers/locale_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_text.dart';
import '../../../l10n/app_localizations.dart';
import '../models/order.dart';
import '../services/order_service.dart';
import '../widgets/rating_dialog.dart';
import '../widgets/rating_widget.dart';

class OrdersScreen extends ConsumerStatefulWidget {
  const OrdersScreen({super.key});

  @override
  ConsumerState<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends ConsumerState<OrdersScreen> with WidgetsBindingObserver {
  final _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _refreshIfPendingOrders();
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _refreshIfPendingOrders();
  }

  void _refreshIfPendingOrders() {
    final s = ref.read(ordersProvider);
    if (s.orders.any((o) => o.status == OrderStatus.submitted)) {
      ref.read(ordersProvider.notifier).refresh();
    }
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
      ref.read(ordersProvider.notifier).loadMore();
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;

    return Column(
      children: [
        FHeader(title: AppText(l10n.orders, style: TextStyle(fontSize: 18))),
        Expanded(
          child: FTabs(
            control: FTabControl.managed(
              initial: ref.read(ordersProvider).showingToday ? 0 : 1,
            ),
            onPress: (index) {
              final current = ref.read(ordersProvider).showingToday;
              if ((index == 0) != current) {
                ref.read(ordersProvider.notifier).toggleView();
              }
            },
            children: [
              FTabEntry(
                label: Text(l10n.todaysOrders),
                child: Expanded(child: _buildTabContent(true)),
              ),
              FTabEntry(
                label: Text(l10n.previousOrders),
                child: Expanded(child: _buildTabContent(false)),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildTabContent(bool isToday) {
    final ordersState = ref.watch(ordersProvider);
    final colors = context.theme.colors;
    final l10n = AppLocalizations.of(context)!;

    if (ordersState.isLoading && ordersState.orders.isEmpty) {
      return Center(child: CircularProgressIndicator(color: colors.primary));
    }

    if (ordersState.error != null && ordersState.orders.isEmpty) {
      return _buildErrorState(colors, l10n);
    }

    if (ordersState.orders.isEmpty) {
      return _buildEmptyState(colors, isToday, l10n);
    }

    if (isToday) return _buildTodayView(ordersState);
    return _buildHistoryView(ordersState);
  }

  Widget _buildErrorState(dynamic colors, AppLocalizations l10n) {
    return RefreshIndicator(
      color: colors.primary,
      backgroundColor: colors.background,
      onRefresh: () => ref.read(ordersProvider.notifier).refresh(),
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          SizedBox(
            height: MediaQuery.of(context).size.height * 0.5,
            child: Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(FIcons.circleAlert, size: 48, color: colors.mutedForeground),
                  const SizedBox(height: 16),
                  AppText(l10n.failedToLoadOrders, style: TextStyle(color: colors.foreground)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState(dynamic colors, bool isToday, AppLocalizations l10n) {
    return RefreshIndicator(
      color: colors.primary,
      backgroundColor: colors.background,
      onRefresh: () => ref.read(ordersProvider.notifier).refresh(),
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          SizedBox(
            height: MediaQuery.of(context).size.height * 0.5,
            child: Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(FIcons.receipt, size: 80, color: colors.mutedForeground),
                  const SizedBox(height: 16),
                  AppText(
                    isToday ? l10n.noOrdersToday : l10n.noOrdersYet,
                    style: TextStyle(fontSize: 18, color: colors.foreground),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── Today ──

  Widget _buildTodayView(OrdersState state) {
    final colors = context.theme.colors;
    final l10n = AppLocalizations.of(context)!;
    final confirmedOrders = state.orders.where((o) => o.status == OrderStatus.confirmed);
    final totalSpent = confirmedOrders.fold<double>(0, (s, o) => s + o.total - o.loyaltyDiscount);

    return RefreshIndicator(
      color: colors.primary,
      backgroundColor: colors.background,
      onRefresh: () => ref.read(ordersProvider.notifier).refresh(),
      child: ListView.separated(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.only(bottom: 16),
        itemCount: state.orders.length + 1,
        separatorBuilder: (_, __) => Divider(height: 1, color: colors.border),
        itemBuilder: (context, index) {
          if (index == 0) {
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              child: Row(
                children: [
                  AppText(l10n.todayOrdersCount(state.orders.length),
                      style: TextStyle(fontSize: 13, color: colors.mutedForeground)),
                  const Spacer(),
                  AppText(l10n.totalSpent(l10n.priceFormat(totalSpent.toStringAsFixed(2))),
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: colors.foreground)),
                ],
              ),
            );
          }
          return _OrderTile(order: state.orders[index - 1]);
        },
      ),
    );
  }

  // ── History: grouped by shift ──

  Widget _buildHistoryView(OrdersState state) {
    final colors = context.theme.colors;
    final locale = ref.watch(localeProvider);
    final l10n = AppLocalizations.of(context)!;
    final groups = _groupByShift(state.orders, locale, l10n);

    return RefreshIndicator(
      color: colors.primary,
      backgroundColor: colors.background,
      onRefresh: () => ref.read(ordersProvider.notifier).refresh(),
      child: CustomScrollView(
        controller: _scrollController,
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          for (final group in groups) ...[
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                child: AppText(group.label,
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: colors.mutedForeground)),
              ),
            ),
            SliverList(
              delegate: SliverChildBuilderDelegate(
                (context, index) => Column(
                  children: [
                    _OrderTile(order: group.orders[index]),
                    if (index < group.orders.length - 1)
                      Divider(height: 1, color: colors.border, indent: 16, endIndent: 16),
                  ],
                ),
                childCount: group.orders.length,
              ),
            ),
          ],
          if (state.hasMore)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 16),
                child: Center(
                  child: SizedBox(width: 24, height: 24,
                      child: CircularProgressIndicator(strokeWidth: 2, color: colors.primary)),
                ),
              ),
            ),
          const SliverPadding(padding: EdgeInsets.only(bottom: 16)),
        ],
      ),
    );
  }

  List<_ShiftGroup> _groupByShift(List<Order> orders, Locale locale, AppLocalizations l10n) {
    final groups = <String, _ShiftGroup>{};
    final now = DateTime.now();
    final dateFormat = DateFormat('EEEE, MMM d', locale.languageCode);
    final branch = ref.read(branchProvider).selectedBranch;
    final startHour = branch?.dayStartHour ?? 17;
    final isOvernight = branch?.isOvernightShift ?? true;

    for (final order in orders) {
      // For overnight shifts, orders before startHour belong to the previous day's shift.
      // For same-day shifts, all orders belong to the same calendar day.
      final localDate = order.date.toLocal();
      final shiftDate = isOvernight && localDate.hour < startHour
          ? DateTime(localDate.year, localDate.month, localDate.day - 1)
          : DateTime(localDate.year, localDate.month, localDate.day);

      final key = '${shiftDate.year}-${shiftDate.month}-${shiftDate.day}';

      if (!groups.containsKey(key)) {
        final todayShift = isOvernight && now.hour < startHour
            ? DateTime(now.year, now.month, now.day - 1)
            : DateTime(now.year, now.month, now.day);
        final yesterdayShift = todayShift.subtract(const Duration(days: 1));

        String label;
        if (_sameDay(shiftDate, todayShift)) {
          label = l10n.today;
        } else if (_sameDay(shiftDate, yesterdayShift)) {
          label = l10n.yesterday;
        } else {
          label = dateFormat.format(shiftDate);
        }
        groups[key] = _ShiftGroup(label: label, orders: []);
      }
      groups[key]!.orders.add(order);
    }
    return groups.values.toList();
  }

  bool _sameDay(DateTime a, DateTime b) =>
      a.year == b.year && a.month == b.month && a.day == b.day;
}

class _ShiftGroup {
  final String label;
  final List<Order> orders;
  _ShiftGroup({required this.label, required this.orders});
}

// ════════════════════════════════════════════════════════════════════
// Shared Order Tile — used in both today and history views
// ════════════════════════════════════════════════════════════════════

class _OrderTile extends ConsumerWidget {
  final Order order;

  const _OrderTile({required this.order});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.theme.colors;
    final locale = ref.watch(localeProvider);
    final timeFormat = DateFormat('h:mm a', locale.languageCode);
    final l10n = AppLocalizations.of(context)!;
    final orderDetailsAsync = ref.watch(orderProvider(order.id));

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header: status dot + time + room + price
          Row(
            children: [
              _StatusDot(status: order.status),
              const SizedBox(width: 8),
              AppText(
                timeFormat.format(order.date.toLocal()),
                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15, color: colors.foreground),
              ),
              if (order.roomName != null || order.tableName != null) ...[
                const SizedBox(width: 6),
                AppText(
                  '• ${(order.roomName ?? order.tableName)!.localized(context)}',
                  style: TextStyle(fontSize: 13, color: colors.mutedForeground),
                ),
              ],
              const Spacer(),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  AppText(
                    l10n.priceFormat((order.total - order.loyaltyDiscount).toStringAsFixed(2)),
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: colors.foreground),
                  ),
                  if (order.loyaltyDiscount > 0)
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.stars, size: 12, color: Colors.green.shade600),
                        const SizedBox(width: 2),
                        AppText(
                          l10n.discountFormat(order.loyaltyDiscount.toStringAsFixed(2)),
                          style: TextStyle(fontSize: 12, color: Colors.green.shade600),
                        ),
                      ],
                    ),
                  _PaidPill(order: order),
                ],
              ),
            ],
          ),

          const SizedBox(height: 8),

          // Items — auto-fetched
          orderDetailsAsync.when(
            loading: () => Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: SizedBox(width: 18, height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2, color: colors.primary)),
            ),
            error: (_, __) => AppText(
              l10n.failedToLoadDetails,
              style: TextStyle(color: colors.destructive, fontSize: 13),
            ),
            data: (details) => _buildDetails(context, ref, details, colors, locale, l10n),
          ),
        ],
      ),
    );
  }

  Widget _buildDetails(
    BuildContext context, WidgetRef ref, Order details,
    dynamic colors, Locale locale, AppLocalizations l10n,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ...details.items.map((item) => Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.baseline,
                    textBaseline: TextBaseline.alphabetic,
                    children: [
                      AppText('${item.units}',
                          style: TextStyle(fontSize: 14, color: colors.mutedForeground)),
                      AppText('x ',
                          style: TextStyle(fontSize: 14, color: colors.mutedForeground)),
                      Expanded(
                        child: AppText(item.productName.getText(locale),
                            style: TextStyle(fontSize: 14, color: colors.foreground)),
                      ),
                    ],
                  ),
                  if (item.customizationsDescription != null)
                    Padding(
                      padding: const EdgeInsetsDirectional.only(start: 24),
                      child: AppText(item.customizationsDescription!.getText(locale),
                          style: TextStyle(fontSize: 12, color: colors.mutedForeground)),
                    ),
                ],
              ),
            )),
        if (details.customerNote != null) ...[
          const SizedBox(height: 4),
          AppText(l10n.noteWithText(details.customerNote!),
              style: TextStyle(fontSize: 13, color: colors.mutedForeground)),
        ],
        if (details.hasRating) ...[
          const SizedBox(height: 8),
          Row(children: [
            AppText(l10n.yourRating, style: TextStyle(fontSize: 13, color: colors.mutedForeground)),
            RatingDisplay(rating: details.rating!, color: colors.mutedForeground),
          ]),
          if (details.rating!.comment != null && details.rating!.comment!.isNotEmpty) ...[
            const SizedBox(height: 4),
            AppText(
              '"${details.rating!.comment}"',
              style: TextStyle(fontSize: 13, color: colors.mutedForeground),
            ),
          ],
        ] else if (details.canBeRated) ...[
          const SizedBox(height: 6),
          GestureDetector(
            onTap: () => showRatingDialog(context: context, ref: ref, orderId: details.id),
            child: Row(
              children: [
                Icon(Icons.star_border, size: 16, color: colors.mutedForeground),
                const SizedBox(width: 4),
                AppText(l10n.rateThisOrder,
                    style: TextStyle(fontSize: 13, color: colors.mutedForeground)),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

// ════════════════════════════════════════════════════════════════════
// Status Dot
// ════════════════════════════════════════════════════════════════════

class _StatusDot extends StatelessWidget {
  final OrderStatus status;

  const _StatusDot({required this.status});

  @override
  Widget build(BuildContext context) {
    final color = switch (status) {
      OrderStatus.awaitingValidation => Colors.orange,
      OrderStatus.submitted => Colors.orange,
      OrderStatus.confirmed => AppTheme.successColor,
      OrderStatus.cancelled => context.theme.colors.destructive,
    };

    return Container(
      width: 10,
      height: 10,
      decoration: BoxDecoration(color: color, shape: BoxShape.circle),
    );
  }
}

/// What the till did with the bill this order was on, projected by Ordering
/// from Sales' receipt: paid (and on which receipt), on the customer's tab,
/// refunded, voided — or still unpaid once staff confirmed it. A submitted
/// or cancelled order carries no pill.
class _PaidPill extends StatelessWidget {
  final Order order;

  const _PaidPill({required this.order});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    if (order.paidAt == null) {
      if (order.voidedAt != null) {
        return Padding(
          padding: const EdgeInsets.only(top: 4),
          child: FBadge(variant: FBadgeVariant.outline, child: Text(l10n.voided)),
        );
      }
      if (order.status != OrderStatus.confirmed) return const SizedBox.shrink();
      return Padding(
        padding: const EdgeInsets.only(top: 4),
        child: FBadge(variant: FBadgeVariant.outline, child: Text(l10n.unpaid)),
      );
    }
    final receipt = order.receiptNumber != null ? ' ${l10n.receiptShort(order.receiptNumber!)}' : '';
    final label = order.paidWith == 'Account' ? l10n.onYourTab : l10n.paid;
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Wrap(
        spacing: 4,
        alignment: WrapAlignment.end,
        children: [
          FBadge(variant: FBadgeVariant.secondary, child: Text('$label$receipt')),
          if (order.refundedAmount > 0)
            FBadge(
              variant: FBadgeVariant.outline,
              child: Text('${l10n.refunded} −${l10n.priceFormat(order.refundedAmount.toStringAsFixed(2))}'),
            ),
        ],
      ),
    );
  }
}

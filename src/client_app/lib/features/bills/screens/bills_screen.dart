import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../core/brand/brand_provider.dart';
import '../../../core/providers/branch_provider.dart';
import '../../../core/providers/locale_provider.dart';
import '../../../core/utils/business_day.dart';
import '../../../core/widgets/app_text.dart';
import '../../../l10n/app_localizations.dart';
import '../../orders/models/order.dart';
import '../../orders/services/order_service.dart';
import '../../profile/providers/account_provider.dart';
import '../models/bill.dart';
import '../services/bills_service.dart';
import '../widgets/bill_tile.dart';
import '../widgets/order_tile.dart';

/// The bills tab: the customer's bills, not their orders. Everything the
/// cafe charges — the rounds, a place's time, a discount, service and VAT
/// — lands on a Sales ticket, and the till's own arithmetic is what the
/// customer sees. One tile per bill they are on today, open ones first;
/// an order the till has not confirmed yet waits above, since it is on no
/// bill until then.
class BillsScreen extends ConsumerStatefulWidget {
  const BillsScreen({super.key});

  @override
  ConsumerState<BillsScreen> createState() => _BillsScreenState();
}

class _BillsScreenState extends ConsumerState<BillsScreen> {
  @override
  void initState() {
    super.initState();
    // The tab's balance, for the row above the bills
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (ref.read(accountProvider).account == null) {
        ref.read(accountProvider.notifier).loadAccount();
      } else {
        ref.read(accountProvider.notifier).refresh();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;

    return Column(
      children: [
        FHeader(title: AppText(l10n.bills, style: const TextStyle(fontSize: 18))),
        Expanded(
          child: FTabs(
            control: FTabControl.managed(initial: 0),
            children: [
              FTabEntry(label: Text(l10n.today), child: const Expanded(child: _TodayTab())),
              FTabEntry(label: Text(l10n.earlier), child: const Expanded(child: _EarlierTab())),
            ],
          ),
        ),
      ],
    );
  }
}

Future<void> _refreshAll(WidgetRef ref) => Future.wait([
      ref.read(myBillsProvider.notifier).refresh(),
      ref.read(ordersProvider.notifier).refresh(),
      ref.read(accountProvider.notifier).refresh(),
    ]);

class _TodayTab extends ConsumerWidget {
  const _TodayTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final colors = context.theme.colors;
    final bills = ref.watch(myBillsProvider);
    final orders = ref.watch(ordersProvider);
    final dayStart = businessDayStart(ref.watch(branchProvider).selectedBranch);

    if (bills.isLoading || (orders.isLoading && orders.orders.isEmpty)) {
      return Center(child: CircularProgressIndicator(color: colors.primary));
    }
    if (bills.hasError && orders.error != null) {
      return _Message(
        icon: FIcons.circleAlert,
        text: l10n.failedToLoadBills,
        action: l10n.retry,
        onAction: () => ref.read(myBillsProvider.notifier).reload(),
        onRefresh: () => _refreshAll(ref),
      );
    }

    // Open bills whatever their age (last night's unpaid table is still
    // today's), and bills closed since the business day started
    final todayBills = (bills.value ?? const <Bill>[]).where((bill) {
      final closed = bill.closedAt;
      return closed == null || !closed.isBefore(dayStart);
    }).toList();
    final waiting = orders.orders
        .where((o) => o.status != OrderStatus.confirmed && o.status != OrderStatus.cancelled)
        .toList();
    final cancelled = orders.orders.where((o) => o.status == OrderStatus.cancelled).toList();
    final ordersById = {for (final order in orders.orders) order.id: order};

    if (todayBills.isEmpty && waiting.isEmpty && cancelled.isEmpty) {
      return _Message(icon: FIcons.receipt, text: l10n.nothingOnYouToday, onRefresh: () => _refreshAll(ref));
    }

    return RefreshIndicator(
      color: colors.primary,
      backgroundColor: colors.background,
      onRefresh: () => _refreshAll(ref),
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.only(bottom: 16),
        children: [
          const _OnYourTab(),
          _OrderGroup(title: l10n.waitingToBeConfirmed, orders: waiting),
          _OrderGroup(title: l10n.statusCancelled, orders: cancelled),
          for (var i = 0; i < todayBills.length; i++) ...[
            BillTile(bill: todayBills[i], ordersById: ordersById),
            if (i < todayBills.length - 1) Divider(height: 1, color: colors.border, indent: 16, endIndent: 16),
          ],
        ],
      ),
    );
  }
}

class _EarlierTab extends ConsumerWidget {
  const _EarlierTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final colors = context.theme.colors;
    final locale = ref.watch(localeProvider);
    final bills = ref.watch(myBillsProvider);
    final branch = ref.watch(branchProvider).selectedBranch;
    final dayStart = businessDayStart(branch);

    if (bills.isLoading) {
      return Center(child: CircularProgressIndicator(color: colors.primary));
    }
    if (bills.hasError) {
      return _Message(
        icon: FIcons.circleAlert,
        text: l10n.failedToLoadBills,
        action: l10n.retry,
        onAction: () => ref.read(myBillsProvider.notifier).reload(),
        onRefresh: () => ref.read(myBillsProvider.notifier).refresh(),
      );
    }

    final past = (bills.value ?? const <Bill>[]).where((bill) {
      final closed = bill.closedAt;
      return closed != null && closed.isBefore(dayStart);
    }).toList();
    if (past.isEmpty) {
      return _Message(
          icon: FIcons.receipt, text: l10n.noBillsYet, onRefresh: () => ref.read(myBillsProvider.notifier).refresh());
    }

    // One heading per shift day: Today, Yesterday, then the date
    final todayShift = shiftDayOf(DateTime.now(), branch);
    final yesterdayShift = DateTime(todayShift.year, todayShift.month, todayShift.day - 1);
    final dateFormat = DateFormat('EEEE, MMM d', locale.languageCode);
    final groups = <DateTime, List<Bill>>{};
    for (final bill in past) {
      groups.putIfAbsent(shiftDayOf(bill.closedAt!, branch), () => []).add(bill);
    }
    String labelOf(DateTime day) => day == todayShift
        ? l10n.today
        : day == yesterdayShift
            ? l10n.yesterday
            : dateFormat.format(day);

    return RefreshIndicator(
      color: colors.primary,
      backgroundColor: colors.background,
      onRefresh: () => ref.read(myBillsProvider.notifier).refresh(),
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.only(bottom: 16),
        children: [
          for (final entry in groups.entries) ...[
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
              child: AppText(labelOf(entry.key),
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: colors.mutedForeground)),
            ),
            for (var i = 0; i < entry.value.length; i++) ...[
              BillTile(bill: entry.value[i]),
              if (i < entry.value.length - 1) Divider(height: 1, color: colors.border, indent: 16, endIndent: 16),
            ],
          ],
        ],
      ),
    );
  }
}

/// What the customer owes the cafe, as the till decided it: the balance of
/// their tab in Accounts, where a settled share lands when the cashier puts
/// it on account. No sum of the open bills — the app cannot know their
/// part of an unsettled place's time, so it does not guess one. Only for
/// an account that owes; a tap opens the tab.
class _OnYourTab extends ConsumerWidget {
  const _OnYourTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final colors = context.theme.colors;
    if (!ref.watch(featuresProvider).tabs) return const SizedBox.shrink();
    final balance = ref.watch(accountProvider).account?.balance ?? 0;
    if (balance <= 0) return const SizedBox.shrink();

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => context.push('/transactions'),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Expanded(child: AppText(l10n.onYourTab, style: TextStyle(fontSize: 13, color: colors.mutedForeground))),
            AppText(
              l10n.priceFormat(balance.toStringAsFixed(2)),
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: colors.destructive,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Orders not on a bill: sent and waiting, or turned down
class _OrderGroup extends StatelessWidget {
  final String title;
  final List<Order> orders;

  const _OrderGroup({required this.title, required this.orders});

  @override
  Widget build(BuildContext context) {
    if (orders.isEmpty) return const SizedBox.shrink();
    final colors = context.theme.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
          child: AppText(title, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: colors.mutedForeground)),
        ),
        for (final order in orders) ...[
          OrderTile(order: order),
          Divider(height: 1, color: colors.border, indent: 16, endIndent: 16),
        ],
      ],
    );
  }
}

/// One line and an icon, pull-to-refresh under it; a retry when there is
/// something to retry
class _Message extends StatelessWidget {
  final IconData icon;
  final String text;
  final String? action;
  final VoidCallback? onAction;
  final Future<void> Function() onRefresh;

  const _Message({required this.icon, required this.text, this.action, this.onAction, required this.onRefresh});

  @override
  Widget build(BuildContext context) {
    final colors = context.theme.colors;
    return RefreshIndicator(
      color: colors.primary,
      backgroundColor: colors.background,
      onRefresh: onRefresh,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          SizedBox(
            height: MediaQuery.of(context).size.height * 0.5,
            child: Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(icon, size: 64, color: colors.mutedForeground),
                  const SizedBox(height: 16),
                  AppText(text, style: TextStyle(fontSize: 18, color: colors.foreground)),
                  if (action != null) ...[
                    const SizedBox(height: 12),
                    FButton(variant: FButtonVariant.outline, onPress: onAction, child: Text(action!)),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

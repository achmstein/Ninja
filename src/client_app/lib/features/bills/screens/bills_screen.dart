import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart' show DateFormat;
import '../../../core/brand/brand_provider.dart';
import '../../../core/brand/brand_style.dart';
import '../../../core/models/branch.dart';
import '../../../core/providers/branch_provider.dart';
import '../../../core/providers/locale_provider.dart';
import '../../../core/theme/theme_provider.dart';
import '../../../core/ui/ui.dart';
import '../../../core/utils/business_day.dart';
import '../../../core/utils/money.dart';
import '../../../core/widgets/app_text.dart';
import '../../../l10n/app_localizations.dart';
import '../../orders/models/order.dart';
import '../../orders/services/order_service.dart';
import '../../profile/providers/account_provider.dart';
import '../models/bill.dart';
import '../services/bills_service.dart';
import '../widgets/bill_tile.dart';
import '../widgets/order_tile.dart';

/// Your bills (client_web's routes/bills.tsx), reached from You: the bill
/// running now lives on the dock, and this is where all of them are kept.
/// What the business charges (the rounds, a place's time, a discount,
/// service and VAT) lands on a Sales ticket, and the till's own arithmetic
/// is what the customer sees. The bills open now come first; then the
/// orders still waiting or turned down, what is on the tab, and the
/// history, month by month.
class BillsScreen extends ConsumerStatefulWidget {
  const BillsScreen({super.key});

  @override
  ConsumerState<BillsScreen> createState() => _BillsScreenState();
}

class _BillsScreenState extends ConsumerState<BillsScreen> {
  @override
  void initState() {
    super.initState();
    // The tab's balance, for the row above the history
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (ref.read(accountProvider).account == null) {
        ref.read(accountProvider.notifier).loadAccount();
      } else {
        ref.read(accountProvider.notifier).refresh();
      }
    });
  }

  Future<void> _refresh() => Future.wait([
        ref.read(myBillsProvider.notifier).refresh(),
        ref.read(ordersProvider.notifier).refresh(),
        ref.read(accountProvider.notifier).refresh(),
      ]);

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final c = context.theme.colors;
    final bills = ref.watch(myBillsProvider);
    final orders = ref.watch(ordersProvider);
    final all = bills.value ?? const <Bill>[];
    final open = all.where((b) => b.isOpen).toList();
    final closed = all.where((b) => !b.isOpen).toList();
    final waiting = orders.orders.where((o) => o.status != OrderStatus.confirmed && o.status != OrderStatus.cancelled).toList();
    final turnedDown = orders.orders.where((o) => o.status == OrderStatus.cancelled).toList();
    final ordersById = {for (final order in orders.orders) order.id: order};

    final List<Widget> children;
    if (bills.isLoading && all.isEmpty) {
      children = [
        for (var i = 0; i < 2; i++) Container(height: 168, decoration: BoxDecoration(color: c.muted, borderRadius: BorderRadius.circular(Ninja.cardRadius))),
      ];
    } else if (bills.hasError && all.isEmpty) {
      children = [
        EmptyState(
          icon: LucideIcons.circleAlert,
          title: l10n.failedToLoadBills,
          action: NinjaButton(
            variant: NinjaButtonVariant.outline,
            mainAxisSize: MainAxisSize.min,
            onPress: () => ref.read(myBillsProvider.notifier).reload(),
            child: AppText(l10n.retry),
          ),
        ),
      ];
    } else if (all.isEmpty && waiting.isEmpty && turnedDown.isEmpty) {
      children = [EmptyState(icon: LucideIcons.receiptText, title: l10n.noBillsYet)];
    } else {
      children = [
        for (final bill in open) BillTile(bill: bill, ordersById: ordersById),
        if (waiting.isNotEmpty) _OrderGroup(title: l10n.waitingToBeConfirmed, orders: waiting),
        if (turnedDown.isNotEmpty) _OrderGroup(title: l10n.statusCancelled, orders: turnedDown),
        const _OnYourTab(),
        if (closed.isNotEmpty) _ByMonth(bills: closed, ordersById: ordersById),
      ];
    }

    return NinjaPage(title: l10n.ninjaYourBills, back: true, onRefresh: _refresh, children: children);
  }
}

/// What the customer owes the business, as the till decided it: the balance
/// of their tab. No sum of the open bills: the app cannot know their part of
/// an unsettled place's time, so it does not guess one. Only for an account
/// that owes; a tap opens the tab.
class _OnYourTab extends ConsumerWidget {
  const _OnYourTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!ref.watch(featuresProvider).tabs) return const SizedBox.shrink();
    final balance = ref.watch(accountProvider).account?.balance ?? 0;
    if (balance <= 0) return const SizedBox.shrink();
    final l10n = AppLocalizations.of(context)!;
    final theme = context.theme;
    return TileGroup(
      children: [
        NinjaTile(
          icon: LucideIcons.wallet,
          title: AppText(l10n.onYourTab),
          value: Text(
            ref.watch(moneyProvider)(balance),
            style: theme.typography.body.copyWith(fontWeight: FontWeight.w700, color: theme.colors.destructive, fontFeatures: NinjaTypography.tabular),
          ),
          onPress: () => context.push('/transactions'),
        ),
      ],
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
    final c = context.theme.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SectionLabel(title),
        Panel(
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              for (final (i, order) in orders.indexed) ...[
                if (i > 0) Divider(height: 1, thickness: 1, color: c.border.withValues(alpha: 0.6)),
                OrderTile(order: order),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

/// The history, month by month: each month a heading with how many visits it
/// held and what was paid in it, then its bills by day under it (a day by
/// the branch's shift: an overnight shift's small hours are the day before)
class _ByMonth extends ConsumerWidget {
  final List<Bill> bills;
  final Map<int, Order> ordersById;

  const _ByMonth({required this.bills, required this.ordersById});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final theme = context.theme;
    final c = theme.colors;
    final money = ref.watch(moneyProvider);
    final language = ref.watch(localeProvider).languageCode;
    final branch = ref.watch(branchProvider).selectedBranch;
    final today = shiftDayOf(DateTime.now(), branch);
    final yesterday = DateTime(today.year, today.month, today.day - 1);
    final dayFormat = DateFormat('EEEE, MMM d', language);
    final monthFormat = DateFormat('MMMM y', language);
    String dayLabel(DateTime day) => day == today
        ? l10n.today
        : day == yesterday
            ? l10n.yesterday
            : dayFormat.format(day);

    // Months, then days, in the order the bills come (newest first)
    final months = <({String label, List<Bill> bills})>[];
    for (final bill in bills) {
      final closed = bill.closedAt!.toLocal();
      final label = monthFormat.format(closed);
      if (months.isNotEmpty && months.last.label == label) {
        months.last.bills.add(bill);
      } else {
        months.add((label: label, bills: [bill]));
      }
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final (m, month) in months.indexed) ...[
          if (m > 0) const SizedBox(height: 32),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      BrandHeading(month.label, style: theme.typography.title.copyWith(color: c.foreground, height: 1.15)),
                      Text(l10n.ninjaMonthVisits(month.bills.length), style: context.localeText(theme.typography.caption.copyWith(color: c.mutedForeground))),
                    ],
                  ),
                ),
                Text(
                  money(month.bills.where((b) => b.isSettled).fold(0.0, (sum, b) => sum + b.total)),
                  style: context.localeText(theme.typography.headline.copyWith(fontWeight: FontWeight.w800, color: c.foreground, fontFeatures: NinjaTypography.tabular)),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          ..._days(month.bills, branch, dayLabel),
        ],
      ],
    );
  }

  List<Widget> _days(List<Bill> bills, Branch? branch, String Function(DateTime) label) {
    final days = <({DateTime day, List<Bill> bills})>[];
    for (final bill in bills) {
      final day = shiftDayOf(bill.closedAt!, branch);
      if (days.isNotEmpty && days.last.day == day) {
        days.last.bills.add(bill);
      } else {
        days.add((day: day, bills: [bill]));
      }
    }
    return [
      for (final (d, day) in days.indexed) ...[
        if (d > 0) const SizedBox(height: 20),
        SectionLabel(label(day.day)),
        for (final (i, bill) in day.bills.indexed) ...[
          if (i > 0) const SizedBox(height: 12),
          BillTile(bill: bill, ordersById: ordersById),
        ],
      ],
    ];
  }
}

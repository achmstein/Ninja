import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/brand/brand_provider.dart';
import '../../../core/models/money.dart';
import '../../../core/network/api_errors.dart';
import 'package:ninja_app_core/theme/app_theme.dart';
import 'package:ninja_app_core/theme/text_styles.dart';
import 'package:ninja_app_core/widgets/heading.dart';
import '../../../l10n/app_localizations.dart';
import '../models/delivery_order.dart';
import '../providers/deliveries_provider.dart';
import '../widgets/delivery_card.dart';

/// The rider's day on one screen: what is still theirs to do, oldest first,
/// each with its one next step; then what is done today, and the cash in
/// their pocket until the till takes it. Every state scrolls, so a pull
/// refreshes it whatever it shows.
class DeliveriesScreen extends ConsumerWidget {
  const DeliveriesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    // Delivery is an add-on: a business that has not bought it (or switched
    // it off) has nothing for a rider, and its deliveries are not asked for
    if (!ref.watch(featuresProvider.select((f) => f.delivery))) {
      return _Scrollable(children: [_Message(icon: FIcons.bike, title: l10n.notDelivering, body: l10n.notDeliveringHint)]);
    }
    final day = ref.watch(deliveriesProvider);
    final onDuty = ref.watch(dutyProvider.select((d) => d.onDuty));
    final staleSince = ref.watch(deliveriesStaleSinceProvider);
    final focused = ref.watch(focusedDeliveryProvider);
    final currency = ref.watch(brandProvider.select((b) => b.currency));
    final locale = Localizations.localeOf(context);
    String money(double amount) => formatMoney(amount, currency, locale);
    Future<void> refresh() => ref.read(deliveriesProvider.notifier).refresh();

    return RefreshIndicator(
      onRefresh: refresh,
      child: day.when(
        loading: () => const _Scrollable(children: [SizedBox(height: 120), Center(child: FCircularProgress())]),
        error: (e, _) => _Scrollable(children: [
          _Message(
            icon: FIcons.wifiOff,
            title: describeError(e, l10n),
            action: FButton(
              variant: FButtonVariant.outline,
              onPress: refresh,
              child: Text(l10n.retry, style: theme.typography.base.forButton),
            ),
          ),
        ]),
        data: (day) {
          final cash = day.cashInHand;
          return _Scrollable(
            children: [
              if (staleSince != null) _StaleNote(since: staleSince),
              if (!onDuty) _Note(icon: FIcons.moon, text: l10n.offDutyNote),
              if (cash > 0) _CashInHand(amount: money(cash)),
              if (day.isEmpty)
                _Message(icon: FIcons.bike, title: l10n.noDeliveries, body: l10n.noDeliveriesHint)
              else ...[
                if (day.toGo.isNotEmpty) ...[
                  Heading(l10n.toGo),
                  const SizedBox(height: 8),
                  for (final order in day.toGo)
                    Padding(
                      key: ValueKey('to-go-${order.orderNumber}'),
                      padding: const EdgeInsets.only(bottom: 12),
                      child: _Focusable(
                        focused: focused == order.orderNumber,
                        child: DeliveryCard(order: order, money: money),
                      ),
                    ),
                ],
                if (day.delivered.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Heading(l10n.deliveredToday),
                  const SizedBox(height: 8),
                  for (final order in day.delivered) _DoneRow(key: ValueKey('done-${order.orderNumber}'), order: order, money: money),
                ],
              ],
            ],
          );
        },
      ),
    );
  }
}

/// A list that always scrolls, so the pull-to-refresh above it works on every state
class _Scrollable extends StatelessWidget {
  final List<Widget> children;

  const _Scrollable({required this.children});

  @override
  Widget build(BuildContext context) => ListView(
        padding: const EdgeInsets.fromLTRB(12, 12, 12, 32),
        physics: const AlwaysScrollableScrollPhysics(),
        children: children,
      );
}

/// The delivery a tapped push pointed at: scrolled into view once, then let go
class _Focusable extends ConsumerStatefulWidget {
  final bool focused;
  final Widget child;

  const _Focusable({required this.focused, required this.child});

  @override
  ConsumerState<_Focusable> createState() => _FocusableState();
}

class _FocusableState extends ConsumerState<_Focusable> {
  @override
  void initState() {
    super.initState();
    _reveal();
  }

  @override
  void didUpdateWidget(_Focusable old) {
    super.didUpdateWidget(old);
    if (widget.focused && !old.focused) _reveal();
  }

  void _reveal() {
    if (!widget.focused) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      Scrollable.ensureVisible(context, duration: const Duration(milliseconds: 300), alignment: 0.1);
      ref.read(focusedDeliveryProvider.notifier).focus(null);
    });
  }

  @override
  Widget build(BuildContext context) => widget.child;
}

class _Note extends StatelessWidget {
  final IconData icon;
  final String text;

  const _Note({required this.icon, required this.text});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: theme.colors.muted, borderRadius: BorderRadius.circular(12)),
        child: Row(
          children: [
            Icon(icon, size: 18, color: theme.colors.mutedForeground),
            const SizedBox(width: 8),
            Expanded(child: Text(text, style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground))),
          ],
        ),
      ),
    );
  }
}

/// The list could not be refreshed: what shows is what was last fetched, and since when
class _StaleNote extends StatelessWidget {
  final DateTime since;

  const _StaleNote({required this.since});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final time = MaterialLocalizations.of(context).formatTimeOfDay(TimeOfDay.fromDateTime(since));
    return _Note(icon: FIcons.wifiOff, text: l10n.listMayBeOld(time));
  }
}

/// The cash collected at doors and not yet taken in by the till
class _CashInHand extends StatelessWidget {
  final String amount;

  const _CashInHand({required this.amount});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final green = AppColors.emerald(theme.colors.brightness);
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: green.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: green.withValues(alpha: 0.4)),
        ),
        child: Row(
          children: [
            Icon(FIcons.banknote, size: 24, color: green),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(l10n.cashInHand(amount), style: theme.typography.lg.copyWith(fontWeight: FontWeight.w700)),
                  Text(l10n.cashInHandHint, style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A delivery done: whom, when, how much, and whether its cash is still out
/// (or that the bag went back to the branch)
class _DoneRow extends StatelessWidget {
  final DeliveryOrder order;
  final String Function(double) money;

  const _DoneRow({super.key, required this.order, required this.money});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final at = order.deliveredAt ?? order.outAt;
    final time = at == null ? '' : MaterialLocalizations.of(context).formatTimeOfDay(TimeOfDay.fromDateTime(at.toLocal()));
    final muted = theme.colors.mutedForeground;
    final returned = order.stage == DeliveryStage.returned;
    final status = returned ? l10n.returnedToBranch : order.cashInHand ? l10n.cashWithYou : l10n.handedIn;
    return Container(
      constraints: const BoxConstraints(minHeight: 56),
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 4),
      decoration: BoxDecoration(border: Border(bottom: BorderSide(color: theme.colors.border))),
      child: Row(
        children: [
          Icon(returned ? FIcons.undo2 : FIcons.circleCheck, size: 20, color: returned ? muted : AppColors.emerald(theme.colors.brightness)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('${order.customerName ?? l10n.guest} · ${l10n.orderNumber(order.orderNumber)}',
                    style: theme.typography.base.copyWith(fontWeight: FontWeight.w600), maxLines: 1, overflow: TextOverflow.ellipsis),
                Text(time.isEmpty ? status : '$time · $status', style: theme.typography.sm.copyWith(color: muted)),
              ],
            ),
          ),
          if (!returned) Text(money(order.total), style: theme.typography.base.copyWith(fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

class _Message extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? body;
  final Widget? action;

  const _Message({required this.icon, required this.title, this.body, this.action});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final muted = theme.colors.mutedForeground;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 64, horizontal: 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 48, color: muted),
          const SizedBox(height: 16),
          Text(title, style: theme.typography.lg.copyWith(fontWeight: FontWeight.w600), textAlign: TextAlign.center),
          if (body != null) ...[
            const SizedBox(height: 6),
            Text(body!, style: theme.typography.sm.copyWith(color: muted), textAlign: TextAlign.center),
          ],
          if (action != null) ...[const SizedBox(height: 16), action!],
        ],
      ),
    );
  }
}

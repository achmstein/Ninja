import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import 'package:ninja_app_core/brand/brand_provider.dart';
import 'package:ninja_app_core/theme/app_theme.dart';
import 'package:ninja_app_core/theme/text_styles.dart';
import '../../../core/models/money.dart';
import '../../../core/network/api_errors.dart';
import '../../../l10n/app_localizations.dart';
import '../models/delivery_order.dart';
import '../providers/deliveries_provider.dart';
import '../widgets/delivery_card.dart';
import '../widgets/duty_card.dart';
import '../widgets/parts.dart';

/// The rider's shift at a glance: their duty switch first, the day in two
/// figures (the cash with them, how many delivered; a tap opens the day),
/// then what is still theirs to do, oldest first, each with its one next
/// step. Every state scrolls, so a pull refreshes it whatever it shows.
class DeliveriesScreen extends ConsumerWidget {
  const DeliveriesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    // Delivery is an add-on: a business that has not bought it (or switched
    // it off) has nothing for a rider, and its deliveries are not asked for
    if (!ref.watch(featuresProvider.select((f) => f.delivery))) {
      return RiderList(children: [EmptyState(icon: FIcons.motorbike, title: l10n.notDelivering, body: l10n.notDeliveringHint)]);
    }
    final day = ref.watch(deliveriesProvider);
    final staleSince = ref.watch(deliveriesStaleSinceProvider);
    final focused = ref.watch(focusedDeliveryProvider);
    final currency = ref.watch(brandProvider.select((b) => b.currency));
    final locale = Localizations.localeOf(context);
    String money(double amount) => formatMoney(amount, currency, locale);
    Future<void> refresh() => ref.read(deliveriesProvider.notifier).refresh();

    return RefreshIndicator(
      onRefresh: refresh,
      child: day.when(
        loading: () => const RiderList(children: [DutyCard(), SizedBox(height: 120), Center(child: FCircularProgress())]),
        error: (e, _) => RiderList(children: [
          const DutyCard(),
          EmptyState(
            icon: FIcons.wifiOff,
            title: describeError(e, l10n),
            action: SizedBox(
              height: 48,
              child: FButton(
                variant: FButtonVariant.outline,
                mainAxisSize: MainAxisSize.min,
                onPress: refresh,
                prefix: const Icon(FIcons.refreshCw, size: 18),
                child: Text(l10n.retry, style: theme.typography.base.forButton),
              ),
            ),
          ),
        ]),
        data: (day) => RiderList(
          children: [
            if (staleSince != null) _StaleNote(since: staleSince),
            const DutyCard(),
            const SizedBox(height: 12),
            _DayGlance(day: day, money: money),
            const SizedBox(height: 12),
            if (day.toGo.isEmpty)
              EmptyState(icon: FIcons.packageOpen, title: l10n.noDeliveries, body: l10n.noDeliveriesHint)
            else ...[
              SectionTitle(l10n.toGo, count: day.toGo.length),
              for (final order in day.toGo)
                Padding(
                  key: ValueKey('to-go-${order.orderNumber}'),
                  padding: const EdgeInsets.only(bottom: 14),
                  child: _Focusable(
                    focused: focused == order.orderNumber,
                    child: DeliveryCard(order: order, money: money),
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }
}

/// The day in two figures, each a tap from the day's list: the cash still
/// with the rider (amber while there is some to hand in), and how many delivered
class _DayGlance extends StatelessWidget {
  final RiderDay day;
  final String Function(double) money;

  const _DayGlance({required this.day, required this.money});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final theme = context.theme;
    final cash = day.cashInHand;
    final delivered = day.delivered.where((o) => o.isDelivered).length;
    return Row(
      children: [
        Expanded(
          child: StatTile(
            icon: FIcons.wallet,
            label: l10n.cashWithYou,
            value: money(cash),
            accent: cash > 0 ? AppColors.amber(theme.colors.brightness) : null,
            onPress: () => context.go('/today'),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: StatTile(
            icon: FIcons.circleCheck,
            label: l10n.deliveredToday,
            value: '$delivered',
            onPress: () => context.go('/today'),
          ),
        ),
      ],
    );
  }
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

/// The list could not be refreshed: what shows is what was last fetched, and since when
class _StaleNote extends StatelessWidget {
  final DateTime since;

  const _StaleNote({required this.since});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final time = MaterialLocalizations.of(context).formatTimeOfDay(TimeOfDay.fromDateTime(since));
    return NoteBanner(icon: FIcons.wifiOff, text: l10n.listMayBeOld(time));
  }
}

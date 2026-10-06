import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/brand/brand_provider.dart';
import '../../../core/theme/theme_provider.dart';
import '../../../core/ui/ui.dart';
import '../../../core/utils/money.dart';
import '../../../core/widgets/app_text.dart';
import '../../../l10n/app_localizations.dart';
import '../../delivery/services/delivery_service.dart';
import '../pay_ahead.dart';

/// In the open order, where the business takes payment ahead and the order
/// goes to a door or the counter (client_web's pay-choice.tsx): pay online
/// now, or in cash to the rider or at the counter. Online, one quiet line says
/// what matters and nothing else: the fee the customer carries, where there is
/// one, and that a card is only charged once the branch accepts the order,
/// where it is held. Set in the slab's inks, as the pickup and delivery choice
/// over it.
class PayChoiceView extends ConsumerWidget {
  /// What the order comes to, the delivery fee in: the fee is worked out on it
  final double total;

  const PayChoiceView({super.key, required this.total});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = context.theme;
    final c = theme.colors;
    final l10n = AppLocalizations.of(context)!;
    final payAhead = ref.watch(payAheadProvider);
    if (!payAhead.offered) return const SizedBox.shrink();
    final money = ref.watch(moneyProvider);
    final delivering = ref.watch(deliveryStateProvider.select((d) => d.active));
    final business = ref.watch(brandNameProvider);
    final ink = c.foreground;
    final soft = ink.withValues(alpha: 0.08);
    final note = context.localeText(theme.typography.caption.copyWith(color: ink.withValues(alpha: 0.75)));
    final fee = payAhead.feeFor(total);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(
          label: l10n.payAheadLabel,
          child: Container(
            height: 48,
            padding: const EdgeInsets.all(4),
            decoration: ShapeDecoration(color: soft, shape: const StadiumBorder()),
            child: Row(
              children: [
                for (final method in PayMethod.values)
                  Expanded(
                    child: Semantics(
                      selected: payAhead.online == (method == PayMethod.online),
                      button: true,
                      child: Pressable(
                        onTap: () => ref.read(payChoiceProvider.notifier).set(method),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 220),
                          curve: Curves.easeOutCubic,
                          alignment: Alignment.center,
                          decoration: ShapeDecoration(
                            color: payAhead.online == (method == PayMethod.online) ? c.background : Colors.transparent,
                            shape: const StadiumBorder(),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                method == PayMethod.online ? LucideIcons.creditCard : LucideIcons.banknote,
                                size: 16,
                                color: payAhead.online == (method == PayMethod.online) ? c.foreground : ink.withValues(alpha: 0.7),
                              ),
                              const SizedBox(width: 8),
                              Flexible(
                                child: AppText(
                                  method == PayMethod.online
                                      ? l10n.payAheadOnline
                                      : delivering
                                          ? l10n.payAheadCashDelivery
                                          : l10n.payAheadCashPickup,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: context.localeText(theme.typography.note.copyWith(
                                    fontWeight: FontWeight.w600,
                                    color: payAhead.online == (method == PayMethod.online) ? c.foreground : ink.withValues(alpha: 0.7),
                                  )),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
        if (payAhead.online && (fee > 0 || payAhead.options.holdsCards)) ...[
          const SizedBox(height: 8),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (fee > 0)
                  Row(
                    children: [
                      Expanded(child: AppText(l10n.payAheadFee, style: note)),
                      AppText(money(fee), style: note.copyWith(fontWeight: FontWeight.w600, fontFeatures: NinjaTypography.tabular)),
                    ],
                  ),
                if (payAhead.options.holdsCards) AppText(l10n.payAheadHeld(business), style: note.copyWith(color: ink.withValues(alpha: 0.65))),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

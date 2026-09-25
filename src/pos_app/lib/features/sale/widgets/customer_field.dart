import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import '../../../core/brand/brand_provider.dart';
import '../../../core/network/network_status.dart';
import '../../../core/theme/text_styles.dart';
import '../../../l10n/app_localizations.dart';
import '../../customers/dialogs/customer_card_dialog.dart';
import '../../customers/providers/customer_providers.dart';
import '../models/sale_line.dart';

/// "Choose customer (optional)": the way into the customer picker wherever
/// a sale or a bill can be for someone — the sale pad and the new-bill
/// dialog open the same picker from the same button.
class ChooseCustomerButton extends StatelessWidget {
  final VoidCallback onPress;
  const ChooseCustomerButton({super.key, required this.onPress});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    return SizedBox(
      height: 48,
      child: FButton(
        variant: FButtonVariant.outline,
        onPress: onPress,
        prefix: const Icon(FIcons.userPlus, size: 20),
        child: Text.rich(
          TextSpan(
            text: l10n.chooseCustomer,
            style: theme.typography.base.forButton,
            children: [
              TextSpan(
                text: ' (${l10n.optional})',
                style: theme.typography.base.forButton.copyWith(color: theme.colors.mutedForeground),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The picked customer, shown the same way on the sale pad and in the
/// new-bill dialog: an account taps open its card (points and tab at a
/// glance) with the points under the name; a bare name is just the name.
/// The cross takes them off.
class SelectedCustomerChip extends StatelessWidget {
  final SaleCustomer customer;
  final VoidCallback onRemove;
  const SelectedCustomerChip({super.key, required this.customer, required this.onRemove});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final name = Text(customer.name,
        maxLines: 1, overflow: TextOverflow.ellipsis, style: theme.typography.base.copyWith(fontWeight: FontWeight.w500));
    return Container(
      padding: const EdgeInsetsDirectional.fromSTEB(12, 4, 4, 4),
      decoration: BoxDecoration(
        color: theme.colors.secondary.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          const Icon(FIcons.user, size: 16),
          const SizedBox(width: 8),
          Expanded(
            child: (customer.id ?? '').isNotEmpty
                // An account: tap for the card — points and tab at a glance
                ? FTappable(
                    onPress: () => showCustomerCard(context,
                        id: customer.id!, name: customer.name, phone: customer.phone, addedAtCounter: customer.addedAtCounter),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [name, _CustomerPointsLine(userId: customer.id!)],
                    ),
                  )
                : name,
          ),
          SizedBox.square(
            dimension: 40,
            child: FButton.icon(
              variant: FButtonVariant.ghost,
              onPress: onRemove,
              child: const Icon(FIcons.x, size: 16),
            ),
          ),
        ],
      ),
    );
  }
}

/// The attached customer's points under their name — information only:
/// points are earned and spent in the customer app, the till never touches
/// them. Quiet while offline or until the read lands.
class _CustomerPointsLine extends ConsumerWidget {
  final String userId;
  const _CustomerPointsLine({required this.userId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!ref.watch(featuresProvider).loyalty) return const SizedBox.shrink();
    if (!ref.watch(onlineProvider)) return const SizedBox.shrink();
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final loyalty = ref.watch(loyaltyAccountProvider(userId));
    final text = loyalty.when(
      loading: () => null,
      error: (_, _) => null,
      data: (account) => account == null ? l10n.notEnrolled : l10n.pointsBalance(account.pointsBalance),
    );
    if (text == null) return const SizedBox.shrink();
    return Text(text,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: theme.typography.xs.copyWith(color: theme.colors.mutedForeground, fontFeatures: const [FontFeature.tabularFigures()]));
  }
}

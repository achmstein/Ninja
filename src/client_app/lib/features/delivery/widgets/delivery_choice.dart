import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/brand/brand_provider.dart';
import '../../../core/models/localized_text.dart';
import '../../../core/providers/branch_provider.dart';
import '../../../core/providers/branch_switch.dart';
import '../../../core/services/location_service.dart';
import '../../../core/theme/theme_provider.dart';
import '../../../core/ui/ui.dart';
import '../../../core/utils/money.dart';
import '../../../core/widgets/app_text.dart';
import '../../../l10n/app_localizations.dart';
import '../models/delivery_address.dart';
import '../services/delivery_service.dart';
import 'address_sheet.dart';

/// In the open order, where the branch delivers and the customer is not at a
/// table: collect it or have it brought (client_web's delivery-choice.tsx).
/// Brought, the address is a tap away, and under it what the branch says
/// about it: the fee, how much more the dishes must come to, or that it does
/// not go that far, with the nearest branch that does a tap away too.
class DeliveryChoiceView extends ConsumerWidget {
  const DeliveryChoiceView({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = context.theme;
    final c = theme.colors;
    final l10n = AppLocalizations.of(context)!;
    final money = ref.watch(moneyProvider);
    final delivery = ref.watch(deliveryStateProvider);
    if (!delivery.offered) return const SizedBox.shrink();
    final cloudKitchen = ref.watch(brandProvider).isCloudKitchen;
    final ink = c.foreground;
    final soft = ink.withValues(alpha: 0.08);
    final note = context.localeText(theme.typography.caption.copyWith(color: ink.withValues(alpha: 0.75)));
    final warn = note.copyWith(color: NinjaColors.warning, fontWeight: FontWeight.w600);
    final address = delivery.address;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Collect it or have it brought: two halves of one pill, the chosen one lit
        Semantics(
          label: l10n.deliveryModeLabel,
          child: Container(
            height: 48,
            padding: const EdgeInsets.all(4),
            decoration: ShapeDecoration(color: soft, shape: const StadiumBorder()),
            child: Row(
              children: [
                for (final deliver in const [false, true])
                  Expanded(
                    child: Semantics(
                      selected: delivery.active == deliver,
                      button: true,
                      child: Pressable(
                        onTap: () => ref.read(deliveryChoiceProvider.notifier).setWanted(deliver),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 220),
                          curve: Curves.easeOutCubic,
                          alignment: Alignment.center,
                          decoration: ShapeDecoration(color: delivery.active == deliver ? c.background : Colors.transparent, shape: const StadiumBorder()),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                deliver ? LucideIcons.bike : (cloudKitchen ? LucideIcons.shoppingBag : LucideIcons.store),
                                size: 16,
                                color: delivery.active == deliver ? c.foreground : ink.withValues(alpha: 0.7),
                              ),
                              const SizedBox(width: 8),
                              AppText(
                                deliver ? l10n.deliveryDeliver : l10n.deliveryPickup,
                                style: context.localeText(theme.typography.note.copyWith(
                                  fontWeight: FontWeight.w600,
                                  color: delivery.active == deliver ? c.foreground : ink.withValues(alpha: 0.7),
                                )),
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
        if (delivery.active) ...[
          const SizedBox(height: 8),
          // Where it goes: a tap picks another or adds one
          Pressable(
            onTap: () => showAddressSheet(context),
            child: Container(
              constraints: const BoxConstraints(minHeight: 56),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(color: soft, borderRadius: BorderRadius.circular(16)),
              child: Row(
                children: [
                  Icon(LucideIcons.mapPin, size: 20, color: ink),
                  const SizedBox(width: 12),
                  Expanded(
                    child: address == null
                        ? AppText(l10n.deliveryAddAddress, style: context.localeText(theme.typography.note.copyWith(fontWeight: FontWeight.w600, color: ink)))
                        : Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              AppText(
                                shownLabel(address.label, home: l10n.deliveryLabelHome, work: l10n.deliveryLabelWork) ?? address.address,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: context.localeText(theme.typography.note.copyWith(fontWeight: FontWeight.w600, color: ink)),
                              ),
                              AppText(addressLineOf(context, address), maxLines: 1, overflow: TextOverflow.ellipsis, style: note),
                            ],
                          ),
                  ),
                  Icon(LucideIcons.chevronRight, size: 16, color: ink.withValues(alpha: 0.6)),
                ],
              ),
            ),
          ),
          const SizedBox(height: 6),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (delivery.problem == DeliveryProblem.checking)
                  Row(
                    children: [
                      SizedBox.square(dimension: 12, child: CircularProgressIndicator(strokeWidth: 1.5, color: ink.withValues(alpha: 0.7))),
                      const SizedBox(width: 8),
                      AppText(l10n.deliveryChecking, style: note),
                    ],
                  ),
                if (delivery.problem == DeliveryProblem.quoteFailed)
                  Row(
                    children: [
                      Flexible(child: AppText(l10n.deliveryQuoteFailed, style: warn)),
                      const SizedBox(width: 12),
                      Pressable(
                        onTap: () => ref.invalidate(deliveryQuoteProvider),
                        child: SizedBox(
                          height: 40,
                          child: Center(
                            child: AppText(l10n.deliveryRetry, style: warn.copyWith(decoration: TextDecoration.underline, color: ink)),
                          ),
                        ),
                      ),
                    ],
                  ),
                if (delivery.problem == DeliveryProblem.range) _OutOfRange(address: address!),
                if (delivery.quoted && delivery.inRange)
                  Row(
                    children: [
                      Expanded(child: AppText(l10n.deliveryFee, style: note)),
                      AppText(
                        delivery.fee > 0 ? money(delivery.fee) : l10n.deliveryFree,
                        style: note.copyWith(fontWeight: FontWeight.w600, fontFeatures: NinjaTypography.tabular),
                      ),
                    ],
                  ),
                if (delivery.problem == DeliveryProblem.minimum) AppText(l10n.deliveryAddMore(money(delivery.short)), style: warn),
                if (delivery.ready) AppText(l10n.deliveryCashAtDoor, style: note),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

/// This branch does not go that far: the nearest branch that does, if any, a tap away
class _OutOfRange extends ConsumerWidget {
  final DeliveryAddress address;

  const _OutOfRange({required this.address});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final state = ref.watch(branchProvider);
    final branch = state.selectedBranch;
    final warn = context.localeText(theme.typography.caption.copyWith(color: NinjaColors.warning, fontWeight: FontWeight.w600));
    final here = (lat: address.latitude, lng: address.longitude);
    final candidates = [
      for (final b in state.branches)
        if (b.isDeliveryEnabled && b.id != branch?.id && b.point != null)
          (branch: b, meters: distanceMeters(here, b.point!)),
    ].where((c) => c.meters <= (c.branch.deliveryRadiusKm ?? 0) * 1000).toList()
      ..sort((a, b) => a.meters.compareTo(b.meters));
    final nearest = candidates.firstOrNull;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AppText(l10n.deliveryOutOfRange(branch?.name.localized(context) ?? ''), style: warn),
        if (nearest != null)
          Pressable(
            onTap: () => requestBranchSwitch(context, ref, nearest.branch.id),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: AppText(
                l10n.deliveryTryBranch(nearest.branch.name.localized(context), distanceText(context, nearest.meters)),
                style: warn.copyWith(color: theme.colors.foreground, decoration: TextDecoration.underline),
              ),
            ),
          ),
      ],
    );
  }
}

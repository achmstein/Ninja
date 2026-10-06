import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../features/delivery/services/delivery_service.dart';
import '../../l10n/app_localizations.dart';
import '../models/localized_text.dart';
import '../providers/branch_provider.dart';
import '../providers/branch_switch.dart';
import '../services/location_service.dart';
import '../theme/theme_provider.dart';
import '../ui/ui.dart';
import 'app_text.dart';

/// When the customer last said "Not now" (ms since the epoch): not asked again for a fortnight
const _snoozeKey = 'ninja-location-primer';
const _snooze = Duration(days: 14);

/// Asked once a run, whatever the answer
bool _askedThisRun = false;

/// Whether the primer is worth showing: a business with branches in more than one place, a customer not
/// at one of them (a bill, a hold, a clock, a table), no position yet, a phone that would still ask, and
/// no "Not now" in the last fortnight. Pure but for the clock, so it is tested apart from the phone.
bool nearestBranchPrimerWanted({
  required int placedBranches,
  required bool atBranch,
  required bool located,
  required LocationPermission? permission,
  required DateTime? snoozedAt,
  required DateTime now,
}) =>
    placedBranches > 1 &&
    !atBranch &&
    !located &&
    permission == LocationPermission.denied &&
    (snoozedAt == null || now.difference(snoozedAt) >= _snooze);

/// Before the phone asks for the position, the app says why (client_web's NearestBranchPrimer): the
/// phone's own prompt can be answered once, and a no stays until the customer finds it in Settings, so
/// it is shown only after "Use my location" here. Once the position comes, the app moves to the nearest
/// open branch, the order with it, and says where it is ordering from.
Future<void> maybeAskNearestBranch(BuildContext context, WidgetRef ref) async {
  if (_askedThisRun) return;
  final branches = ref.read(branchProvider).branches;
  final prefs = await SharedPreferences.getInstance();
  final snoozedMs = prefs.getInt(_snoozeKey);
  final permission = await ref.read(locationProvider.notifier).permission();
  if (!context.mounted) return;
  final wanted = nearestBranchPrimerWanted(
    placedBranches: branches.where((b) => b.isActive && b.point != null).length,
    atBranch: ref.read(atBranchProvider),
    located: ref.read(locationProvider).here != null,
    permission: permission,
    snoozedAt: snoozedMs == null ? null : DateTime.fromMillisecondsSinceEpoch(snoozedMs),
    now: DateTime.now(),
  );
  if (!wanted) return;
  _askedThisRun = true;

  final l10n = AppLocalizations.of(context)!;
  final theme = context.theme;
  final share = await showNinjaSheet<bool>(
    context: context,
    builder: (sheetContext) => NinjaDialog(
      // The sheet's own colours (it is drawn on the slab), not the page's
      title: Column(
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(color: sheetContext.theme.colors.foreground.withValues(alpha: 0.1), shape: BoxShape.circle),
            child: Icon(LucideIcons.mapPinned, size: 28, color: sheetContext.theme.colors.foreground),
          ),
          const SizedBox(height: 12),
          AppText(l10n.nearestBranchTitle, textAlign: TextAlign.center),
        ],
      ),
      body: AppText(
        l10n.nearestBranchBody,
        textAlign: TextAlign.center,
        style: sheetContext.localeText(sheetContext.theme.typography.note.copyWith(color: sheetContext.theme.colors.mutedForeground)),
      ),
      actions: [
        NinjaButton(
          variant: NinjaButtonVariant.secondary,
          onPress: () => Navigator.pop(sheetContext, false),
          child: AppText(l10n.notNow),
        ),
        NinjaButton(
          onPress: () => Navigator.pop(sheetContext, true),
          child: AppText(l10n.useMyLocation),
        ),
      ],
    ),
  );

  if (share != true) {
    await prefs.setInt(_snoozeKey, DateTime.now().millisecondsSinceEpoch);
    return;
  }
  final allowed = await ref.read(locationProvider.notifier).locate();
  if (!context.mounted) return;
  final here = ref.read(locationProvider).here;
  if (!allowed || here == null) {
    showIsland(title: Text(l10n.nearestBranchBlocked), icon: Icon(LucideIcons.mapPinOff, color: theme.colors.mutedForeground));
    return;
  }
  // Brought to an address: the address picks the branch, not where the customer stands
  final delivery = ref.read(deliveryStateProvider);
  if (delivery.active && delivery.address != null) return;
  final open = ref.read(branchProvider).branches.where((b) => b.isActive && b.isOrderingEnabled).toList();
  final nearest = byDistance(open, here, (b) => b.point).firstOrNull;
  if (nearest == null || nearest.meters == null) return;
  if (nearest.item.id != ref.read(branchProvider).selectedBranchId) {
    await requestBranchSwitch(context, ref, nearest.item.id);
  }
  if (!context.mounted) return;
  showIsland(
    title: Text(l10n.nearestBranchMoved(nearest.item.name.localized(context), distanceText(context, nearest.meters!))),
    icon: Icon(LucideIcons.mapPin, color: theme.colors.primary),
  );
}

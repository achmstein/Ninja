import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../features/bills/services/bills_service.dart';
import '../../features/cart/services/cart_service.dart';
import '../../features/places/models/place.dart';
import '../../features/places/services/place_service.dart';
import '../../l10n/app_localizations.dart';
import '../models/branch.dart';
import '../models/localized_text.dart';
import '../services/location_service.dart';
import '../ui/ui.dart';
import '../widgets/app_text.dart';
import 'branch_provider.dart';
import 'current_place_provider.dart';

/// What a customer can tell of a branch right now: open, open but not taking orders, or closed
enum BranchOpenState { open, notOrdering, closed }

BranchOpenState branchOpenState(Branch branch) => !branch.isActive
    ? BranchOpenState.closed
    : branch.isOrderingEnabled
        ? BranchOpenState.open
        : BranchOpenState.notOrdering;

/// The branches in the order a customer meets them without a position: the
/// one they used last (the selected one) first, then the owner's order
List<Branch> lastUsedFirst(List<Branch> branches, int? selectedId) => [...branches]
  ..sort((a, b) {
    final aOn = a.id == selectedId;
    final bOn = b.id == selectedId;
    if (aOn != bOn) return aOn ? -1 : 1;
    return a.displayOrder.compareTo(b.displayOrder);
  });

/// The branches with how far each is, closest first once the customer's
/// position is known, else the one used last and then the owner's order
List<({Branch item, double? meters})> branchesByDistance(List<Branch> branches, int? selectedId, LatLng? here) =>
    byDistance(lastUsedFirst(branches, selectedId), here, (b) => b.point);

/// Whether the customer is at the branch: an open bill, a held place, a
/// running clock or a scanned table. The branch is not changed then: what
/// they have there is that branch's
final atBranchProvider = Provider<bool>((ref) {
  final openBill = ref.watch(myBillsProvider).value?.any((b) => b.isOpen) ?? false;
  final hold = openReservationOf(ref.watch(myReservationsProvider).value ?? const []) != null;
  final stay = ref.watch(myStaysProvider).value?.any((s) => s.status == StayStatus.active) ?? false;
  final scanned = ref.watch(activePlaceProvider) != null;
  return openBill || hold || stay || scanned;
});

/// Moves the app to another branch: the branch is set, the scanned place and
/// the order go (the other branch's menu is not this one's), and everything
/// branch-scoped is fetched again. With dishes in the order it asks first.
/// [then] runs once the switch is made (at once, or after the yes), never on
/// a no.
Future<void> requestBranchSwitch(BuildContext context, WidgetRef ref, int branchId, {VoidCallback? then}) async {
  final branches = ref.read(branchProvider);
  if (branchId == branches.selectedBranchId) {
    then?.call();
    return;
  }
  if (ref.read(cartItemCountProvider) > 0) {
    final l10n = AppLocalizations.of(context)!;
    final name = branches.branches.where((b) => b.id == branchId).firstOrNull?.name.localized(context) ?? '';
    final yes = await showNinjaSheet<bool>(
      context: context,
      builder: (sheetContext) => NinjaDialog(
        title: AppText(l10n.ninjaSwitchBranchWithOrder(name)),
        actions: [
          NinjaButton(
            variant: NinjaButtonVariant.secondary,
            onPress: () => Navigator.pop(sheetContext, false),
            child: AppText(l10n.ninjaKeepOrder),
          ),
          NinjaButton(
            onPress: () => Navigator.pop(sheetContext, true),
            child: AppText(l10n.ninjaSwitchBranch),
          ),
        ],
      ),
    );
    if (yes != true) return;
  }
  await ref.read(currentPlaceProvider.notifier).clear();
  // Clears the order too; every branch-scoped provider watches the selected branch
  await ref.read(branchProvider.notifier).selectBranch(branchId);
  then?.call();
}

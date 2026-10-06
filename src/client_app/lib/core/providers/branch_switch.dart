import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../features/bills/services/bills_service.dart';
import '../../features/cart/services/order_move.dart';
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

/// Moves the app to another branch (the branch sheet, booking there, a
/// delivery from there): the branch is set, the scanned place goes and the
/// order comes along, at that branch's prices (BranchNotifier.selectBranch).
/// Nothing asks: the customer loses nothing they could still have. [then]
/// runs once the switch is made.
Future<void> requestBranchSwitch(BuildContext context, WidgetRef ref, int branchId, {VoidCallback? then}) async {
  if (branchId != ref.read(branchProvider).selectedBranchId) {
    await ref.read(currentPlaceProvider.notifier).clear();
    // Every branch-scoped provider watches the selected branch; the order is repriced in the background
    unawaited(ref.read(branchProvider.notifier).selectBranch(branchId));
  }
  then?.call();
}

/// What the customer is told of an order that moved: only what changed in it
void sayOrderMoved(BuildContext context, List<Branch> branches, OrderMoveNotice notice) {
  final l10n = AppLocalizations.of(context)!;
  final name = branches.where((b) => b.id == notice.branchId).firstOrNull?.name.localized(context) ?? '';
  final move = notice.move;
  if (move.dropped.isNotEmpty) {
    final dishes = move.dropped.map((l) => l.productName.localized(context)).join(' · ');
    showIsland(
      title: AppText(l10n.orderMovedDropped(name, dishes)),
      icon: const Icon(LucideIcons.circleAlert),
      duration: const Duration(seconds: 5),
    );
  } else if (move.repriced.isNotEmpty) {
    showIsland(title: AppText(l10n.orderMovedRepriced(name)), icon: const Icon(LucideIcons.tag));
  }
}

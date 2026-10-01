import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../ui/ui.dart';
import '../../features/bills/widgets/open_bills.dart';
import '../../features/service_request/widgets/request_tiles.dart';
import '../models/localized_text.dart';
import '../providers/current_place_provider.dart';
import 'app_text.dart';
import '../../features/service_request/models/service_request.dart';
import '../../l10n/app_localizations.dart';
import '../brand/brand_provider.dart';
import '../providers/branch_provider.dart';
import '../../features/pay/services/pay_service.dart';
import '../../features/pay/widgets/pay_sheet.dart';

/// Standing reminder of where the order is going, mirroring the web client's
/// top-bar chip.
///
/// Scanning a table drops the customer straight on the menu, so without this
/// the only confirmation is a toast that disappears. A table can be dismissed
/// here if they moved or scanned the wrong sticker; a running clock cannot -
/// you leave it by the counter ending it, not by dismissing a chip.
class DestinationChip extends ConsumerWidget {
  const DestinationChip({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final destination = ref.watch(orderDestinationProvider);
    if (destination == null) return const SizedBox.shrink();

    final theme = context.theme;
    final isRoom = destination.isStay;

    return Padding(
      padding: const EdgeInsetsDirectional.only(end: 12, top: 8),
      child: GestureDetector(
        // The table chip is the table's menu: a waiter or the bill
        onTap: isRoom ? null : () => showPlaceRequests(context, destination),
        behavior: HitTestBehavior.opaque,
        child: Container(
        padding: EdgeInsetsDirectional.only(
          start: 8,
          end: isRoom ? 8 : 4,
          top: 3,
          bottom: 3,
        ),
        decoration: BoxDecoration(
          color: theme.colors.muted,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              destination.placeKind.icon,
              size: 13,
              color: theme.colors.mutedForeground,
            ),
            const SizedBox(width: 4),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 110),
              child: AppText(
                destination.name.localized(context),
                overflow: TextOverflow.ellipsis,
                style: theme.typography.caption.copyWith(
                  color: theme.colors.mutedForeground,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            if (!isRoom)
              GestureDetector(
                onTap: () => ref.read(currentPlaceProvider.notifier).clear(),
                behavior: HitTestBehavior.opaque,
                child: Padding(
                  padding: const EdgeInsets.all(4),
                  child: Icon(
                    LucideIcons.x,
                    size: 12,
                    color: theme.colors.mutedForeground,
                  ),
                ),
              ),
          ],
        ),
      ),
      ),
    );
  }
}

/// Waiter or the bill, from a table: the room's tiles, for the customer who
/// scanned a table sticker, each saying where its request stands
Future<void> showPlaceRequests(BuildContext context, OrderDestination destination) {
  return showNinjaSheet<void>(
    context: context,
    builder: (context) => NinjaDialog(
      title: Text(destination.name.localized(context)),
      // The table first (the waiter, the bill, the way to pay), then its bills
      body: Consumer(
        builder: (context, ref, _) => Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _TableRequests(destination: destination),
            if (OpenBills.any(ref)) ...[const SizedBox(height: 20), const OpenBills()],
          ],
        ),
      ),
      actions: const [],
    ),
  );
}

class _TableRequests extends ConsumerStatefulWidget {
  final OrderDestination destination;

  const _TableRequests({required this.destination});

  @override
  ConsumerState<_TableRequests> createState() => _TableRequestsState();
}

class _TableRequestsState extends ConsumerState<_TableRequests> with PlaceRequests {
  @override
  RequestTarget get requestTarget =>
      (placeId: widget.destination.placeId, placeKind: widget.destination.placeKind, placeName: widget.destination.name, sessionId: null);

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final branchId = ref.watch(selectedBranchIdProvider);
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: RequestGrid(actions: [
        requestAction(ServiceRequestType.callWaiter, LucideIcons.bellRing, l10n.callWaiter),
        requestAction(ServiceRequestType.receiptToPay, LucideIcons.receipt, l10n.getBill),
        // Online payments: the table's open bill, paid or split from the phone
        if (ref.watch(featuresProvider).onlinePayments && branchId != null)
          RequestAction(
            icon: LucideIcons.creditCard,
            label: l10n.payTheBill,
            onTap: () {
              final navigator = Navigator.of(context);
              final sheetContext = navigator.context;
              navigator.pop();
              showPaySheet(sheetContext, PaySource.place(widget.destination.placeId, branchId));
            },
          ),
      ]),
    );
  }
}

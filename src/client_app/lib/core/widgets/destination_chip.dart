import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import '../models/localized_text.dart';
import '../providers/current_place_provider.dart';
import 'app_text.dart';
import '../../features/service_request/models/service_request.dart';
import '../../features/service_request/services/service_request_service.dart';
import '../../l10n/app_localizations.dart';
import '../theme/app_theme.dart';
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
                style: theme.typography.xs.copyWith(
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
                    FIcons.x,
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

/// Waiter or the bill, from a table — the room's quick actions, for the
/// customer who scanned a table sticker. One minute between taps of a kind.
Future<void> showPlaceRequests(BuildContext context, OrderDestination destination) {
  return showFDialog<void>(
    context: context,
    builder: (context, style, animation) => FDialog(
      style: style,
      animation: animation,
      title: Text(destination.name.localized(context)),
      body: _TableRequestButtons(destination: destination),
      actions: const [],
    ),
  );
}

final Map<ServiceRequestType, DateTime> _tableCooldowns = {};

class _TableRequestButtons extends ConsumerStatefulWidget {
  final OrderDestination destination;

  const _TableRequestButtons({required this.destination});

  @override
  ConsumerState<_TableRequestButtons> createState() => _TableRequestButtonsState();
}

class _TableRequestButtonsState extends ConsumerState<_TableRequestButtons> {
  bool _busy = false;

  Future<void> _send(ServiceRequestType type, String success) async {
    final l10n = AppLocalizations.of(context)!;
    final until = _tableCooldowns[type];
    if (until != null && until.isAfter(DateTime.now())) {
      showFToast(context: context, title: Text(l10n.pleaseWaitBeforeRequest));
      return;
    }
    setState(() => _busy = true);
    final ok = await ref.read(serviceRequestProvider.notifier).submitRequest(
          CreateServiceRequest(
            placeId: widget.destination.placeId,
            placeKind: widget.destination.placeKind,
            placeName: widget.destination.name,
            requestType: type,
          ),
        );
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok) {
      _tableCooldowns[type] = DateTime.now().add(const Duration(minutes: 1));
      Navigator.of(context).pop();
      showFToast(context: context, title: Text(success), icon: Icon(FIcons.check, color: AppTheme.successColor));
    } else {
      showFToast(context: context, title: Text(l10n.failedToSendRequest));
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final branchId = ref.watch(selectedBranchIdProvider);
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 8),
        FButton(
          variant: FButtonVariant.outline,
          onPress: _busy ? null : () => _send(ServiceRequestType.callWaiter, l10n.waiterNotified),
          prefix: const Icon(FIcons.bell),
          child: Text(l10n.callWaiter),
        ),
        const SizedBox(height: 8),
        FButton(
          variant: FButtonVariant.outline,
          onPress: _busy ? null : () => _send(ServiceRequestType.receiptToPay, l10n.billRequestSent),
          prefix: const Icon(FIcons.receipt),
          child: Text(l10n.getBill),
        ),
        // Online payments: the table's open bill, paid or split from the phone
        if (ref.watch(featuresProvider).onlinePayments && branchId != null) ...[
          const SizedBox(height: 8),
          FButton(
            onPress: _busy
                ? null
                : () {
                    final navigator = Navigator.of(context);
                    final sheetContext = navigator.context;
                    navigator.pop();
                    showPaySheet(sheetContext, PaySource.place(widget.destination.placeId, branchId));
                  },
            prefix: const Icon(FIcons.creditCard),
            child: Text(l10n.payTheBill),
          ),
        ],
      ],
    );
  }
}

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import '../../../core/models/localized_text.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/text_styles.dart';
import '../../../core/widgets/pos_toast.dart';
import '../../../l10n/app_localizations.dart';
import '../../orders/status.dart';
import '../models/service_request.dart';
import '../providers/service_requests_provider.dart';

/// Live room requests waiting on staff — call a waiter, change a
/// controller, bring the bill, switch player mode. A strip on the floor,
/// like the pending orders one, gone when nothing is waiting. Acknowledge
/// marks a request seen; Done clears it. The hub's ServiceRequestCreated
/// nudge and a chime bring new ones in.
class ServiceRequestsStrip extends ConsumerStatefulWidget {
  const ServiceRequestsStrip({super.key});

  @override
  ConsumerState<ServiceRequestsStrip> createState() => _ServiceRequestsStripState();
}

class _ServiceRequestsStripState extends ConsumerState<ServiceRequestsStrip> {
  Timer? _clock;
  bool _acting = false;

  @override
  void dispose() {
    _clock?.cancel();
    super.dispose();
  }

  // The ages tick while anything is waiting
  void _syncClock(bool running) {
    if (running && _clock == null) {
      _clock = Timer.periodic(const Duration(seconds: 1), (_) => setState(() {}));
    } else if (!running && _clock != null) {
      _clock!.cancel();
      _clock = null;
    }
  }

  Future<void> _run(Future<bool> Function() action) async {
    setState(() => _acting = true);
    final ok = await action();
    if (!mounted) return;
    setState(() => _acting = false);
    if (!ok) showPosToast(context, PosToastType.error, AppLocalizations.of(context)!.failedToUpdateRequest);
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final requests = ref.watch(serviceRequestsProvider).requests;
    _syncClock(requests.isNotEmpty);
    if (requests.isEmpty) return const SizedBox.shrink();
    final now = DateTime.now();
    final amber = AppColors.amber(theme.colors.brightness);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Icon(FIcons.bell, size: 20, color: amber),
            const SizedBox(width: 8),
            Text(l10n.serviceRequests, style: theme.typography.lg.copyWith(fontWeight: FontWeight.w600)),
            const SizedBox(width: 8),
            FBadge(child: Text('${requests.length}', style: const TextStyle(fontFeatures: [FontFeature.tabularFigures()]))),
          ],
        ),
        const SizedBox(height: 8),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.only(bottom: 4),
          child: Row(
            children: [
              for (final (index, request) in requests.indexed) ...[
                if (index > 0) const SizedBox(width: 12),
                _RequestCard(
                  request: request,
                  now: now,
                  acting: _acting,
                  onAcknowledge: () => _run(() => ref.read(serviceRequestsProvider.notifier).acknowledgeRequest(request.id)),
                  onDone: () => _run(() => ref.read(serviceRequestsProvider.notifier).completeRequest(request.id)),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 16),
      ],
    );
  }
}

class _RequestCard extends StatelessWidget {
  final ServiceRequest request;
  final DateTime now;
  final bool acting;
  final VoidCallback onAcknowledge;
  final VoidCallback onDone;

  const _RequestCard({
    required this.request,
    required this.now,
    required this.acting,
    required this.onAcknowledge,
    required this.onDone,
  });

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final amber = AppColors.amber(theme.colors.brightness);
    final acked = request.status == ServiceRequestStatus.acknowledged;
    // A table asks for a waiter or the bill the same way a room does
    final atTable = request.tableId != null;
    final placeName = (request.tableName ?? request.roomName).localized(context);
    final room = placeName.isNotEmpty
        ? placeName
        : atTable
            ? '${l10n.table} ${request.tableId}'
            : '${l10n.room} ${request.roomId}';
    final (icon, label) = switch (request.requestType) {
      ServiceRequestType.callWaiter => (FIcons.bell, l10n.requestCallWaiter),
      ServiceRequestType.controllerChange => (FIcons.gamepad2, l10n.requestControllerChange),
      ServiceRequestType.receiptToPay => (FIcons.receipt, l10n.requestReceiptToPay),
      ServiceRequestType.switchToMulti => (FIcons.users, l10n.requestSwitchToMulti),
      ServiceRequestType.switchToSingle => (FIcons.user, l10n.requestSwitchToSingle),
    };

    return Container(
      width: 300,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: theme.colors.background,
        border: Border.all(color: theme.colors.border),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // The room is the headline — it is where staff has to go
          Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(color: AppColors.amber500.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(10)),
                child: Icon(icon, size: 20, color: amber),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(atTable ? FIcons.armchair : FIcons.doorOpen, size: 16, color: theme.colors.mutedForeground),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text(room,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: theme.typography.base.copyWith(fontWeight: FontWeight.w600)),
                        ),
                      ],
                    ),
                    Text('$label · ${relativeTime(context, l10n, request.createdAt, now)}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              // "Acknowledge" is the long word; it gets the wider half
              if (!acked) ...[
                Expanded(
                  flex: 3,
                  child: SizedBox(
                    height: 44,
                    child: FButton(
                      variant: FButtonVariant.outline,
                      onPress: acting ? null : onAcknowledge,
                      prefix: const Icon(FIcons.check, size: 20),
                      child: Text(
                        l10n.acknowledgeRequest,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: theme.typography.sm.forButton,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
              ],
              Expanded(
                flex: 2,
                child: SizedBox(
                  height: 44,
                  child: FButton(
                    onPress: acting ? null : onDone,
                    child: Text(l10n.done, maxLines: 1, overflow: TextOverflow.ellipsis, style: theme.typography.sm.forButton),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

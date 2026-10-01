import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/localized_text.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme_provider.dart';
import '../../../core/ui/ui.dart';
import '../../../l10n/app_localizations.dart';
import '../../places/models/place.dart';
import '../models/service_request.dart';
import '../services/service_request_service.dart';

/// The place a request is sent from: the customer's running stay, or a table they scanned
typedef RequestTarget = ({int placeId, PlaceKind placeKind, LocalizedText placeName, int? sessionId});

/// Where a request stands, as its tile shows it
enum RequestPhase { idle, sending, sent, onTheWay }

class RequestAction {
  final IconData icon;
  final String label;
  final RequestPhase phase;

  /// Who is on the way, once someone picked it up
  final String? by;

  /// Another request is on its way out
  final bool busy;
  final VoidCallback onTap;

  const RequestAction({
    required this.icon,
    required this.label,
    this.phase = RequestPhase.idle,
    this.by,
    this.busy = false,
    required this.onTap,
  });
}

/// What the customer can ask for from a place (client_web's service-requests.ts),
/// shared by the room and the table: where each kind stands, read from the
/// customer's requests as the staff have them, and what one tap does, send
/// it, or take it back while it is only sent. The open request is the cooldown.
mixin PlaceRequests<T extends ConsumerStatefulWidget> on ConsumerState<T> {
  /// The request on its way out, while the tap is answered
  ServiceRequestType? sendingRequest;

  RequestTarget get requestTarget;

  /// A tile for one kind of request, with where it stands
  RequestAction requestAction(ServiceRequestType type, IconData icon, String label) {
    final state = requestState(type);
    return RequestAction(icon: icon, label: label, phase: state.phase, by: state.by, busy: sendingRequest != null, onTap: () => tapRequest(type));
  }

  /// Where one kind of request from this place stands, as its tile shows it
  ({RequestPhase phase, int? id, String? by}) requestState(ServiceRequestType type) {
    if (sendingRequest == type) return (phase: RequestPhase.sending, id: null, by: null);
    final open = ref
        .watch(myRequestsProvider)
        .where((r) => r.requestType == type && r.placeId == requestTarget.placeId && r.isOpen)
        .firstOrNull;
    if (open == null) return (phase: RequestPhase.idle, id: null, by: null);
    return open.status == ServiceRequestStatus.acknowledged
        ? (phase: RequestPhase.onTheWay, id: open.id, by: open.acknowledgedBy)
        : (phase: RequestPhase.sent, id: open.id, by: null);
  }

  /// One tap on a tile: sends the request, or takes it back while it is only sent
  Future<void> tapRequest(ServiceRequestType type, {String? optionCode}) async {
    final state = requestState(type);
    if (state.phase == RequestPhase.idle) return _submitRequest(type, optionCode: optionCode);
    if (state.phase == RequestPhase.sent && state.id != null) return _cancelRequest(type, state.id!);
  }

  Future<void> _cancelRequest(ServiceRequestType type, int id) async {
    final l10n = AppLocalizations.of(context)!;
    setState(() => sendingRequest = type);
    try {
      await ref.read(serviceRequestRepositoryProvider).cancel(id);
      ref.read(myRequestsProvider.notifier).remove(id);
      if (mounted) showIsland(context: context, title: Text(l10n.requestCancelled), icon: const Icon(LucideIcons.undo2));
    } on DioException catch (e) {
      // Too late: someone picked it up between the tile and the tap
      if (mounted) {
        showIsland(
          context: context,
          title: Text(e.response?.statusCode == 409 ? l10n.requestAlreadyPickedUp : l10n.failedToSendRequest),
          icon: Icon(e.response?.statusCode == 409 ? LucideIcons.footprints : LucideIcons.circleX),
        );
      }
    } finally {
      if (mounted) setState(() => sendingRequest = null);
      ref.read(myRequestsProvider.notifier).refresh();
    }
  }

  Future<void> _submitRequest(ServiceRequestType type, {String? optionCode}) async {
    final target = requestTarget;
    final request = CreateServiceRequest(
      placeId: target.placeId,
      placeKind: target.placeKind,
      placeName: target.placeName,
      sessionId: target.sessionId,
      optionCode: optionCode,
      requestType: type,
    );

    setState(() => sendingRequest = type);
    final success = await ref.read(serviceRequestProvider.notifier).submitRequest(request);
    // Seen at once, then confirmed by the server's own list
    final created = ref.read(serviceRequestProvider).lastRequest;
    if (success && created != null) ref.read(myRequestsProvider.notifier).add(created);
    ref.read(myRequestsProvider.notifier).refresh();
    if (!mounted) return;
    setState(() => sendingRequest = null);
    if (success) {
      showIsland(
        context: context,
        title: Text(_successMessage(type)),
        icon: Icon(LucideIcons.check, color: NinjaColors.success),
      );
    } else {
      final l10n = AppLocalizations.of(context)!;
      final error = ref.read(serviceRequestProvider).error;
      showIsland(
        context: context,
        title: Text(error == 'cooldown' ? l10n.pleaseWaitBeforeRequest : l10n.failedToSendRequest),
        icon: Icon(LucideIcons.circleX, color: context.theme.colors.destructive),
      );
    }
  }

  String _successMessage(ServiceRequestType type) {
    final l10n = AppLocalizations.of(context)!;
    switch (type) {
      case ServiceRequestType.callWaiter:
        return l10n.waiterNotified;
      case ServiceRequestType.controllerChange:
        return l10n.controllerRequestSent;
      case ServiceRequestType.receiptToPay:
        return l10n.billRequestSent;
      case ServiceRequestType.switchToMulti:
        return l10n.switchToMultiRequestSent;
      case ServiceRequestType.switchToSingle:
        return l10n.switchToSingleRequestSent;
      case ServiceRequestType.changeOption:
        return l10n.switchRequestSent;
    }
  }
}

/// Two tiles a row, however many the place can take
class RequestGrid extends StatelessWidget {
  final List<RequestAction> actions;

  const RequestGrid({super.key, required this.actions});

  @override
  Widget build(BuildContext context) {
    final rows = <Widget>[];
    for (var i = 0; i < actions.length; i += 2) {
      final pair = actions.skip(i).take(2).toList();
      rows.add(Row(
        children: [
          for (var j = 0; j < pair.length; j++) ...[
            if (j > 0) const SizedBox(width: 12),
            Expanded(
              child: RequestTile(action: pair[j]),
            ),
          ],
          if (pair.length == 1) ...[
            const SizedBox(width: 12),
            const Expanded(child: SizedBox.shrink()),
          ],
        ],
      ));
      if (i + 2 < actions.length) rows.add(const SizedBox(height: 12));
    }
    return Column(children: rows);
  }
}

/// One thing to ask the staff for, as a tile that is also its status
/// (client_web's request-tile.tsx): tap to send, tap again to take it back
/// while it is only sent, then on the way (with who is coming) once the
/// staff pick it up. The open request is the cooldown; the tile says so.
class RequestTile extends StatelessWidget {
  final RequestAction action;

  const RequestTile({super.key, required this.action});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final theme = context.theme;
    final c = theme.colors;
    final phase = action.phase;
    final disabled = action.busy || phase == RequestPhase.sending || phase == RequestPhase.onTheWay;
    const green = Color(0xFF10B981);
    final (Color fill, Color disc, Color ink) = switch (phase) {
      RequestPhase.onTheWay => (green.withValues(alpha: 0.15), green, Colors.white),
      RequestPhase.sent => (c.primary.withValues(alpha: 0.12), c.primary, c.primaryForeground),
      _ => (c.muted, c.background, c.foreground),
    };
    final note = switch (phase) {
      RequestPhase.sent => l10n.sent,
      RequestPhase.onTheWay => action.by != null && action.by!.isNotEmpty ? l10n.onTheWayBy(action.by!) : l10n.onTheWay,
      _ => null,
    };
    final caption = context.localeText(theme.typography.caption.copyWith(color: c.mutedForeground));
    return Pressable(
      onTap: disabled ? null : action.onTap,
      scale: 0.97,
      child: AnimatedContainer(
        duration: Motion.slow,
        constraints: const BoxConstraints(minHeight: 96),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: fill, borderRadius: BorderRadius.circular(Ninja.panelRadius)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AnimatedContainer(
              duration: Motion.slow,
              width: 40,
              height: 40,
              decoration: BoxDecoration(color: disc, shape: BoxShape.circle),
              child: BlurSwap(
                alignment: Alignment.center,
                child: phase == RequestPhase.sending
                    ? SizedBox(key: const ValueKey('sending'), width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: ink))
                    : Icon(
                        switch (phase) {
                          RequestPhase.sent => LucideIcons.hourglass,
                          RequestPhase.onTheWay => LucideIcons.check,
                          _ => action.icon,
                        },
                        key: ValueKey(phase),
                        size: 20,
                        color: ink,
                      ),
              ),
            ),
            const SizedBox(height: 12),
            Text(action.label, style: context.localeText(theme.typography.note.copyWith(fontWeight: FontWeight.w600, color: c.foreground, height: 1.3))),
            // A third of a phone is narrow: the status wraps, and the way to take it back is a size down
            BlurSwap(
              child: note == null
                  ? const SizedBox.shrink(key: ValueKey('none'))
                  : Column(
                      key: ValueKey(note),
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(note, style: caption),
                        if (phase == RequestPhase.sent) Text(l10n.tapToCancel, style: caption.copyWith(fontSize: 11)),
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

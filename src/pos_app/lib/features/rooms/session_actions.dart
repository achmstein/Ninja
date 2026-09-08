import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/widgets/pos_toast.dart';
import '../../l10n/app_localizations.dart';
import '../tickets/providers/tickets_provider.dart';
import 'providers/rooms_provider.dart';

/// Every session control the till has, each the same call the admin apps
/// make. Success refetches rooms, sessions and tickets (ending a session
/// lands its time on the ticket through the completed event) and toasts;
/// failure toasts.
class SessionActions {
  final WidgetRef ref;
  final BuildContext context;

  SessionActions(this.ref, this.context);

  RoomsNotifier get _rooms => ref.read(roomsProvider.notifier);

  Future<bool> _run(Future<bool> Function() call, {String? success, required String failure}) async {
    final ok = await call();
    // The notifier reloaded rooms and sessions itself; the bills follow
    ref.read(openTicketsProvider.notifier).refresh();
    ref.invalidate(ticketProvider);
    ref.invalidate(sessionProvider);
    if (!context.mounted) return ok;
    if (ok) {
      if (success != null) showPosToast(context, PosToastType.success, success);
    } else {
      showPosToast(context, PosToastType.error, failure);
    }
    return ok;
  }

  AppLocalizations get _l10n => AppLocalizations.of(context)!;

  Future<bool> startWalkIn(int roomId, String? playerMode) => _run(
        () => _rooms.startWalkInSession(roomId, playerMode: playerMode),
        success: _l10n.sessionStarted,
        failure: _l10n.failedToStartSession,
      );

  Future<bool> startReserved(int sessionId, String? playerMode) => _run(
        () => _rooms.startSession(sessionId, playerMode: playerMode),
        success: _l10n.sessionStarted,
        failure: _l10n.failedToStartSession,
      );

  Future<bool> endSession(int sessionId) => _run(
        () => _rooms.endSession(sessionId),
        success: _l10n.sessionEnded,
        failure: _l10n.failedToEndSession,
      );

  // A reservation and a running session read differently
  Future<bool> cancelSession(int sessionId, {required bool wasActive}) => _run(
        () => _rooms.cancelSession(sessionId),
        success: wasActive ? _l10n.sessionCancelled : _l10n.reservationCancelled,
        failure: _l10n.failedToCancelSession,
      );

  Future<bool> changeMode(int sessionId, String playerMode) => _run(
        () => _rooms.changePlayerMode(sessionId, playerMode),
        success: _l10n.playerModeUpdated,
        failure: _l10n.failedToChangePlayerMode,
      );

  Future<bool> assignCustomer(int sessionId, String customerId, String customerName) => _run(
        () => _rooms.assignCustomerToSession(sessionId, customerId, customerName),
        success: _l10n.customerAssigned,
        failure: _l10n.failedToAssignCustomer,
      );

  Future<bool> addMember(int sessionId, String customerId, String customerName) => _run(
        () => _rooms.addMemberToSession(sessionId, customerId, customerName),
        success: _l10n.customerAdded,
        failure: _l10n.failedToAddCustomer,
      );

  Future<bool> removeMember(int sessionId, String customerId) => _run(
        () => _rooms.removeMemberFromSession(sessionId, customerId),
        success: _l10n.memberRemoved,
        failure: _l10n.failedToRemoveMember,
      );

  Future<bool> reserve(int roomId) => _run(
        () => _rooms.reserveRoom(roomId),
        success: _l10n.roomReserved,
        failure: _l10n.failedToReserveRoom,
      );
}

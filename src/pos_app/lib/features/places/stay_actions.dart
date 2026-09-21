import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/widgets/pos_toast.dart';
import '../../l10n/app_localizations.dart';
import '../tickets/providers/tickets_provider.dart';
import 'providers/places_provider.dart';

/// Every session control the till has, each the same call the admin apps
/// make. Success refetches places, stays and tickets (ending a session
/// lands its time on the ticket through the completed event) and toasts;
/// failure toasts.
class StayActions {
  final WidgetRef ref;
  final BuildContext context;

  StayActions(this.ref, this.context);

  PlacesNotifier get _places => ref.read(placesProvider.notifier);

  Future<bool> _run(Future<bool> Function() call, {String? success, required String failure}) async {
    final ok = await call();
    // The notifier reloaded rooms and sessions itself; the bills follow
    ref.read(openTicketsProvider.notifier).refresh();
    ref.invalidate(ticketProvider);
    ref.invalidate(stayProvider);
    if (!context.mounted) return ok;
    if (ok) {
      if (success != null) showPosToast(context, PosToastType.success, success);
    } else {
      showPosToast(context, PosToastType.error, failure);
    }
    return ok;
  }

  AppLocalizations get _l10n => AppLocalizations.of(context)!;

  Future<bool> startWalkIn(int placeId, String? optionCode) => _run(
        () => _places.startWalkIn(placeId, optionCode: optionCode),
        success: _l10n.sessionStarted,
        failure: _l10n.failedToStartSession,
      );

  /// The party arrived and sat down: at a timed place the clock starts, at
  /// a plain table the reservation simply closes
  Future<bool> seat(int reservationId, String? optionCode, {required bool timed}) => _run(
        () => _places.seatReservation(reservationId, optionCode: optionCode),
        success: timed ? _l10n.sessionStarted : _l10n.partySeated,
        failure: _l10n.failedToStartSession,
      );

  /// The customer arrived. A reservation that asked for it starts the
  /// clock on this; one that did not stays reserved until Seat.
  Future<bool> confirm(int reservationId, {required bool startsClock}) => _run(
        () => _places.confirmReservation(reservationId),
        success: startsClock ? _l10n.sessionStarted : _l10n.holdConfirmed,
        failure: _l10n.failedToStartSession,
      );

  Future<bool> endStay(int sessionId) => _run(
        () => _places.endStay(sessionId),
        success: _l10n.sessionEnded,
        failure: _l10n.failedToEndSession,
      );

  Future<bool> cancelStay(int sessionId) => _run(
        () => _places.cancelStay(sessionId),
        success: _l10n.sessionCancelled,
        failure: _l10n.failedToCancelSession,
      );

  Future<bool> cancelReservation(int reservationId) => _run(
        () => _places.cancelReservation(reservationId),
        success: _l10n.reservationCancelled,
        failure: _l10n.failedToCancelSession,
      );

  Future<bool> assignReservationCustomer(int reservationId, String customerId, String customerName) => _run(
        () => _places.assignReservationCustomer(reservationId, customerId, customerName),
        success: _l10n.customerAssigned,
        failure: _l10n.failedToAssignCustomer,
      );

  Future<bool> changeOption(int sessionId, String optionCode) => _run(
        () => _places.changeOption(sessionId, optionCode),
        success: _l10n.rateChanged,
        failure: _l10n.failedToChangeRate,
      );

  Future<bool> assignCustomer(int sessionId, String customerId, String customerName) => _run(
        () => _places.assignStayCustomer(sessionId, customerId, customerName),
        success: _l10n.customerAssigned,
        failure: _l10n.failedToAssignCustomer,
      );

  Future<bool> addMember(int sessionId, String customerId, String customerName) => _run(
        () => _places.addStayMember(sessionId, customerId, customerName),
        success: _l10n.customerAdded,
        failure: _l10n.failedToAddCustomer,
      );

  Future<bool> removeMember(int sessionId, String customerId) => _run(
        () => _places.removeStayMember(sessionId, customerId),
        success: _l10n.memberRemoved,
        failure: _l10n.failedToRemoveMember,
      );

  Future<bool> reserve(int placeId) => _run(
        () => _places.holdPlace(placeId),
        success: _l10n.roomReserved,
        failure: _l10n.failedToReserveRoom,
      );
}

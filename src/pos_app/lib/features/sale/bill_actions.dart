import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ninja_app_core/models/localized_text.dart';
import 'package:ninja_app_core/widgets/confirm_dialog.dart';
import '../../core/widgets/pos_toast.dart';
import '../../l10n/app_localizations.dart';
import '../floor/widgets/bill_card.dart' show ticketTypeLabel;
import '../orders/models/order.dart';
import '../places/models/place.dart';
import '../places/stay_actions.dart';
import '../ticket/screens/settle_screen.dart';
import '../tickets/models/online_payment.dart';
import '../tickets/models/ticket_detail.dart';
import '../tickets/services/online_payments_service.dart';

/// What an open bill is called wherever the till names it: the place it is
/// for, else its label, else its kind
String billTitle(BuildContext context, TicketDetail ticket) {
  final place = ticket.locationName?.localized(context) ?? '';
  if (place.isNotEmpty) return place;
  final label = ticket.label ?? '';
  return label.isNotEmpty ? label : ticketTypeLabel(AppLocalizations.of(context)!, ticket.type);
}

/// Taking the money for an open bill, from the bill's own page or from the
/// order screen it is rung up on: the same guards, then the same settle page.
///
/// Three things stand before it. A guest at the provider's checkout: their
/// money would land on a closed bill, so the settle waits for them. A
/// running clock: its time is not on the bill yet, so the only way on is to
/// end the session. An order from the app still waiting to be accepted: it
/// may be stale, so the cashier may settle past it, told once.
///
/// Answers with what was paid, or null when the bill was left open.
Future<SettleOutcome?> settleBill(
  BuildContext context,
  WidgetRef ref,
  TicketDetail ticket, {
  List<Order> waiting = const [],
  Stay? activeSession,
  List<StayMember> members = const [],
}) async {
  final l10n = AppLocalizations.of(context)!;
  final online = ref.read(onlinePaymentsProvider(ticket.id)).value ?? const <OnlinePaymentView>[];
  if (online.anyPending) {
    showPosToast(context, PosToastType.warning, l10n.guestPayingOnline);
    return null;
  }
  if (activeSession != null) {
    final end = await showConfirmDialog(
      context,
      title: l10n.settleWithSessionTitle,
      cancelLabel: l10n.goBack,
      actionLabel: l10n.endSessionButton,
      destructive: true,
    );
    if (end && context.mounted) await StayActions(ref, context).endStay(activeSession.id);
    return null;
  }
  // Not by accident: confirmed later, a waiting order would land on a closed bill
  if (waiting.isNotEmpty) {
    final anyway = await showConfirmDialog(
      context,
      title: l10n.settleWithPendingTitle,
      cancelLabel: l10n.goBack,
      actionLabel: l10n.settleAnyway,
      destructive: true,
    );
    if (!anyway || !context.mounted) return null;
  }
  // The settle page refreshes the floor and this ticket itself on success
  return showSettle(context, ticket, title: billTitle(context, ticket), members: members, onlinePaid: online.paidOnline);
}

/// Void, behind the same rule as settle (server-enforced too): time that
/// has not landed yet is money, and a void would write it off unseen. True
/// when the way is clear for the void itself
Future<bool> clearToVoid(BuildContext context, WidgetRef ref, Stay? activeSession) async {
  if (activeSession == null) return true;
  final l10n = AppLocalizations.of(context)!;
  final end = await showConfirmDialog(
    context,
    title: l10n.voidWithSessionTitle,
    cancelLabel: l10n.goBack,
    actionLabel: l10n.endSessionButton,
    destructive: true,
  );
  if (end && context.mounted) await StayActions(ref, context).endStay(activeSession.id);
  return false;
}

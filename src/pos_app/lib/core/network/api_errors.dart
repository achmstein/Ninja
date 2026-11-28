import 'package:ninja_app_core/network/app_failure.dart';
import '../../features/tickets/services/tickets_service.dart';
import '../../l10n/app_localizations.dart';

/// The one line the cashier sees when a call fails: the server's own
/// reason when it gave one (a rule the domain refused), the generic
/// message otherwise. Same order of preference as pos_web's
/// handle-server-error.
String describeError(Object error, AppLocalizations l10n) {
  if (error is SalesException) return error.message;
  return serverReason(error) ?? l10n.somethingWentWrong;
}

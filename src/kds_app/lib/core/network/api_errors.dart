import 'package:ninja_app_core/network/app_failure.dart';
import '../../l10n/app_localizations.dart';

/// The one line the kitchen sees when a call fails: the server's own
/// reason when it gave one (a rule the domain refused, such as sending an
/// order back to New), the generic message otherwise. Same order of
/// preference as kds_web's handle-server-error.
String describeError(Object error, AppLocalizations l10n) {
  return serverReason(error) ?? l10n.somethingWentWrong;
}

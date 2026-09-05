import 'package:dio/dio.dart';
import '../../l10n/app_localizations.dart';

/// The one line the kitchen sees when a call fails: the server's own
/// reason when it gave one (a rule the domain refused, such as sending an
/// order back to New), the generic message otherwise. Same order of
/// preference as kds_web's handle-server-error.
String describeError(Object error, AppLocalizations l10n) {
  if (error is DioException) {
    final data = error.response?.data;
    if (data is String && data.isNotEmpty && data.length < 200) return data;
    if (data is Map && data['title'] is String) return data['title'] as String;
    if (data is Map && data['detail'] is String) return data['detail'] as String;
  }
  return l10n.somethingWentWrong;
}

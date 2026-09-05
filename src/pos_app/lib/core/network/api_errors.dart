import 'package:dio/dio.dart';
import '../../features/tickets/services/tickets_service.dart';
import '../../l10n/app_localizations.dart';

/// The one line the cashier sees when a call fails: the server's own
/// reason when it gave one (a rule the domain refused), the generic
/// message otherwise. Same order of preference as pos_web's
/// handle-server-error.
String describeError(Object error, AppLocalizations l10n) {
  if (error is SalesException) return error.message;
  if (error is DioException) {
    final data = error.response?.data;
    if (data is String && data.isNotEmpty && data.length < 200) return data;
    if (data is Map && data['title'] is String) return data['title'] as String;
    if (data is Map && data['detail'] is String) return data['detail'] as String;
  }
  return l10n.somethingWentWrong;
}

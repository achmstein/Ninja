import 'package:dio/dio.dart';
import '../../l10n/app_localizations.dart';
import 'package:ninja_app_core/network/network_status.dart';

/// What a failed call means to the rider, read from the answer's shape
/// rather than its words: the server's text is English and technical, so it
/// is never shown. Ordering answers with ProblemDetails carrying a stable
/// `code` (delivery.not_out, rider.not_yours, module.off, ...).
enum ApiFailure {
  /// Nothing reached the server
  offline,

  /// The business does not deliver (not bought, or switched off): 402 module.off
  notDelivering,

  /// Someone else moved it first: 409 delivery.conflict
  conflict,

  /// The delivery is another rider's: rider.not_yours
  notYours,

  /// It has not left yet, so it cannot be delivered: delivery.not_out
  notOutYet,

  /// It already left: delivery.already_out
  alreadyOut,

  /// It is already delivered or settled: delivery.not_delivered / delivery.already_settled
  alreadyDone,

  /// The till has not confirmed the order yet: delivery.not_confirmed
  notConfirmed,

  /// Anything else
  other,
}

/// The stable code a ProblemDetails answer carries, if any
String? problemCode(Object error) {
  if (error is! DioException) return null;
  final data = error.response?.data;
  if (data is Map && data['code'] is String) return data['code'] as String;
  return null;
}

ApiFailure classifyError(Object error) {
  if (error is! DioException) return ApiFailure.other;
  if (NetworkStatus.isConnectionError(error)) return ApiFailure.offline;
  final status = error.response?.statusCode;
  final code = problemCode(error);
  if (status == 402 || code == 'module.off' || code == 'delivery.not_delivering') return ApiFailure.notDelivering;
  return switch (code) {
    'delivery.conflict' => ApiFailure.conflict,
    'rider.not_yours' => ApiFailure.notYours,
    'delivery.not_out' => ApiFailure.notOutYet,
    'delivery.already_out' => ApiFailure.alreadyOut,
    'delivery.not_delivered' || 'delivery.already_settled' => ApiFailure.alreadyDone,
    'delivery.not_confirmed' => ApiFailure.notConfirmed,
    _ => status == 409 ? ApiFailure.conflict : status == 403 ? ApiFailure.notYours : ApiFailure.other,
  };
}

/// The one line the rider sees when a call fails, in their language
String describeError(Object error, AppLocalizations l10n) => switch (classifyError(error)) {
      ApiFailure.offline => l10n.errorOffline,
      ApiFailure.notDelivering => l10n.notDelivering,
      ApiFailure.conflict => l10n.errorConflict,
      ApiFailure.notYours => l10n.errorNotYours,
      ApiFailure.notOutYet => l10n.errorNotOutYet,
      ApiFailure.alreadyOut => l10n.errorAlreadyOut,
      ApiFailure.alreadyDone => l10n.errorAlreadyDone,
      ApiFailure.notConfirmed => l10n.errorNotConfirmed,
      ApiFailure.other => l10n.somethingWentWrong,
    };

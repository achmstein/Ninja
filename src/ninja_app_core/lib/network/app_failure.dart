import 'package:dio/dio.dart';
import 'network_status.dart';

/// What a failed call means, read once from the error (docs/frontend-architecture-plan.md,
/// "one way to fail"): screens decide what to say from this, not from Dio.
sealed class AppFailure implements Exception {
  const AppFailure();

  /// Reads any error a call threw
  factory AppFailure.from(Object error) {
    if (error is AppFailure) return error;
    if (NetworkStatus.isConnectionError(error)) return const OfflineFailure();
    if (error is DioException && error.response != null) {
      final status = error.response!.statusCode;
      if (status == 401) return const SignedOutFailure();
      return ServerFailure(status: status, code: problemCode(error), reason: serverReason(error));
    }
    return UnknownFailure(error);
  }
}

/// Nothing reached the server
final class OfflineFailure extends AppFailure {
  const OfflineFailure();
}

/// The sign-in ran out and could not be renewed
final class SignedOutFailure extends AppFailure {
  const SignedOutFailure();
}

/// The server answered with a refusal
final class ServerFailure extends AppFailure {
  final int? status;

  /// The stable code a ProblemDetails answer carries (delivery.not_out, module.off, ...)
  final String? code;

  /// The server's own words, when it gave any (see [serverReason])
  final String? reason;

  const ServerFailure({this.status, this.code, this.reason});
}

/// Anything else: a bug, a parse error
final class UnknownFailure extends AppFailure {
  final Object error;

  const UnknownFailure(this.error);
}

/// The stable code a ProblemDetails answer carries, if any
String? problemCode(Object error) {
  if (error is! DioException) return null;
  final data = error.response?.data;
  return data is Map && data['code'] is String ? data['code'] as String : null;
}

/// The server's own reason when it gave one (a rule the domain refused): a short
/// text body, else the ProblemDetails title, else its detail; null otherwise. The
/// same order of preference as the web apps' server-error handler.
String? serverReason(Object error) {
  if (error is! DioException) return null;
  final data = error.response?.data;
  if (data is String && data.isNotEmpty && data.length < 200) return data;
  if (data is Map && data['title'] is String) return data['title'] as String;
  if (data is Map && data['detail'] is String) return data['detail'] as String;
  return null;
}

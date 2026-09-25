import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/config/app_config.dart';

/// The token in whatever the customer has: the link the café shared
/// (https://{café}/claim?token=…), scanned from its QR or pasted, or the
/// bare token. Null when it is neither.
String? claimTokenFrom(String? input) {
  final text = input?.trim() ?? '';
  if (text.isEmpty) return null;

  // A link pasted without its https:// still carries its ?token=
  final uri = Uri.tryParse(text.contains('token=') && !text.contains('://') ? 'https://$text' : text);
  if (uri != null && uri.hasScheme) {
    final token = uri.queryParameters['token']?.trim();
    return token != null && _tokenShape.hasMatch(token) ? token : null;
  }
  return _tokenShape.hasMatch(text) ? text : null;
}

/// The user's id (compact or dashed) and a base64url secret, joined by a dot
final _tokenShape = RegExp(r'^[0-9A-Za-z-]{8,64}\.[A-Za-z0-9_-]{16,128}$');

/// Whose account a link hands over, and until when
class ClaimPreview {
  final String name;
  final String? phoneNumber;
  final DateTime? expiresAt;

  const ClaimPreview({required this.name, this.phoneNumber, this.expiresAt});

  factory ClaimPreview.fromJson(Map<String, dynamic> json) => ClaimPreview(
        name: (json['name'] as String?) ?? '',
        phoneNumber: json['phoneNumber'] as String?,
        expiresAt: DateTime.tryParse(json['expiresAt'] as String? ?? ''),
      );
}

/// Why a claim did not go through, in the words the screen shows
enum ClaimFailure {
  /// Not a link the café made, or one a newer link replaced
  invalid,
  expired,
  used,
  emailTaken,
  badEmail,
  badPassword,
  tooManyAttempts,
  network,
}

class ClaimException implements Exception {
  final ClaimFailure failure;
  const ClaimException(this.failure);

  @override
  String toString() => 'ClaimException($failure)';
}

/// Identity's claim endpoints; anonymous, the token is the credential
abstract class ClaimRepository {
  Future<ClaimPreview> preview(String token);

  /// The email the account now signs in with
  Future<String> claim(String token, String email, String password);
}

class DioClaimRepository implements ClaimRepository {
  final Dio _dio;

  DioClaimRepository([Dio? dio])
      : _dio = dio ??
            Dio(BaseOptions(
              baseUrl: AppConfig.identityApiUrl,
              connectTimeout: const Duration(seconds: 10),
              receiveTimeout: const Duration(seconds: 10),
              contentType: Headers.jsonContentType,
            ));

  @override
  Future<ClaimPreview> preview(String token) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>('claim/preview', data: {'token': token});
      return ClaimPreview.fromJson(response.data ?? const {});
    } on DioException catch (e) {
      throw ClaimException(failureOf(e.response?.statusCode, e.response?.data));
    }
  }

  @override
  Future<String> claim(String token, String email, String password) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        'claim',
        data: {'token': token, 'email': email, 'password': password},
      );
      return (response.data?['email'] as String?) ?? email;
    } on DioException catch (e) {
      throw ClaimException(failureOf(e.response?.statusCode, e.response?.data));
    }
  }
}

/// What an answer from Identity means for the screen
ClaimFailure failureOf(int? status, Object? body) {
  final data = body is Map ? body : const {};
  return switch (status) {
    404 => ClaimFailure.invalid,
    410 => data['reason'] == 'used' ? ClaimFailure.used : ClaimFailure.expired,
    409 => ClaimFailure.emailTaken,
    400 => data['field'] == 'password' ? ClaimFailure.badPassword : ClaimFailure.badEmail,
    429 => ClaimFailure.tooManyAttempts,
    _ => ClaimFailure.network,
  };
}

final claimRepositoryProvider = Provider<ClaimRepository>((ref) => DioClaimRepository());

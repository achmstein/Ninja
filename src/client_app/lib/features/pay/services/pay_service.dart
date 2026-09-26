import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/auth/auth_service.dart';
import '../../../core/config/app_config.dart';
import '../../../core/network/api_client.dart';
import '../models/pay_view.dart';
import '../pay_math.dart';

/// Which bill to pay: one the customer is on, or whatever is open at the
/// table they sit at.
class PaySource {
  final int? ticketId;
  final int? placeId;
  final int? branchId;

  const PaySource.ticket(int this.ticketId)
      : placeId = null,
        branchId = null;

  const PaySource.place(int this.placeId, int this.branchId) : ticketId = null;

  @override
  bool operator ==(Object other) =>
      other is PaySource && other.ticketId == ticketId && other.placeId == placeId && other.branchId == branchId;

  @override
  int get hashCode => Object.hash(ticketId, placeId, branchId);
}

/// A refusal the server put in words (a 400's ProblemDetails.detail)
class PayException implements Exception {
  final String message;
  const PayException(this.message);

  @override
  String toString() => message;
}

/// Nothing is open at the table (404)
class NothingToPay implements Exception {
  const NothingToPay();
}

class PayRepository {
  final ApiClient _api;

  PayRepository(this._api);

  Future<PayView> getBill(PaySource source) async {
    try {
      final response = source.ticketId != null
          ? await _api.get<Map<String, dynamic>>('tickets/${source.ticketId}')
          : await _api.get<Map<String, dynamic>>('places/${source.placeId}',
              queryParameters: {'branchId': source.branchId});
      return PayView.fromJson(response.data!);
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) throw const NothingToPay();
      rethrow;
    }
  }

  Future<StartedPayment> start(
    int ticketId, {
    required SplitKind mode,
    List<int>? lineIds,
    int? parts,
    int? of,
    double? amount,
    String? payerName,
  }) async {
    try {
      final response = await _api.post<Map<String, dynamic>>('tickets/$ticketId', data: {
        'mode': mode.value,
        'lineIds': lineIds,
        'parts': parts,
        'of': of,
        'amount': amount,
        'payerName': payerName,
        'payerPhone': null,
      });
      return StartedPayment.fromJson(response.data!);
    } on DioException catch (e) {
      final data = e.response?.data;
      if (e.response?.statusCode == 400 && data is Map && data['detail'] is String) {
        throw PayException(data['detail'] as String);
      }
      rethrow;
    }
  }

  /// Lets a payment still in checkout go, so its share is free again.
  /// Throws [PayException] with the server's reason when it refuses.
  Future<void> cancel(String key) async {
    try {
      await _api.post<void>('$key/cancel');
    } on DioException catch (e) {
      final data = e.response?.data;
      if (e.response?.statusCode == 400 && data is Map && data['detail'] is String) {
        throw PayException(data['detail'] as String);
      }
      rethrow;
    }
  }

  Future<PaymentStatus> status(String key) async {
    final response = await _api.get<Map<String, dynamic>>(key);
    return PaymentStatus.fromJson(response.data!);
  }
}

final paymentsApiProvider = Provider<ApiClient>((ref) {
  final authService = ref.read(authServiceProvider.notifier);
  return ApiClient(authService, baseUrl: AppConfig.paymentsApiUrl);
});

final payRepositoryProvider = Provider<PayRepository>((ref) => PayRepository(ref.read(paymentsApiProvider)));

/// The guest's pretend checkout on a demo café's customer site, for a
/// payment still in checkout; null when the site is not known
Uri? simulatedCheckoutUrl(String? customerUrl, String key) {
  final origin = customerUrl?.trim();
  if (origin == null || origin.isEmpty) return null;
  final base = origin.endsWith('/') ? origin.substring(0, origin.length - 1) : origin;
  return Uri.tryParse('$base/pay/${key.replaceAll('-', '')}?simulate=1');
}

/// How often a bill on the bills tab re-reads what the table has paid
const _tileRefresh = Duration(seconds: 15);

/// A bill as a guest pays it, for the bills tab: re-read now and then so a
/// friend's share lands without a pull. Null when there is nothing to show
/// (nothing open, or the café does not take payments at the table).
final payViewProvider = FutureProvider.autoDispose.family<PayView?, PaySource>((ref, source) async {
  final timer = Timer(_tileRefresh, ref.invalidateSelf);
  ref.onDispose(timer.cancel);
  try {
    final view = await ref.read(payRepositoryProvider).getBill(source);
    return offersPay(view.why) ? view : null;
  } on NothingToPay {
    return null;
  }
});

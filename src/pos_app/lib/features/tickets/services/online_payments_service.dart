import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/brand/brand_provider.dart';
import '../../../core/config/app_config.dart';
import '../../../core/network/api_client.dart';
import '../../../core/providers/branch_provider.dart';
import '../models/online_payment.dart';
import '../providers/tickets_provider.dart';
import 'tickets_service.dart';

/// Pay at table, the till's side: the payments guests made on a bill from
/// their phones, and giving one back while the bill is open.
abstract class OnlinePaymentsRepository {
  Future<List<OnlinePaymentView>> list(int ticketId);

  /// Throws [SalesException] with the server's reason when it refuses
  Future<void> refund(String key);
}

class ApiOnlinePaymentsRepository implements OnlinePaymentsRepository {
  final ApiClient _api;

  ApiOnlinePaymentsRepository(this._api);

  @override
  Future<List<OnlinePaymentView>> list(int ticketId) async {
    final response = await _api.get<List<dynamic>>('sales/payments/tickets/$ticketId/online');
    return (response.data ?? const [])
        .map((e) => OnlinePaymentView.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<void> refund(String key) async {
    try {
      await _api.post('sales/payments/$key/refund');
    } on DioException catch (e) {
      // A ProblemDetails whose detail is the reason (closed bill, provider said no)
      final data = e.response?.data;
      if (e.response?.statusCode == 400 && data is Map && data['detail'] is String) {
        throw SalesException(data['detail'] as String);
      }
      throw asSalesException(e);
    }
  }
}

final onlinePaymentsRepositoryProvider = Provider<OnlinePaymentsRepository>((ref) {
  return ApiOnlinePaymentsRepository(ref.read(salesApiProvider));
});

/// While a guest is at the provider's checkout the list is re-read this
/// often, so "Paying…" turns to paid (and the bill may settle itself) soon
const onlinePendingPoll = Duration(seconds: 5);

/// The online payments on one bill, when the café takes payments at the
/// table (none asked for otherwise: the gateway refuses the module's calls).
/// Re-read on the till's own ticket nudges (SignalR, and the open-bills
/// poll behind it), and every few seconds while one is still paying.
final onlinePaymentsProvider = FutureProvider.autoDispose.family<List<OnlinePaymentView>, int>((ref, ticketId) async {
  if (!ref.watch(featuresProvider).payAtTable) return const [];
  ref.watch(selectedBranchIdProvider);
  // A hub event about any bill refreshes the open bills; this one follows
  ref.listen(openTicketsProvider, (_, _) => ref.invalidateSelf());
  final list = await ref.read(onlinePaymentsRepositoryProvider).list(ticketId);
  final timer = Timer(list.anyPending ? onlinePendingPoll : AppConfig.ticketsPoll, ref.invalidateSelf);
  ref.onDispose(timer.cancel);
  return list;
});

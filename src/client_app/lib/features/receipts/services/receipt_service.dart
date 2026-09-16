import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/auth/auth_service.dart';
import '../../../core/config/app_config.dart';
import '../../../core/network/api_client.dart';
import '../models/receipt.dart';

/// Sales' customer-facing side of a bill: the receipt, for someone who was
/// on it. The client is not branch-scoped — a ticket id is global.
final ticketsApiProvider = Provider<ApiClient>((ref) {
  final authService = ref.read(authServiceProvider.notifier);
  return ApiClient(authService, baseUrl: AppConfig.ticketsApiUrl);
});

class ReceiptService {
  final ApiClient _apiClient;

  ReceiptService(this._apiClient);

  Future<Receipt> getReceipt(int ticketId) async {
    final response = await _apiClient.get<Map<String, dynamic>>('$ticketId/receipt');
    if (response.data == null) {
      throw Exception('Receipt not found');
    }
    return Receipt.fromJson(response.data!);
  }
}

final receiptServiceProvider = Provider<ReceiptService>(
  (ref) => ReceiptService(ref.read(ticketsApiProvider)),
);

/// One receipt, cached for the screen's life
final receiptProvider = FutureProvider.autoDispose.family<Receipt, int>(
  (ref, ticketId) => ref.read(receiptServiceProvider).getReceipt(ticketId),
);

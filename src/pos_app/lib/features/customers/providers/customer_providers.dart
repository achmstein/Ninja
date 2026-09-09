import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/customer_card.dart';
import '../services/customer_card_service.dart';

/// The customer's loyalty account, or null when they never joined.
final loyaltyAccountProvider = FutureProvider.autoDispose.family<LoyaltyAccount?, String>(
  (ref, userId) => ref.read(customerCardServiceProvider).getLoyalty(userId),
);

/// The customer's tab balance, or null when they have no tab.
final tabAccountProvider = FutureProvider.autoDispose.family<TabAccount?, String>(
  (ref, customerId) => ref.read(customerCardServiceProvider).getTab(customerId),
);

/// Forget what the till knows about a customer's balances: after a bill
/// goes on their tab, or a payment comes off it. Accounts posts both off
/// the bus, so the next read may still be a beat behind — the card reads
/// again when it opens.
void invalidateCustomer(Ref ref, String customerId) {
  ref.invalidate(tabAccountProvider(customerId));
  ref.invalidate(loyaltyAccountProvider(customerId));
}

/// The same, from a widget
void invalidateCustomerFrom(WidgetRef ref, String customerId) {
  ref.invalidate(tabAccountProvider(customerId));
  ref.invalidate(loyaltyAccountProvider(customerId));
}

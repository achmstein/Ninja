import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';
import '../../../core/auth/auth_service.dart';
import '../../../core/network/api_client.dart';
import '../../../core/providers/branch_provider.dart';
import '../../../core/utils/business_day.dart';
import '../../cart/models/cart_item.dart';
import '../../cart/services/cart_service.dart';
import '../../menu/models/menu_item.dart';
import '../../menu/models/user_preference.dart';
import '../../menu/services/menu_service.dart';
import '../models/order.dart';

const _uuid = Uuid();

/// Abstract order repository interface
abstract class OrderRepository {
  Future<PaginatedOrders> getOrders({int pageIndex = 0, int pageSize = 10, DateTime? fromDate, DateTime? toDate});
  Future<Order> getOrder(int id);
  Future<void> createOrder({
    required List<CartItem> items,
    required String userId,
    required String userName,
    required String requestId,
    int? placeId,
    String? placeKind,
    Map<String, dynamic>? placeName,
    int? sessionId,
    String? customerNote,
    int pointsToRedeem,
    double loyaltyDiscount,
    String? promoCode,
  });
  Future<void> submitFastOrder({
    required MenuItem item,
    required String userId,
    required String userName,
    int? placeId,
    String? placeKind,
    Map<String, dynamic>? placeName,
    int? sessionId,
    UserItemPreference? preference,
  });
  Future<void> cancelOrder(int id);
  Future<void> rateOrder({
    required int orderId,
    required int ratingValue,
    String? comment,
  });
}

/// API implementation of OrderRepository
class ApiOrderRepository implements OrderRepository {
  final ApiClient _apiClient;

  ApiOrderRepository(this._apiClient);

  /// Get user's orders with pagination
  @override
  Future<PaginatedOrders> getOrders({int pageIndex = 0, int pageSize = 10, DateTime? fromDate, DateTime? toDate}) async {
    final response = await _apiClient.get<Map<String, dynamic>>(
      '',
      queryParameters: {
        'pageIndex': pageIndex,
        'pageSize': pageSize,
        if (fromDate != null) 'fromDate': fromDate.toUtc().toIso8601String(),
        if (toDate != null) 'toDate': toDate.toUtc().toIso8601String(),
      },
    );

    if (response.data == null) {
      throw Exception('Failed to load orders');
    }
    return PaginatedOrders.fromJson(response.data!);
  }

  /// Get order by ID
  @override
  Future<Order> getOrder(int id) async {
    final response = await _apiClient.get<Map<String, dynamic>>(
      '$id',
    );

    if (response.data == null) {
      throw Exception('Order not found');
    }
    return Order.fromJson(response.data!);
  }

  /// Create new order from cart
  /// Returns void - the backend returns 200 OK with no body on success
  @override
  Future<void> createOrder({
    required List<CartItem> items,
    required String userId,
    required String userName,
    required String requestId,
    int? placeId,
    String? placeKind,
    Map<String, dynamic>? placeName,
    int? sessionId,
    String? customerNote,
    int pointsToRedeem = 0,
    double loyaltyDiscount = 0,
    String? promoCode,
  }) async {
    await _apiClient.post<void>(
      '',
      data: {
        'userId': userId,
        'userName': userName,
        // Where the order goes; the server lands it on the place's bill, or
        // the stay's when a clock runs there.
        'placeId': placeId,
        'placeKind': placeKind,
        'placeName': placeName,
        'sessionId': sessionId,
        'customerNote': customerNote,
        'pointsToRedeem': pointsToRedeem,
        'loyaltyDiscount': loyaltyDiscount,
        'promoCode': promoCode,
        'items': items.map((item) => item.toJson()).toList(),
      },
      headers: {'x-requestid': requestId},
    );
    // Success if no exception thrown - API returns 200 OK with empty body
  }

  /// Submit a fast order for a menu item using saved preferences or defaults
  @override
  Future<void> submitFastOrder({
    required MenuItem item,
    required String userId,
    required String userName,
    int? placeId,
    String? placeKind,
    Map<String, dynamic>? placeName,
    int? sessionId,
    UserItemPreference? preference,
  }) async {
    final selectedCustomizations = <SelectedCustomization>[];
    final selectedOptions = <int, List<int>>{};

    // Initialize with defaults first
    for (final customization in item.customizations) {
      final defaults = customization.options
          .where((o) => o.isDefault)
          .map((o) => o.id)
          .toList();
      if (defaults.isNotEmpty) {
        selectedOptions[customization.id] = defaults;
      } else if (customization.isRequired && customization.options.isNotEmpty) {
        selectedOptions[customization.id] = [customization.options.first.id];
      }
    }

    // Apply saved preferences if available
    if (preference != null) {
      final savedByCustomization = <int, List<int>>{};
      for (final option in preference.selectedOptions) {
        savedByCustomization
            .putIfAbsent(option.customizationId, () => [])
            .add(option.optionId);
      }
      for (final customization in item.customizations) {
        final savedOpts = savedByCustomization[customization.id];
        if (savedOpts != null && savedOpts.isNotEmpty) {
          final validOptions = savedOpts
              .where((optionId) =>
                  customization.options.any((o) => o.id == optionId))
              .toList();
          if (validOptions.isNotEmpty) {
            selectedOptions[customization.id] = validOptions;
          }
        }
      }
      // Ensure required customizations have a selection
      for (final customization in item.customizations) {
        if (customization.isRequired) {
          final selected = selectedOptions[customization.id] ?? [];
          if (selected.isEmpty && customization.options.isNotEmpty) {
            selectedOptions[customization.id] = [customization.options.first.id];
          }
        }
      }
    }

    // Build SelectedCustomization list
    for (final customization in item.customizations) {
      final optionIds = selectedOptions[customization.id] ?? [];
      for (final optionId in optionIds) {
        final option =
            customization.options.firstWhere((o) => o.id == optionId);
        selectedCustomizations.add(SelectedCustomization(
          customizationId: customization.id,
          customizationName: customization.name,
          optionId: option.id,
          optionName: option.name,
          priceAdjustment: option.priceAdjustment,
        ));
      }
    }

    final cartItem =
        CartItem.fromMenuItem(item, customizations: selectedCustomizations);

    await createOrder(
      items: [cartItem],
      userId: userId,
      userName: userName,
      requestId: _uuid.v4(),
      placeId: placeId,
      placeKind: placeKind,
      placeName: placeName,
      sessionId: sessionId,
    );
  }

  /// Cancel order
  @override
  Future<void> cancelOrder(int id) async {
    await _apiClient.put('$id/cancel');
  }

  /// Rate an order
  @override
  Future<void> rateOrder({
    required int orderId,
    required int ratingValue,
    String? comment,
  }) async {
    await _apiClient.post<void>(
      '$orderId/rating',
      data: {
        'ratingValue': ratingValue,
        if (comment != null && comment.isNotEmpty) 'comment': comment,
      },
      headers: {'x-requestid': _uuid.v4()},
    );
  }
}

/// Provider for order repository
final orderRepositoryProvider = Provider<OrderRepository>((ref) {
  return ApiOrderRepository(ref.watch(ordersApiProvider));
});

/// The business day's orders. The bills tab shows what the till has not
/// put on a bill yet above the bills, and reads the rating on each for
/// the stars on a paid bill.
class OrdersState {
  final List<Order> orders;
  final bool isLoading;
  final String? error;

  const OrdersState({this.orders = const [], this.isLoading = false, this.error});

  OrdersState copyWith({List<Order>? orders, bool? isLoading, String? error}) => OrdersState(
        orders: orders ?? this.orders,
        isLoading: isLoading ?? this.isLoading,
        error: error,
      );
}

class OrdersNotifier extends Notifier<OrdersState> {
  /// A day's orders for one customer: one page covers it
  static const _pageSize = 50;

  @override
  OrdersState build() {
    Future.microtask(() => loadOrders());
    return const OrdersState(isLoading: true);
  }

  /// Load the business day's orders (initial load or refresh)
  Future<void> loadOrders() async {
    state = state.copyWith(isLoading: true, error: null);

    // Invalidate cached order details so they re-fetch with current status
    for (final order in state.orders) {
      ref.invalidate(orderProvider(order.id));
    }

    try {
      final service = ref.read(orderRepositoryProvider);
      final result = await service.getOrders(
        pageIndex: 0,
        pageSize: _pageSize,
        fromDate: businessDayStart(ref.read(branchProvider).selectedBranch),
      );
      state = state.copyWith(orders: result.items, isLoading: false);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  /// Refresh orders
  Future<void> refresh() async {
    await loadOrders();
  }
}

/// Provider for user's orders with pagination
final ordersProvider = NotifierProvider<OrdersNotifier, OrdersState>(OrdersNotifier.new);

/// Provider for single order
final orderProvider = FutureProvider.family<Order, int>((ref, id) async {
  final service = ref.watch(orderRepositoryProvider);
  return service.getOrder(id);
});

/// Checkout state
class CheckoutState {
  final bool isLoading;
  final String? error;
  final Order? order;

  const CheckoutState({
    this.isLoading = false,
    this.error,
    this.order,
  });

  CheckoutState copyWith({
    bool? isLoading,
    String? error,
    Order? order,
  }) {
    return CheckoutState(
      isLoading: isLoading ?? this.isLoading,
      error: error,
      order: order ?? this.order,
    );
  }
}

/// Checkout notifier
class CheckoutNotifier extends Notifier<CheckoutState> {
  late OrderRepository _orderService;
  late CartNotifier _cartNotifier;
  late MenuRepository _menuService;
  late AuthState _authState;

  // Idempotency: keep the request id across retries of the same payload, so
  // when a slow connection times out client-side but the request actually
  // reached the server, the retry is deduped server-side (same x-requestid)
  // instead of creating a duplicate order. A new id is only issued when the
  // payload changes or after a successful submission.
  String? _requestId;
  String? _requestSignature;

  @override
  CheckoutState build() {
    _orderService = ref.watch(orderRepositoryProvider);
    _cartNotifier = ref.watch(cartProvider.notifier);
    _menuService = ref.watch(menuRepositoryProvider);
    _authState = ref.watch(authServiceProvider);
    return const CheckoutState();
  }

  /// Submit order — guarded against duplicate calls
  Future<bool> submitOrder({
    required List<CartItem> items,
    int? placeId,
    String? placeKind,
    Map<String, dynamic>? placeName,
    int? sessionId,
    String? customerNote,
    int pointsToRedeem = 0,
    double loyaltyDiscount = 0,
    String? promoCode,
  }) async {
    if (state.isLoading) return false; // Prevent duplicate submissions
    state = state.copyWith(isLoading: true, error: null);

    final signature = jsonEncode({
      'items': items.map((item) => item.toJson()).toList(),
      'placeId': placeId,
      'sessionId': sessionId,
      'customerNote': customerNote,
      'pointsToRedeem': pointsToRedeem,
      'loyaltyDiscount': loyaltyDiscount,
      'promoCode': promoCode,
    });
    if (_requestSignature != signature || _requestId == null) {
      _requestSignature = signature;
      _requestId = _uuid.v4();
    }

    try {
      await _orderService.createOrder(
        items: items,
        userId: _authState.userId ?? '',
        userName: _authState.name ?? 'Guest',
        requestId: _requestId!,
        placeId: placeId,
        placeKind: placeKind,
        placeName: placeName,
        sessionId: sessionId,
        customerNote: customerNote,
        pointsToRedeem: pointsToRedeem,
        loyaltyDiscount: loyaltyDiscount,
        promoCode: promoCode,
      );

      // The order went through — the next submission is a new order
      _requestId = null;
      _requestSignature = null;

      // Save user preferences for items with customizations
      await _saveUserPreferences(items);

      // Clear cart on success
      _cartNotifier.clear();

      // Refresh orders so the new order appears when navigating to orders page
      ref.read(ordersProvider.notifier).refresh();

      state = state.copyWith(isLoading: false);
      return true;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: e.toString(),
      );
      return false;
    }
  }

  /// Save user preferences for ordered items with customizations
  Future<void> _saveUserPreferences(List<CartItem> items) async {
    try {
      final preferencesToSave = items
          .where((item) => item.selectedCustomizations.isNotEmpty)
          .map((item) => SaveItemPreference(
                catalogItemId: item.productId,
                selectedOptions: item.selectedCustomizations
                    .map((c) => UserPreferenceOption(
                          customizationId: c.customizationId,
                          optionId: c.optionId,
                        ))
                    .toList(),
              ))
          .toList();

      if (preferencesToSave.isNotEmpty) {
        await _menuService.saveUserPreferences(
          SaveUserPreferencesRequest(items: preferencesToSave),
        );
      }
    } catch (e) {
      // Silently fail - preferences are not critical to order success
    }
  }

  /// Reset checkout state
  void reset() {
    state = const CheckoutState();
  }
}

/// Provider for checkout
final checkoutProvider =
    NotifierProvider<CheckoutNotifier, CheckoutState>(CheckoutNotifier.new);

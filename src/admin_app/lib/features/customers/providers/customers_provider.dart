import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/customer.dart';
import '../services/customers_service.dart';

/// Customers state
class CustomersState {
  final bool isLoading;
  final String? error;
  final List<Customer> customers;
  final int totalCount;
  final String? searchQuery;

  const CustomersState({
    this.isLoading = false,
    this.error,
    this.customers = const [],
    this.totalCount = 0,
    this.searchQuery,
  });

  CustomersState copyWith({
    bool? isLoading,
    String? error,
    List<Customer>? customers,
    int? totalCount,
    String? searchQuery,
    bool clearSearch = false,
  }) {
    return CustomersState(
      isLoading: isLoading ?? this.isLoading,
      error: error,
      customers: customers ?? this.customers,
      totalCount: totalCount ?? this.totalCount,
      searchQuery: clearSearch ? null : (searchQuery ?? this.searchQuery),
    );
  }
}

/// Customers provider
class CustomersNotifier extends Notifier<CustomersState> {
  late CustomersRepository _repository;

  @override
  CustomersState build() {
    _repository = ref.read(customersRepositoryProvider);
    return const CustomersState();
  }

  Future<void> loadCustomers({int first = 0, int max = 50}) async {
    state = state.copyWith(isLoading: true, error: null);

    try {
      final customers = await _repository.getCustomers(
        first: first,
        max: max,
        search: state.searchQuery,
        excludeRole: 'Admin,Owner,Cashier', // Staff accounts are not customers
      );

      state = state.copyWith(
        isLoading: false,
        customers: customers,
        totalCount: customers.length,
      );
    } catch (e) {
      debugPrint('Failed to load customers: $e');
      state = state.copyWith(isLoading: false);
    }
  }

  void setSearchQuery(String? query) {
    if (query == null || query.isEmpty) {
      state = state.copyWith(clearSearch: true);
    } else {
      state = state.copyWith(searchQuery: query);
    }
    loadCustomers();
  }

  Future<Customer?> getCustomer(String customerId) async {
    try {
      return await _repository.getCustomer(customerId);
    } catch (e) {
      return null;
    }
  }

  Future<bool> updateCustomerProfile(String customerId, String name, String phoneNumber) async {
    try {
      await _repository.updateCustomerProfile(customerId, name, phoneNumber);
      // Reload customers to reflect the changes
      await loadCustomers();
      return true;
    } catch (e) {
      debugPrint('Failed to update customer profile: $e');
      return false;
    }
  }

  Future<bool> resetCustomerPassword(String customerId, String newPassword) async {
    try {
      await _repository.resetCustomerPassword(customerId, newPassword);
      return true;
    } catch (e) {
      debugPrint('Failed to reset customer password: $e');
      return false;
    }
  }

  Future<bool> toggleCustomerEnabled(String customerId) async {
    try {
      await _repository.toggleCustomerEnabled(customerId);
      await loadCustomers();
      return true;
    } catch (e) {
      debugPrint('Failed to toggle customer enabled: $e');
      return false;
    }
  }
}

/// Customers provider
final customersProvider =
    NotifierProvider<CustomersNotifier, CustomersState>(CustomersNotifier.new);

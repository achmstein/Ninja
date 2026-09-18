import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../../../core/providers/branch_provider.dart';
import '../../../core/utils/business_day.dart';
import '../../receipts/services/receipt_service.dart';
import '../models/bill.dart';

/// How far back the bills reach. One read, no paging: a regular's three
/// months of bills is a short list.
const _historyDays = 90;

/// An open bill is re-read now and then: a friend's round landing on the
/// same bill sends this phone no event.
const _openBillRefresh = Duration(seconds: 30);

class BillsRepository {
  final ApiClient _apiClient;

  BillsRepository(this._apiClient);

  /// Every ticket the customer is on: open ones whatever their age, and
  /// those closed since [since]
  Future<List<Bill>> getMyBills({required DateTime since}) async {
    final response = await _apiClient.get<List<dynamic>>(
      'mine',
      queryParameters: {'since': since.toUtc().toIso8601String()},
    );
    return (response.data ?? const [])
        .map((e) => Bill.fromJson(e as Map<String, dynamic>))
        .toList();
  }
}

final billsRepositoryProvider = Provider<BillsRepository>(
  (ref) => BillsRepository(ref.read(ticketsApiProvider)),
);

/// The customer's bills: open ones first, then closed ones newest first,
/// as Sales orders them
final myBillsProvider = NotifierProvider<MyBillsNotifier, AsyncValue<List<Bill>>>(MyBillsNotifier.new);

class MyBillsNotifier extends Notifier<AsyncValue<List<Bill>>> {
  Timer? _timer;

  @override
  AsyncValue<List<Bill>> build() {
    // The window is the branch's business day, so a branch switch re-reads
    ref.watch(selectedBranchIdProvider);
    ref.onDispose(() => _timer?.cancel());
    _load();
    return const AsyncValue.loading();
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) state = const AsyncValue.loading();
    final branch = ref.read(branchProvider).selectedBranch;
    final since = businessDayStart(branch).subtract(const Duration(days: _historyDays));
    try {
      final bills = await ref.read(billsRepositoryProvider).getMyBills(since: since);
      state = AsyncValue.data(bills);
      _schedule(bills);
    } catch (e, st) {
      if (!silent) state = AsyncValue.error(e, st);
    }
  }

  void _schedule(List<Bill> bills) {
    _timer?.cancel();
    if (bills.any((bill) => bill.isOpen)) {
      _timer = Timer(_openBillRefresh, refresh);
    }
  }

  /// Silent: the list updates in place
  Future<void> refresh() => _load(silent: true);

  /// With the loading state, for the retry button
  Future<void> reload() => _load();
}

/// A minute clock: a running time line only needs the minute
final minuteClockProvider = StreamProvider<DateTime>(
  (ref) => Stream.periodic(const Duration(minutes: 1), (_) => DateTime.now()),
);

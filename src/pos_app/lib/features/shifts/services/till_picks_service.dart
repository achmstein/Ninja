import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/models/localized_text.dart';
import '../../../core/models/money.dart';
import '../../../core/network/api_client.dart';

/// One entry of a pay-out picker: an employee, a supplier, a partner or an
/// expense category. [balance] is what the café owes the person or supplier
/// right now — a hint beside the name, never the amount itself: the cashier
/// still keys what actually changes hands. Null where it is nobody's
/// business at the counter (a monthly employee's salary) or meaningless (a
/// partner, a category).
class TillPick {
  final int id;
  final LocalizedText name;
  final double? balance;

  const TillPick({required this.id, required this.name, this.balance});

  TillPick.named(this.id, String name, {this.balance}) : name = LocalizedText.fromString(name);
}

/// The lists behind the pay-out dialog's pickers: Payroll's employees for a
/// wage or an advance, Finance's suppliers, partners and expense categories.
/// Each is the one thing the till reads from that service, under the Pos
/// policy, so nothing here is cached — a list is fetched when its kind is
/// picked.
abstract class TillPicksRepository {
  Future<List<TillPick>> employees();
  Future<List<TillPick>> suppliers();
  Future<List<TillPick>> partners();
  Future<List<TillPick>> categories();
}

class ApiTillPicksRepository implements TillPicksRepository {
  final ApiClient _payroll;
  final ApiClient _finance;

  ApiTillPicksRepository(this._payroll, this._finance);

  @override
  Future<List<TillPick>> employees() async {
    final response = await _payroll.get<List<dynamic>>('till/employees');
    return [
      for (final e in response.data ?? const [])
        TillPick.named(
          toInt(e['id']),
          e['name'] as String? ?? '',
          balance: e['balance'] == null ? null : toNumber(e['balance']),
        ),
    ];
  }

  @override
  Future<List<TillPick>> suppliers() async {
    final response = await _finance.get<List<dynamic>>('till/suppliers');
    return [
      for (final s in response.data ?? const [])
        TillPick.named(toInt(s['id']), s['name'] as String? ?? '', balance: toNumber(s['balance'])),
    ];
  }

  @override
  Future<List<TillPick>> partners() async {
    final response = await _finance.get<List<dynamic>>('till/partners');
    return [
      for (final p in response.data ?? const []) TillPick.named(toInt(p['id']), p['name'] as String? ?? ''),
    ];
  }

  @override
  Future<List<TillPick>> categories() async {
    final response = await _finance.get<List<dynamic>>('till/categories');
    return [
      for (final c in response.data ?? const []) TillPick(id: toInt(c['id']), name: LocalizedText.parse(c['name'])),
    ];
  }
}

final tillPicksRepositoryProvider = Provider<TillPicksRepository>((ref) {
  return ApiTillPicksRepository(ref.read(payrollApiProvider), ref.read(financeApiProvider));
});

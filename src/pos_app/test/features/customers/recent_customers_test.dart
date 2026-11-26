import 'package:flutter_test/flutter_test.dart';
import 'package:pos_app/features/customers/recent_customers.dart';
import 'package:pos_app/features/sale/models/sale_line.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  test('nobody was picked yet', () async {
    expect(await readRecentCustomers(), isEmpty);
  });

  test('the last five accounts picked, newest first, each once', () async {
    for (var i = 1; i <= 6; i++) {
      await rememberRecentCustomer(SaleCustomer(id: 'c$i', name: 'Customer $i'));
    }
    await rememberRecentCustomer(const SaleCustomer(id: 'c4', name: 'Customer 4'));

    final recent = await readRecentCustomers();
    expect(recent.map((c) => c.id), ['c4', 'c6', 'c5', 'c3', 'c2']);
    expect(recent.first.name, 'Customer 4');
  });

  test('a bare name is nobody to find again', () async {
    await rememberRecentCustomer(const SaleCustomer(name: 'Walk-in'));
    expect(await readRecentCustomers(), isEmpty);
  });

  test('what cannot be read is nothing', () async {
    SharedPreferences.setMockInitialValues({'pos.recentCustomers': 'not json'});
    expect(await readRecentCustomers(), isEmpty);
  });
}

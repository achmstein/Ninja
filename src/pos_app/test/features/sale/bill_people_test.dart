import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ninja_app_core/models/localized_text.dart';
import 'package:pos_app/features/sale/bill_people.dart';
import 'package:pos_app/features/sale/bill_route.dart';
import 'package:pos_app/features/sale/models/sale_line.dart';
import 'package:pos_app/features/sale/providers/sale_provider.dart';
import 'package:pos_app/features/tickets/models/enums.dart';
import 'package:pos_app/features/tickets/models/pricing.dart';
import 'package:pos_app/features/tickets/models/ticket_detail.dart';
import 'package:shared_preferences/shared_preferences.dart';

SaleLine _line(int productId, {double price = 50, int quantity = 1}) =>
    SaleLine(productId: productId, nameEn: 'Item $productId', nameAr: null, price: price, quantity: quantity);

TicketLineView _sent(int id, String item, {double total = 50, String? customerId, String? customerName, bool paid = false}) =>
    TicketLineView(
      id: id,
      orderId: id,
      description: LocalizedText(en: item),
      qty: 1,
      unitPrice: total,
      total: total,
      customerId: customerId,
      customerName: customerName,
      paid: paid,
    );

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('who the bill knows', () {
    test('the room\'s people first, then whoever earlier rounds were for, then anyone named since, each once', () {
      final people = billPeople(
        [(id: 'a', name: 'Mona Adel'), (id: 'b', name: 'Karim Mostafa')],
        [
          _sent(1, 'Latte', customerId: 'b', customerName: 'Karim Mostafa'),
          _sent(2, 'Tea', customerId: 'c', customerName: 'Omar Hassan'),
          // A name the till was only told
          _sent(3, 'Cola', customerName: 'Uncle Sami'),
          _sent(4, 'Water', customerName: 'Uncle Sami'),
          // Nobody's: the table's own
          _sent(5, 'Juice'),
        ],
        [
          const SaleCustomer(id: 'a', name: 'Mona Adel'),
          const SaleCustomer(id: 'd', name: 'Nour Ali'),
          const SaleCustomer(name: 'Uncle Sami'),
        ],
      );

      expect([for (final p in people) p.id], ['a', 'b', 'c', null, 'd']);
      expect([for (final p in people) p.name], ['Mona Adel', 'Karim Mostafa', 'Omar Hassan', 'Uncle Sami', 'Nour Ali']);
    });

    test('a bill with nobody on it knows nobody', () {
      expect(billPeople(const [], [_sent(1, 'Latte')]), isEmpty);
    });

    test('an account is one person whatever it is called; two bare names are one only when they match', () {
      expect(samePerson(const SaleCustomer(id: 'a', name: 'Mona'), const SaleCustomer(id: 'a', name: 'Mona Adel')), isTrue);
      expect(samePerson(const SaleCustomer(id: 'a', name: 'Mona'), const SaleCustomer(name: 'Mona')), isFalse);
      expect(samePerson(const SaleCustomer(name: ' Sami '), const SaleCustomer(name: 'Sami')), isTrue);
      expect(samePerson(const SaleCustomer(name: 'Sami'), const SaleCustomer(name: 'Samy')), isFalse);
      expect(samePerson(null, const SaleCustomer(name: 'Sami')), isFalse);
    });
  });

  group('what was sent, as the order lists it', () {
    test('the same item for the same person is one line; another person\'s stays their own', () {
      final shown = sentLinesByPerson([
        _sent(1, 'Latte', customerId: 'a', customerName: 'Mona Adel'),
        _sent(2, 'Latte', customerId: 'b', customerName: 'Karim Mostafa'),
        _sent(3, 'Latte', customerId: 'a', customerName: 'Mona Adel'),
        _sent(4, 'Latte'),
        _sent(5, 'Tea', customerId: 'a', customerName: 'Mona Adel'),
      ]);

      expect(
        [for (final one in shown) (one.line.description?.en, one.line.qty, one.line.customerName)],
        [('Latte', 2.0, 'Mona Adel'), ('Tea', 1.0, 'Mona Adel'), ('Latte', 1.0, 'Karim Mostafa'), ('Latte', 1.0, null)],
      );
      expect(shown.first.line.total, 100);
    });

    test('what a part payment paid for stays apart from what is still to pay', () {
      final shown = sentLinesByPerson([
        _sent(1, 'Latte', customerId: 'a', customerName: 'Mona Adel', paid: true),
        _sent(2, 'Latte', customerId: 'a', customerName: 'Mona Adel'),
      ]);

      expect([for (final one in shown) (one.line.qty, one.paid)], [(1.0, true), (1.0, false)]);
    });
  });

  group('the total with what is new', () {
    const bill = TicketDetail(
      id: 1,
      type: TicketType.table,
      lines: [TicketLineView(id: 1, total: 100)],
      serviceChargeRate: 0.12,
      vatRate: 0.14,
    );

    test('is the whole bill: what is on it, what is on its way and what is new, with their service and VAT', () {
      final onTheirWay = saleTotal([_line(1, price: 30)]);
      final fresh = saleTotal([_line(2, price: 20, quantity: 2), _line(3, price: 10)]);

      // 100 + 30 + 50 = 180, served: 21.60 service, then 14% on 201.60
      expect(totalWith(bill, onTheirWay + fresh), closeTo(229.82, 0.005));
    });

    test('is the bill as the server has it once nothing is new', () {
      expect(totalWith(bill, 0), closeTo(127.68, 0.005));
    });
  });

  group('sending a part of a round', () {
    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      await initializeSale();
    });

    test('what is new goes person by person, in the order they first appear', () {
      const ahmed = SaleCustomer(id: 'a', name: 'Ahmed');
      const omar = SaleCustomer(name: 'Omar');
      final lines = [_line(1).forWho(ahmed), _line(2), _line(2).forWho(omar), _line(3).forWho(ahmed), _line(3)];

      final rounds = roundsByPerson(lines);
      expect([for (final round in rounds) '${round.who?.name}: ${[for (final l in round.lines) l.productId]}'],
          ['Ahmed: [1, 3]', 'null: [2, 3]', 'Omar: [2]']);
      // The same item for two people is two lines; nobody's is the line it always was
      expect(_line(2).forWho(omar).key, isNot(_line(2).key));
      expect(_line(2).forWho(omar).key, isNot(_line(2).forWho(ahmed).key));
      expect(SaleLine.fromJson(_line(1).forWho(ahmed).toJson()).who?.id, 'a');
      expect(SaleLine.fromJson(_line(1).toJson()).key, _line(1).key);
    });

    test('only what was sent leaves the sale; the rest and the note stay for the next name', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final sale = container.read(saleProvider.notifier);
      sale.setTarget(7);
      sale.add(_line(1, quantity: 2));
      sale.add(_line(2));
      sale.add(_line(3));
      sale.setNote('No ice');

      sale.removeLines([_line(1).key, _line(3).key]);

      final state = container.read(saleProvider);
      expect([for (final l in state.lines) l.productId], [2]);
      expect(state.note, 'No ice');
      expect(state.target, 7, reason: 'still this bill\'s order');
    });

    test('the note was the round\'s: it goes with the last of it', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final sale = container.read(saleProvider.notifier);
      sale.setTarget(7);
      sale.add(_line(1));
      sale.setNote('No ice');

      sale.removeLines([_line(1).key]);

      final state = container.read(saleProvider);
      expect(state.lines, isEmpty);
      expect(state.note, '');
      expect(state.target, 7);
    });

    test('a line that is not on the sale takes nothing off it', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final sale = container.read(saleProvider.notifier);
      sale.add(_line(1));

      sale.removeLines([_line(9).key]);

      expect(container.read(saleProvider).lines, hasLength(1));
    });
  });

  group('where a bill opens', () {
    test('a table\'s, a room\'s or a tab\'s is the order screen', () {
      expect(billRoute(12), '/order/12');
      expect(billRoute(12, label: 'Mona Adel'), '/order/12');
      // A tab named like a number is still a tab
      expect(billRoute(12, label: '#7up'), '/order/12');
    });

    test('a delivery\'s bill, never added to, opens on its own page', () {
      expect(billRoute(12, label: '#42 · Mona'), '/ticket/12');
      expect(billRoute(12, label: '#42'), '/ticket/12');
      expect(isDeliveryBill(' #42 · '), isTrue);
      expect(isDeliveryBill(null), isFalse);
    });
  });

  test('the names over the order are first names, and more only for people who share one', () {
    expect(shortNames(['Mohamed Abdelrahman Elsayed', 'Karim Mostafa', 'منى عادل']), ['Mohamed', 'Karim', 'منى']);
    expect(shortNames(['Mohamed Abdelrahman Elsayed', 'Mohamed Ali', 'Karim Mostafa']), ['Mohamed Abdelrahman', 'Mohamed Ali', 'Karim']);
    expect(shortNames(['Mohamed Ali Hassan', 'Mohamed Ali Omar', ' Sara ']), ['Mohamed Ali Hassan', 'Mohamed Ali Omar', 'Sara']);
    expect(shortNames(['', 'Omar']), ['', 'Omar']);
  });
}

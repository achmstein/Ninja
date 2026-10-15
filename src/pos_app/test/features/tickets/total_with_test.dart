import 'package:flutter_test/flutter_test.dart';
import 'package:pos_app/features/tickets/models/enums.dart';
import 'package:pos_app/features/tickets/models/pricing.dart';
import 'package:pos_app/features/tickets/models/ticket_detail.dart';

TicketDetail _ticket({
  TicketType type = TicketType.table,
  List<TicketLineView> lines = const [TicketLineView(id: 1, total: 100)],
  double discount = 0,
  double? discountRate,
  double serviceChargeRate = 0,
  double vatRate = 0,
  bool vatIncluded = false,
}) =>
    TicketDetail(
      id: 1,
      type: type,
      lines: lines,
      discount: discount,
      discountRate: discountRate,
      serviceChargeRate: serviceChargeRate,
      vatRate: vatRate,
      vatIncluded: vatIncluded,
    );

// The same arithmetic as Sales' Ticket.ComputeBill and pos_web's totalWith:
// the total the till shows while lines are on their way must be the one the
// server lands on
void main() {
  test('is the bill as it stands with nothing on its way', () {
    expect(totalWith(_ticket(vatRate: 0.14), 0), closeTo(114, 1e-9));
  });

  test('adds the new lines with their service and VAT on a served bill', () {
    // 150 menu money, 12% service = 18, VAT 14% of 168 = 23.52
    expect(totalWith(_ticket(serviceChargeRate: 0.12, vatRate: 0.14), 50), closeTo(191.52, 1e-9));
  });

  test('charges no service at the counter', () {
    expect(totalWith(_ticket(type: TicketType.counter, serviceChargeRate: 0.12), 50), 150);
  });

  test('takes a percent discount off the new lines too', () {
    expect(totalWith(_ticket(discountRate: 0.1, discount: 10), 100), 180);
  });

  test('keeps a fixed discount as it was', () {
    expect(totalWith(_ticket(discount: 30), 100), 170);
  });

  test('leaves VAT inside prices that already hold it', () {
    expect(totalWith(_ticket(vatRate: 0.14, vatIncluded: true), 50), 150);
  });

  test('charges no service on room time', () {
    final room = _ticket(
      type: TicketType.room,
      serviceChargeRate: 0.1,
      lines: const [
        TicketLineView(id: 1, source: 'SessionTime', total: 200),
        TicketLineView(id: 2, total: 100),
      ],
    );
    // Served: 100 + 50 new → 15 service
    expect(totalWith(room, 50), 365);
  });
}

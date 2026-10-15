import '../../../core/models/money.dart';
import 'enums.dart';
import 'ticket_detail.dart';

/// The branch's money rules (Sales `PricingView`): VAT, whether menu prices
/// already hold it, and the service charge on served orders.
class PricingView {
  final double vatRate;
  final bool pricesIncludeVat;
  final double serviceChargeRate;

  const PricingView({this.vatRate = 0, this.pricesIncludeVat = false, this.serviceChargeRate = 0});

  factory PricingView.fromJson(Map<String, dynamic> json) => PricingView(
        vatRate: toNumber(json['vatRate']),
        pricesIncludeVat: json['pricesIncludeVat'] as bool? ?? false,
        serviceChargeRate: toNumber(json['serviceChargeRate']),
      );

  Map<String, dynamic> toJson() => {
        'vatRate': vatRate,
        'pricesIncludeVat': pricesIncludeVat,
        'serviceChargeRate': serviceChargeRate,
      };
}

/// The bill of a counter sale under these rules — the same arithmetic as
/// `Ticket.ComputeBill` in Sales: a counter sale is not served, so no
/// service charge; VAT is shown out of a price that already holds it, or
/// added on top.
({double subtotal, double serviceCharge, double vat, double total}) counterBill(double subtotal, PricingView rules) {
  double money(double v) => (v * 100).roundToDouble() / 100;
  final taxable = subtotal;
  final vat = rules.pricesIncludeVat ? money(taxable - taxable / (1 + rules.vatRate)) : money(taxable * rules.vatRate);
  final total = rules.pricesIncludeVat ? taxable : taxable + vat;
  return (subtotal: subtotal, serviceCharge: 0, vat: vat, total: total);
}

/// What an open bill comes to once lines still on their way land on it: the
/// same arithmetic as `Ticket.ComputeBill` in Sales, under the rules the bill
/// was last priced by (its VAT, and its service charge where it is served).
/// The till shows this the moment the cashier charges; the server's own
/// figure replaces it once the lines are in.
double totalWith(TicketDetail ticket, double extra) {
  double money(double v) => (v * 100).roundToDouble() / 100;
  final lines = ticket.lines;
  final subtotal = lines.fold<double>(0, (sum, l) => sum + l.total) + extra;

  // A percent follows the lines as they land; a fixed amount never exceeds what is there
  final rate = ticket.discountRate;
  final discount = subtotal <= 0
      ? 0.0
      : rate != null
          ? money(subtotal * rate)
          : (ticket.discount < subtotal ? ticket.discount : subtotal);
  final discounted = subtotal - discount;

  // Service is for being served: a counter sale is not, and room time is not an order
  var served = ticket.type == TicketType.counter
      ? 0.0
      : lines.where((l) => l.source != 'SessionTime').fold<double>(0, (sum, l) => sum + l.total) + extra;
  if (subtotal > 0) served *= discounted / subtotal;
  final service = money((served < 0 ? 0 : served) * ticket.serviceChargeRate);

  final taxable = discounted + service;
  return ticket.vatIncluded ? taxable : taxable + money(taxable * ticket.vatRate);
}

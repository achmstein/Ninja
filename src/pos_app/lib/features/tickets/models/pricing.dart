import '../../../core/models/money.dart';

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

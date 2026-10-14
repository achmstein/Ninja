import 'package:ninja_printing/ninja_printing.dart';
import '../../features/sale/models/sale_line.dart';
import 'offline_sale.dart';

/// A sale rung up offline as the kitchen reads it. The server makes the
/// kitchen's tickets, and it cannot be reached, so the till prints this one
/// itself: one chit for the whole sale (no stations to split it between),
/// headed [title], numbered with the till's provisional number, nothing
/// about money. The replay sends nothing to the kitchen, so it never
/// prints twice.
KitchenTicket offlineKitchenTicket(OfflineSale sale, {required String title}) => KitchenTicket(
      jobId: 0,
      stationId: 0,
      stationName: TicketText(title),
      createdAt: sale.placedAt,
      confirmedAt: sale.placedAt,
      numberLabel: sale.provisionalReceiptNumber,
      source: 'Pos',
      customerName: sale.customer?.name,
      customerNote: sale.note.trim().isEmpty ? null : sale.note.trim(),
      lines: [
        for (final line in sale.lines)
          KitchenTicketLine(
            name: TicketText(line.nameEn ?? '', line.nameAr),
            units: line.quantity,
            customizations: _customizations(line.customizations),
            instructions: line.specialInstructions == null || line.specialInstructions!.trim().isEmpty
                ? null
                : line.specialInstructions!.trim(),
          ),
      ],
    );

/// "Size: Large, Milk: Oat" in each language, as the server writes it
TicketText? _customizations(List<SaleCustomization> picked) {
  if (picked.isEmpty) return null;
  String side(String Function(SaleCustomization) group, String Function(SaleCustomization) option) =>
      [for (final c in picked) '${group(c)}: ${option(c)}'].join(', ');
  return TicketText(
    side((c) => c.customizationName.inLanguage('en'), (c) => c.optionName.inLanguage('en')),
    side((c) => c.customizationName.inLanguage('ar'), (c) => c.optionName.inLanguage('ar')),
  );
}

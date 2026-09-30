import '../catalog/models/catalog_item.dart';
import 'models/sale_line.dart';

/// What the till offers after a dish is rung up: what it goes well with, in
/// the business's order, only what this branch sells right now and nothing
/// already on the sale.
List<CatalogItem> tillSuggestions(CatalogItem? last, List<CatalogItem> items, List<SaleLine> lines) {
  if (last == null || lines.isEmpty) return const [];
  final byId = {for (final item in items) item.id: item};
  final onSale = {for (final line in lines) line.productId};
  return [
    for (final id in last.pairedItemIds)
      if (byId[id] case final item?)
        if (item.isAvailable && item.id != last.id && !onSale.contains(item.id)) item,
  ];
}

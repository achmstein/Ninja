import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/models/money.dart';
import '../../../core/network/api_client.dart';
import '../models/sale_line.dart';

/// One line of another branch's answer (`POST /api/catalog/price-check`):
/// what it costs there now, options in, and what it ran out of
class PriceCheckResult {
  final int itemId;
  final double price;
  final bool available;
  final bool outOfStock;
  final List<int> soldOutOptionIds;

  /// It can be sold there, at a price that differs from the one sent
  final bool changed;

  const PriceCheckResult({
    required this.itemId,
    required this.price,
    this.available = true,
    this.outOfStock = false,
    this.soldOutOptionIds = const [],
    this.changed = false,
  });

  factory PriceCheckResult.fromJson(Map<String, dynamic> json) => PriceCheckResult(
        itemId: toInt(json['itemId']),
        price: toNumber(json['price']),
        available: json['available'] != false,
        outOfStock: json['outOfStock'] == true,
        soldOutOptionIds: [for (final id in (json['soldOutOptionIds'] as List<dynamic>? ?? const <dynamic>[])) toInt(id)],
        changed: json['changed'] == true,
      );
}

enum PriceReviewKind { changed, soldOut, optionsOut }

/// One thing that differs at the other branch, as the review lists it
class PriceReviewItem {
  final PriceReviewKind kind;
  final SaleLine line;

  /// For [PriceReviewKind.changed]: the till's price and the other branch's
  final double from;
  final double to;

  /// For [PriceReviewKind.optionsOut]: the chosen options it ran out of
  final List<int> optionIds;

  const PriceReviewItem(this.kind, this.line, {this.from = 0, this.to = 0, this.optionIds = const []});
}

/// The cart as the other branch would make it: what differs there, and the
/// lines to send at its prices with what it cannot make taken off
class PriceReview {
  final List<PriceReviewItem> items;
  final List<SaleLine> lines;

  const PriceReview({required this.items, required this.lines});

  /// The cart goes as it is
  bool get agrees => items.isEmpty;
}

/// The cart's lines as the check reads them: each at its price with its
/// options, the unit price the order carries
List<Map<String, dynamic>> priceCheckLines(List<SaleLine> lines) => [
      for (final line in lines)
        {
          'itemId': line.productId,
          'optionIds': [for (final c in line.customizations) c.optionId],
          'unitPrice': line.price,
        },
    ];

/// Reads the other branch's answer against the cart, line by line (it comes
/// back in the order the lines were sent). A line it cannot make, the item or
/// one of its choices, is listed and left out; one it prices otherwise is
/// listed and sent at its price.
PriceReview reviewPriceCheck(List<SaleLine> lines, List<PriceCheckResult> results) {
  final items = <PriceReviewItem>[];
  final kept = <SaleLine>[];
  for (final (i, line) in lines.indexed) {
    final result = i < results.length ? results[i] : null;
    if (result == null || !result.available || result.outOfStock) {
      items.add(PriceReviewItem(PriceReviewKind.soldOut, line));
    } else if (result.soldOutOptionIds.isNotEmpty) {
      items.add(PriceReviewItem(PriceReviewKind.optionsOut, line, optionIds: result.soldOutOptionIds));
    } else if (result.changed) {
      items.add(PriceReviewItem(PriceReviewKind.changed, line, from: line.price, to: result.price));
      kept.add(line.withPrice(result.price));
    } else {
      kept.add(line);
    }
  }
  return PriceReview(items: items, lines: kept);
}

/// Asks Catalog what the cart costs at another branch now, and what it ran
/// out of, before the till sends a phone delivery there: the same pricing that
/// branch's order check uses, so an order sent at these prices goes through.
/// The branch is in the body: the till asks about a branch it does not work at.
class PriceCheckService {
  final ApiClient _catalog;

  PriceCheckService(this._catalog);

  Future<PriceReview> check(int branchId, List<SaleLine> lines) async {
    final response = await _catalog.post<Map<String, dynamic>>('price-check', data: {
      'branchId': branchId,
      'lines': priceCheckLines(lines),
    });
    final results = [
      for (final e in (response.data?['lines'] as List<dynamic>? ?? const <dynamic>[]))
        PriceCheckResult.fromJson((e as Map).cast<String, dynamic>()),
    ];
    return reviewPriceCheck(lines, results);
  }
}

final priceCheckServiceProvider = Provider<PriceCheckService>(
  (ref) => PriceCheckService(ref.read(catalogApiProvider)),
);

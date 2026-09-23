import '../../../core/models/localized_text.dart';

/// One line of an order, as the kitchen needs it: what and how many, plus
/// the customizations and instructions that change how it is made. No money.
class KitchenOrderItem {
  final LocalizedText productName;
  final int units;
  final LocalizedText? customizationsDescription;
  final String? specialInstructions;

  const KitchenOrderItem({
    required this.productName,
    required this.units,
    this.customizationsDescription,
    this.specialInstructions,
  });

  factory KitchenOrderItem.fromJson(Map<String, dynamic> json) => KitchenOrderItem(
        productName: LocalizedText.parse(json['productName']),
        units: readInt(json['units']),
        customizationsDescription: LocalizedText.parseNullable(json['customizationsDescription']),
        specialInstructions: _text(json['specialInstructions']),
      );
}

/// One station's share of an order, as the pass shows it: done once its
/// screen says so; a part that only prints is never marked.
class KitchenOrderPart {
  final int stationId;
  final LocalizedText stationName;
  final bool showsOnScreen;
  final DateTime? readyAt;

  const KitchenOrderPart({
    required this.stationId,
    required this.stationName,
    this.showsOnScreen = true,
    this.readyAt,
  });

  bool get isReady => readyAt != null;

  factory KitchenOrderPart.fromJson(Map<String, dynamic> json) => KitchenOrderPart(
        stationId: readInt(json['stationId']),
        stationName: LocalizedText.parse(json['stationName']),
        showsOnScreen: json['showsOnScreen'] != false,
        readyAt: readUtc(json['readyAt']),
      );
}

/// An order in the kitchen: `GET /api/orders/kitchen` returns the confirmed
/// orders of the last day, oldest first. `readyAt` is the kitchen state —
/// null while it is on the board, set once it is done. On a station's
/// screen it is that station's part; on the pass, the whole order.
class KitchenOrder {
  final int orderNumber;
  final DateTime date;
  final DateTime? confirmedAt;
  final DateTime? readyAt;

  /// Who placed it: Customer, Guest or Pos
  final String source;
  /// The place it was ordered from; kind 'Room', 'Table' or 'Station'
  final String? placeKind;
  final LocalizedText? placeName;
  final String? customerName;
  final String? customerNote;
  final List<KitchenOrderItem> items;

  /// The stations the order is split between; empty on orders from before stations
  final List<KitchenOrderPart> parts;

  const KitchenOrder({
    required this.orderNumber,
    required this.date,
    this.confirmedAt,
    this.readyAt,
    this.source = 'Customer',
    this.placeKind,
    this.placeName,
    this.customerName,
    this.customerNote,
    this.items = const [],
    this.parts = const [],
  });

  /// The clock runs from confirmation — the moment the order reached the kitchen
  DateTime get since => confirmedAt ?? date;
  bool get isPos => source == 'Pos';
  bool get isReady => readyAt != null;

  /// The same order marked ready at [readyAt], or back on the board for null
  KitchenOrder withReadyAt(DateTime? readyAt) => KitchenOrder(
        orderNumber: orderNumber,
        date: date,
        confirmedAt: confirmedAt,
        readyAt: readyAt,
        source: source,
        placeKind: placeKind,
        placeName: placeName,
        customerName: customerName,
        customerNote: customerNote,
        items: items,
        parts: parts,
      );

  factory KitchenOrder.fromJson(Map<String, dynamic> json) => KitchenOrder(
        orderNumber: readInt(json['orderNumber']),
        date: readUtc(json['date']) ?? DateTime.now().toUtc(),
        confirmedAt: readUtc(json['confirmedAt']),
        readyAt: readUtc(json['readyAt']),
        source: _text(json['source']) ?? 'Customer',
        placeKind: json['placeKind'] as String?,
        placeName: LocalizedText.parseNullable(json['placeName']),
        customerName: _text(json['customerName']),
        customerNote: _text(json['customerNote']),
        items: [
          for (final item in (json['items'] as List<dynamic>? ?? const [])) KitchenOrderItem.fromJson(item as Map<String, dynamic>),
        ],
        parts: [
          for (final part in (json['parts'] as List<dynamic>? ?? const [])) KitchenOrderPart.fromJson(part as Map<String, dynamic>),
        ],
      );
}

/// Numbers come as `number | string` on this API
int readInt(Object? value) => value is num ? value.toInt() : int.tryParse('$value') ?? 0;

/// Timestamps are UTC on the wire. One without a zone designator would parse
/// as local time and skew every clock on the board by the timezone offset,
/// so it is read as UTC too.
DateTime? readUtc(Object? value) {
  if (value is! String || value.isEmpty) return null;
  final parsed = DateTime.tryParse(value);
  if (parsed == null) return null;
  if (parsed.isUtc) return parsed;
  return DateTime.utc(parsed.year, parsed.month, parsed.day, parsed.hour, parsed.minute, parsed.second, parsed.millisecond, parsed.microsecond);
}

String? _text(Object? value) {
  final text = value?.toString();
  return text == null || text.isEmpty ? null : text;
}

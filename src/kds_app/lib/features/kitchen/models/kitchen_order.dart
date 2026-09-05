import '../../../core/models/localized_text.dart';

/// Where an order is in the kitchen — the wire names are Ordering's
/// `PreparationStatus` enum, and the three lanes of the board.
enum PreparationStatus {
  notStarted('NotStarted'),
  preparing('Preparing'),
  ready('Ready');

  final String wire;
  const PreparationStatus(this.wire);

  /// Unknown or missing reads as New, like kds_web's `preparation ?? 'NotStarted'`
  static PreparationStatus parse(Object? value) {
    final text = value?.toString().toLowerCase();
    return values.firstWhere((s) => s.wire.toLowerCase() == text, orElse: () => notStarted);
  }
}

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

/// An order on the board: `GET /api/orders/kitchen` returns confirmed
/// orders of the last day (Ready ones linger half an hour), oldest first.
class KitchenOrder {
  final int orderNumber;
  final DateTime date;
  final DateTime? confirmedAt;
  final PreparationStatus preparation;
  final DateTime? preparingAt;
  final DateTime? readyAt;

  /// Who placed it: Customer, Guest or Pos
  final String source;
  final LocalizedText? roomName;
  final LocalizedText? tableName;
  final String? customerName;
  final String? customerNote;
  final List<KitchenOrderItem> items;

  const KitchenOrder({
    required this.orderNumber,
    required this.date,
    this.confirmedAt,
    this.preparation = PreparationStatus.notStarted,
    this.preparingAt,
    this.readyAt,
    this.source = 'Customer',
    this.roomName,
    this.tableName,
    this.customerName,
    this.customerNote,
    this.items = const [],
  });

  /// The clock runs from confirmation — the moment the order reached the kitchen
  DateTime get since => confirmedAt ?? date;
  bool get isPos => source == 'Pos';
  bool get isReady => preparation == PreparationStatus.ready;

  KitchenOrder copyWith({
    PreparationStatus? preparation,
    DateTime? preparingAt,
    DateTime? readyAt,
    bool clearReadyAt = false,
  }) =>
      KitchenOrder(
        orderNumber: orderNumber,
        date: date,
        confirmedAt: confirmedAt,
        preparation: preparation ?? this.preparation,
        preparingAt: preparingAt ?? this.preparingAt,
        readyAt: clearReadyAt ? null : (readyAt ?? this.readyAt),
        source: source,
        roomName: roomName,
        tableName: tableName,
        customerName: customerName,
        customerNote: customerNote,
        items: items,
      );

  factory KitchenOrder.fromJson(Map<String, dynamic> json) => KitchenOrder(
        orderNumber: readInt(json['orderNumber']),
        date: readUtc(json['date']) ?? DateTime.now().toUtc(),
        confirmedAt: readUtc(json['confirmedAt']),
        preparation: PreparationStatus.parse(json['preparation']),
        preparingAt: readUtc(json['preparingAt']),
        readyAt: readUtc(json['readyAt']),
        source: _text(json['source']) ?? 'Customer',
        roomName: LocalizedText.parseNullable(json['roomName']),
        tableName: LocalizedText.parseNullable(json['tableName']),
        customerName: _text(json['customerName']),
        customerNote: _text(json['customerNote']),
        items: [
          for (final item in (json['items'] as List<dynamic>? ?? const [])) KitchenOrderItem.fromJson(item as Map<String, dynamic>),
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

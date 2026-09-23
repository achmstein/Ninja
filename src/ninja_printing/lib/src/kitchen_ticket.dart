/// Text the API sends in both languages, `{en, ar}`; [pick] reads the one a
/// ticket prints in, falling back to English.
class TicketText {
  final String en;
  final String? ar;

  const TicketText(this.en, [this.ar]);

  static TicketText? parse(Object? json) {
    if (json is! Map) return null;
    final en = json['en']?.toString() ?? '';
    final ar = json['ar']?.toString();
    if (en.isEmpty && (ar == null || ar.isEmpty)) return null;
    return TicketText(en, ar == null || ar.isEmpty ? null : ar);
  }

  String pick(String languageCode) => languageCode == 'ar' && ar != null ? ar! : (en.isNotEmpty ? en : ar ?? '');
}

/// One line of a kitchen ticket: how many of what, and how to make it.
class KitchenTicketLine {
  final TicketText name;
  final int units;
  final TicketText? customizations;
  final String? instructions;

  const KitchenTicketLine({required this.name, required this.units, this.customizations, this.instructions});

  factory KitchenTicketLine.fromJson(Map<String, dynamic> json) => KitchenTicketLine(
        name: TicketText.parse(json['productName']) ?? const TicketText(''),
        units: _int(json['units']),
        customizations: TicketText.parse(json['customizationsDescription']),
        instructions: _text(json['specialInstructions']),
      );
}

/// A ticket waiting for a kitchen printer, as `GET /api/kitchen/print-jobs`
/// gives it: where the printer is, and a station's part of an order (or a
/// test page, with no order at all).
class KitchenTicket {
  final int jobId;
  final int stationId;
  final TicketText stationName;
  final String? printerHost;
  final int printerPort;
  final DateTime createdAt;

  /// A device is printing it now, when this is recent
  final DateTime? claimedAt;
  final int attempts;
  final String? lastError;
  final bool isReprint;
  final bool isTest;
  final int? orderNumber;
  final DateTime? confirmedAt;

  /// Who placed it: Customer, Guest or Pos
  final String? source;
  final String? placeKind;
  final TicketText? placeName;
  final String? customerName;
  final String? customerNote;
  final List<KitchenTicketLine> lines;

  const KitchenTicket({
    required this.jobId,
    required this.stationId,
    required this.stationName,
    required this.createdAt,
    this.printerHost,
    this.printerPort = 9100,
    this.claimedAt,
    this.attempts = 0,
    this.lastError,
    this.isReprint = false,
    this.isTest = false,
    this.orderNumber,
    this.confirmedAt,
    this.source,
    this.placeKind,
    this.placeName,
    this.customerName,
    this.customerNote,
    this.lines = const [],
  });

  /// The server lets a claim go after a minute; until then another device has it
  static const claimTimeout = Duration(seconds: 60);

  bool claimedByAnother(DateTime now) => claimedAt != null && now.difference(claimedAt!) < claimTimeout;

  factory KitchenTicket.fromJson(Map<String, dynamic> json) => KitchenTicket(
        jobId: _int(json['jobId']),
        stationId: _int(json['stationId']),
        stationName: TicketText.parse(json['stationName']) ?? const TicketText(''),
        printerHost: _text(json['printerHost']),
        printerPort: json['printerPort'] == null ? 9100 : _int(json['printerPort']),
        createdAt: _utc(json['createdAt']) ?? DateTime.now().toUtc(),
        claimedAt: _utc(json['claimedAt']),
        attempts: _int(json['attempts']),
        lastError: _text(json['lastError']),
        isReprint: json['isReprint'] == true,
        isTest: json['isTest'] == true,
        orderNumber: json['orderNumber'] == null ? null : _int(json['orderNumber']),
        confirmedAt: _utc(json['confirmedAt']),
        source: _text(json['source']),
        placeKind: _text(json['placeKind']),
        placeName: TicketText.parse(json['placeName']),
        customerName: _text(json['customerName']),
        customerNote: _text(json['customerNote']),
        lines: [
          for (final line in (json['items'] as List<dynamic>? ?? const [])) KitchenTicketLine.fromJson(line as Map<String, dynamic>),
        ],
      );
}

/// Numbers come as `number | string` on this API
int _int(Object? value) => value is num ? value.toInt() : int.tryParse('$value') ?? 0;

String? _text(Object? value) {
  final text = value?.toString();
  return text == null || text.isEmpty ? null : text;
}

/// Timestamps are UTC on the wire, with or without the zone designator
DateTime? _utc(Object? value) {
  if (value is! String || value.isEmpty) return null;
  final parsed = DateTime.tryParse(value);
  if (parsed == null) return null;
  if (parsed.isUtc) return parsed;
  return DateTime.utc(parsed.year, parsed.month, parsed.day, parsed.hour, parsed.minute, parsed.second, parsed.millisecond, parsed.microsecond);
}

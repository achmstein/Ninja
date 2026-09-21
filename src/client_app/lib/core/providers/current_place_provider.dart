import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/localized_text.dart';
import 'branch_provider.dart';
import '../../features/places/models/place.dart';
import '../../features/places/services/place_service.dart';

// A new key: what was stored before the Places remodel carried the printed
// sticker's id, which is not the place id
const String _tableKey = 'current_place';

/// How long a scanned table stays attached to the customer. Long enough for a
/// sitting with several rounds, short enough that yesterday's scan never
/// mislabels today's order. Kept in step with client_web's table store.
const Duration tableTtl = Duration(hours: 3);

/// Cached value loaded before the app starts
CurrentPlace? _initialTable;

/// Call this before runApp() to preload the remembered table
Future<void> initializeCurrentPlace() async {
  final prefs = await SharedPreferences.getInstance();
  _initialTable = _decode(prefs.getString(_tableKey));
}

/// The place the customer scanned to order at: a table, or a timed place
/// they sat at without a clock running for them.
class CurrentPlace {
  /// The Spaces place id — what orders and requests name
  final int id;
  final PlaceKind kind;
  final LocalizedText name;
  final int branchId;

  /// Refreshed on each order, so a long sitting does not expire mid-visit.
  final DateTime scannedAt;

  const CurrentPlace({
    required this.id,
    this.kind = PlaceKind.table,
    required this.name,
    required this.branchId,
    required this.scannedAt,
  });

  bool get isFresh => DateTime.now().difference(scannedAt) < tableTtl;

  Map<String, dynamic> toJson() => {
        'id': id,
        'kind': kind.value,
        'nameEn': name.en,
        'nameAr': name.ar,
        'branchId': branchId,
        'scannedAt': scannedAt.millisecondsSinceEpoch,
      };

  CurrentPlace copyWith({DateTime? scannedAt}) => CurrentPlace(
        id: id,
        kind: kind,
        name: name,
        branchId: branchId,
        scannedAt: scannedAt ?? this.scannedAt,
      );
}

CurrentPlace? _decode(String? raw) {
  if (raw == null) return null;
  try {
    final json = jsonDecode(raw) as Map<String, dynamic>;
    return CurrentPlace(
      id: json['id'] as int,
      kind: PlaceKind.fromValue(json['kind'] as int?),
      name: LocalizedText(
        en: json['nameEn'] as String? ?? '',
        ar: json['nameAr'] as String?,
      ),
      branchId: json['branchId'] as int? ?? 1,
      scannedAt:
          DateTime.fromMillisecondsSinceEpoch(json['scannedAt'] as int? ?? 0),
    );
  } catch (_) {
    return null;
  }
}

class CurrentPlaceNotifier extends Notifier<CurrentPlace?> {
  @override
  CurrentPlace? build() => _initialTable;

  Future<void> setPlace(CurrentPlace table) async {
    state = table;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tableKey, jsonEncode(table.toJson()));
  }

  Future<void> clear() async {
    state = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tableKey);
  }

  /// Keep the table alive through a long sitting with several rounds
  Future<void> stampOrdered() async {
    final table = state;
    if (table == null) return;
    await setPlace(table.copyWith(scannedAt: DateTime.now()));
  }
}

final currentPlaceProvider =
    NotifierProvider<CurrentPlaceNotifier, CurrentPlace?>(
  CurrentPlaceNotifier.new,
);

/// The table the customer is at: the party the staff seated on their
/// reservation at a plain table (theirs until the staff clear it, as surely
/// as if they had scanned it), else the remembered table, while it is fresh
/// and belongs to the branch the customer is actually browsing.
final activePlaceProvider = Provider<CurrentPlace?>((ref) {
  final branchId = ref.watch(selectedBranchIdProvider);
  final seated = ref.watch(seatedReservationProvider);
  if (seated != null && seated.branchId == branchId) {
    return CurrentPlace(
      id: seated.placeId,
      kind: seated.placeKind,
      name: seated.placeName,
      branchId: seated.branchId,
      scannedAt: seated.seatedAt ?? DateTime.now(),
    );
  }
  final table = ref.watch(currentPlaceProvider);
  if (table == null || !table.isFresh) return null;
  return table.branchId == branchId ? table : null;
});

/// Where the next order will be delivered.
enum OrderDestinationKind {
  /// The customer's running clock: the order joins the stay's bill
  stay,

  /// A place they scanned to order at
  place,
}

/// The Spaces place the order goes to and, when a clock is running there for
/// the customer, the stay whose bill it joins.
class OrderDestination {
  final OrderDestinationKind kind;
  final int placeId;
  final PlaceKind placeKind;
  final LocalizedText name;

  /// Only set for a running clock
  final int? sessionId;

  const OrderDestination({
    required this.kind,
    required this.placeId,
    required this.placeKind,
    required this.name,
    this.sessionId,
  });

  bool get isStay => kind == OrderDestinationKind.stay;
}

/// A running clock beats a scanned table, and forgets it: moving to a room
/// means the customer left the table, so once the stay ends they have no
/// destination until they scan wherever they sit next. Keeping the old table
/// warm would risk sending food to a table they had already walked away from.
///
/// Mirrors useOrderDestination in the web client; every surface that shows or
/// sends the destination reads it from here so they cannot disagree.
final orderDestinationProvider = Provider<OrderDestination?>((ref) {
  final activeSession = ref.watch(myStaysProvider).whenOrNull(
        data: (sessions) => sessions
            .where((s) => s.status == StayStatus.active)
            .firstOrNull,
      );

  if (activeSession != null) {
    return OrderDestination(
      kind: OrderDestinationKind.stay,
      placeId: activeSession.placeId,
      placeKind: activeSession.placeKind,
      name: activeSession.placeName,
      sessionId: activeSession.id,
    );
  }

  final table = ref.watch(activePlaceProvider);
  if (table != null) {
    return OrderDestination(
      kind: OrderDestinationKind.place,
      placeId: table.id,
      placeKind: table.kind,
      name: table.name,
    );
  }

  return null;
});

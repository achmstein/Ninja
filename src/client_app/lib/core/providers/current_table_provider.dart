import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/localized_text.dart';
import 'branch_provider.dart';
import '../../features/rooms/models/room.dart';
import '../../features/rooms/services/room_service.dart';

const String _tableKey = 'current_table';

/// How long a scanned table stays attached to the customer. Long enough for a
/// sitting with several rounds, short enough that yesterday's scan never
/// mislabels today's order. Kept in step with client_web's table store.
const Duration tableTtl = Duration(hours: 3);

/// Cached value loaded before the app starts
CurrentTable? _initialTable;

/// Call this before runApp() to preload the remembered table
Future<void> initializeCurrentTable() async {
  final prefs = await SharedPreferences.getInstance();
  _initialTable = _decode(prefs.getString(_tableKey));
}

class CurrentTable {
  final int id;
  final LocalizedText name;
  final int branchId;

  /// Refreshed on each order, so a long sitting does not expire mid-visit.
  final DateTime scannedAt;

  const CurrentTable({
    required this.id,
    required this.name,
    required this.branchId,
    required this.scannedAt,
  });

  bool get isFresh => DateTime.now().difference(scannedAt) < tableTtl;

  Map<String, dynamic> toJson() => {
        'id': id,
        'nameEn': name.en,
        'nameAr': name.ar,
        'branchId': branchId,
        'scannedAt': scannedAt.millisecondsSinceEpoch,
      };

  CurrentTable copyWith({DateTime? scannedAt}) => CurrentTable(
        id: id,
        name: name,
        branchId: branchId,
        scannedAt: scannedAt ?? this.scannedAt,
      );
}

CurrentTable? _decode(String? raw) {
  if (raw == null) return null;
  try {
    final json = jsonDecode(raw) as Map<String, dynamic>;
    return CurrentTable(
      id: json['id'] as int,
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

class CurrentTableNotifier extends Notifier<CurrentTable?> {
  @override
  CurrentTable? build() => _initialTable;

  Future<void> setTable(CurrentTable table) async {
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
    await setTable(table.copyWith(scannedAt: DateTime.now()));
  }
}

final currentTableProvider =
    NotifierProvider<CurrentTableNotifier, CurrentTable?>(
  CurrentTableNotifier.new,
);

/// The remembered table, but only while it is fresh and belongs to the branch
/// the customer is actually browsing.
final activeTableProvider = Provider<CurrentTable?>((ref) {
  final table = ref.watch(currentTableProvider);
  if (table == null || !table.isFresh) return null;
  final branchId = ref.watch(selectedBranchIdProvider);
  return table.branchId == branchId ? table : null;
});

/// Where the next order will be delivered.
enum OrderDestinationKind { room, table }

class OrderDestination {
  final OrderDestinationKind kind;
  final LocalizedText name;

  /// Only set for a table; a room travels as a name snapshot alone.
  final int? tableId;

  const OrderDestination({
    required this.kind,
    required this.name,
    this.tableId,
  });

  bool get isRoom => kind == OrderDestinationKind.room;
}

/// A running room session beats a scanned table, and forgets it: moving to a
/// room means the customer left the table, so once the session ends they have
/// no destination until they scan wherever they sit next. Keeping the old table
/// warm would risk sending food to a table they had already walked away from.
///
/// Mirrors useOrderDestination in the web client; every surface that shows or
/// sends the destination reads it from here so they cannot disagree.
final orderDestinationProvider = Provider<OrderDestination?>((ref) {
  final activeSession = ref.watch(mySessionsProvider).whenOrNull(
        data: (sessions) => sessions
            .where((s) => s.status == SessionStatus.active)
            .firstOrNull,
      );

  if (activeSession != null) {
    return OrderDestination(
      kind: OrderDestinationKind.room,
      name: activeSession.roomName,
    );
  }

  final table = ref.watch(activeTableProvider);
  if (table != null) {
    return OrderDestination(
      kind: OrderDestinationKind.table,
      name: table.name,
      tableId: table.id,
    );
  }

  return null;
});

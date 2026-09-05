import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/sale_line.dart';

const _prefsKey = 'chillax-pos-sale';

class SaleState {
  final List<SaleLine> lines;
  final String note;
  final SaleCustomer? customer;

  /// The bill these lines are for: a ticket id, or null for a walk-in sale
  final int? target;

  const SaleState({
    this.lines = const [],
    this.note = '',
    this.customer,
    this.target,
  });

  double get total => saleTotal(lines);
  int get count => saleCount(lines);
  bool get isEmpty => lines.isEmpty && customer == null && note.isEmpty;

  SaleState copyWith({
    List<SaleLine>? lines,
    String? note,
    SaleCustomer? customer,
    bool clearCustomer = false,
    int? target,
    bool clearTarget = false,
  }) =>
      SaleState(
        lines: lines ?? this.lines,
        note: note ?? this.note,
        customer: clearCustomer ? null : (customer ?? this.customer),
        target: clearTarget ? null : (target ?? this.target),
      );

  Map<String, dynamic> toJson() => {
        'lines': lines.map((l) => l.toJson()).toList(),
        'note': note,
        'customer': customer?.toJson(),
        'target': target,
      };

  factory SaleState.fromJson(Map<String, dynamic> json) => SaleState(
        lines: ((json['lines'] as List<dynamic>?) ?? [])
            .map((e) => SaleLine.fromJson(e as Map<String, dynamic>))
            .toList(),
        note: json['note'] as String? ?? '',
        customer: json['customer'] == null ? null : SaleCustomer.fromJson(json['customer'] as Map<String, dynamic>),
        target: json['target'] as int?,
      );
}

SaleState _initial = const SaleState();

/// Read before `runApp`, like the locale: the cart is whole before any
/// screen can point it somewhere, so a restore landing late can never
/// overwrite what the pad just did.
Future<void> initializeSale() async {
  try {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_prefsKey);
    if (raw != null) _initial = SaleState.fromJson(json.decode(raw) as Map<String, dynamic>);
  } catch (_) {
    // A cart that cannot be read is not worth keeping
    _initial = const SaleState();
  }
}

/// The counter-sale cart, ported from pos_web's `useSale`. Survives an
/// accidental app restart mid-sale; cleared when the sale lands.
class SaleNotifier extends Notifier<SaleState> {
  @override
  SaleState build() => _initial;

  Future<void> _persist() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_prefsKey, json.encode(state.toJson()));
    } catch (_) {}
  }

  void _set(SaleState next) {
    state = next;
    _persist();
  }

  /// Point the cart at a destination. Changing it empties the cart: a
  /// half-built walk-in must never follow the cashier onto someone's open
  /// ticket (or the other way round) — those are different people's money.
  void setTarget(int? target) {
    if (state.target == target) return;
    _set(SaleState(target: target));
  }

  void add(SaleLine line) {
    final key = line.key;
    final index = state.lines.indexWhere((l) => l.key == key);
    if (index >= 0) {
      final merged = [...state.lines];
      merged[index] = merged[index].withQuantity(merged[index].quantity + line.quantity);
      _set(state.copyWith(lines: merged));
    } else {
      _set(state.copyWith(lines: [...state.lines, line]));
    }
  }

  void setQuantity(String key, int quantity) {
    _set(state.copyWith(
      lines: quantity <= 0
          ? state.lines.where((l) => l.key != key).toList()
          : state.lines.map((l) => l.key == key ? l.withQuantity(quantity) : l).toList(),
    ));
  }

  void setNote(String note) => _set(state.copyWith(note: note));

  void setCustomer(SaleCustomer? customer) =>
      _set(customer == null ? state.copyWith(clearCustomer: true) : state.copyWith(customer: customer));

  void clear() => _set(SaleState(target: state.target));
}

final saleProvider = NotifierProvider<SaleNotifier, SaleState>(SaleNotifier.new);

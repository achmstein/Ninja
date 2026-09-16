import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/models/localized_text.dart';
import '../../../core/providers/branch_provider.dart';
import '../models/place.dart';
import '../services/place_service.dart';

/// Places state
class PlacesState {
  final bool isLoading;
  final String? error;
  final List<Place> places;
  final List<Stay> openStays;
  final List<Stay>? stayHistory;
  final bool isLoadingHistory;
  final bool hasMoreHistory;

  /// How many history rows the screen has asked for so far
  final int historyLimit;

  const PlacesState({
    this.isLoading = false,
    this.error,
    this.places = const [],
    this.openStays = const [],
    this.stayHistory,
    this.isLoadingHistory = false,
    this.hasMoreHistory = false,
    this.historyLimit = 0,
  });

  /// The held stays, for the nav badge
  int get heldCount => openStays.where((s) => s.status == StayStatus.held).length;

  /// The held or running stay on a place, if any
  Stay? openStayOn(int placeId) => openStays.where((s) => s.placeId == placeId).firstOrNull;

  PlacesState copyWith({
    bool? isLoading,
    String? error,
    List<Place>? places,
    List<Stay>? openStays,
    List<Stay>? stayHistory,
    bool? isLoadingHistory,
    bool? hasMoreHistory,
    int? historyLimit,
    bool clearHistory = false,
  }) {
    return PlacesState(
      isLoading: isLoading ?? this.isLoading,
      error: error,
      places: places ?? this.places,
      openStays: openStays ?? this.openStays,
      stayHistory: clearHistory ? null : (stayHistory ?? this.stayHistory),
      isLoadingHistory: isLoadingHistory ?? this.isLoadingHistory,
      hasMoreHistory: hasMoreHistory ?? this.hasMoreHistory,
      historyLimit: historyLimit ?? this.historyLimit,
    );
  }
}

/// Places provider
class PlacesNotifier extends Notifier<PlacesState> {
  late PlaceRepository _repository;

  @override
  PlacesState build() {
    ref.watch(selectedBranchIdProvider);
    _repository = ref.read(placeRepositoryProvider);
    Future.microtask(() => loadPlaces());
    return const PlacesState(isLoading: true);
  }

  Future<void> loadPlaces() async {
    state = state.copyWith(isLoading: true, error: null);

    try {
      final result = await _repository.loadPlaces();

      state = state.copyWith(
        isLoading: false,
        places: result.places,
        openStays: result.openStays,
      );
    } catch (e) {
      debugPrint('Failed to load places: $e');
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  /// Runs one change and reloads; the server's refusal comes back as the
  /// message, null when it went through
  Future<String?> _change(String what, Future<void> Function() call) async {
    try {
      await call();
      await loadPlaces();
      return null;
    } on PlaceRequestRefused catch (e) {
      debugPrint('Failed to $what: ${e.detail}');
      return e.detail;
    } catch (e) {
      debugPrint('Failed to $what: $e');
      return '';
    }
  }

  // ---- stays

  Future<bool> holdPlace(int placeId, {String? customerName, bool startOnConfirm = false}) async =>
      await _change('hold place', () => _repository.holdPlace(placeId, customerName: customerName, startOnConfirm: startOnConfirm)) == null;

  Future<bool> startWalkIn(int placeId, {String? optionCode}) async =>
      await _change('start walk-in', () => _repository.startWalkIn(placeId, optionCode: optionCode)) == null;

  Future<bool> confirmStay(int stayId, {String? optionCode}) async =>
      await _change('confirm stay', () => _repository.confirmStay(stayId, optionCode: optionCode)) == null;

  Future<bool> startStay(int stayId, {String? optionCode}) async =>
      await _change('start stay', () => _repository.startStay(stayId, optionCode: optionCode)) == null;

  Future<bool> endStay(int stayId) async => await _change('end stay', () => _repository.endStay(stayId)) == null;

  Future<bool> cancelStay(int stayId) async =>
      await _change('cancel stay', () => _repository.cancelStay(stayId)) == null;

  Future<bool> changeOption(int stayId, String optionCode) async =>
      await _change('change option', () => _repository.changeOption(stayId, optionCode)) == null;

  /// Give a walk-in stay its customer
  Future<bool> assignStayCustomer(int stayId, String customerId, String? customerName) async =>
      await _change('assign customer', () => _repository.assignStayCustomer(stayId, customerId, customerName)) == null;

  Future<bool> addStayMember(int stayId, String customerId, String? customerName) async =>
      await _change('add member', () => _repository.addStayMember(stayId, customerId, customerName)) == null;

  Future<bool> removeStayMember(int stayId, String customerId) async =>
      await _change('remove member', () => _repository.removeStayMember(stayId, customerId)) == null;

  // ---- the place itself; these hand back the server's reason so the
  // form can show it

  Future<String?> createPlace({
    required PlaceKind kind,
    required LocalizedText name,
    LocalizedText? description,
    Tariff? tariff,
  }) =>
      _change('create place', () => _repository.createPlace(kind: kind, name: name, description: description, tariff: tariff));

  Future<String?> updatePlace(int placeId, {required LocalizedText name, LocalizedText? description}) =>
      _change('update place', () => _repository.updatePlace(placeId, name: name, description: description));

  Future<String?> setTariff(int placeId, Tariff? tariff) =>
      _change('set tariff', () => _repository.setTariff(placeId, tariff));

  Future<String?> setActive(int placeId, bool isActive) =>
      _change('set active', () => _repository.setActive(placeId, isActive));

  Future<String?> setStatus(int placeId, PlaceStatus status) =>
      _change('set status', () => _repository.setStatus(placeId, status));

  Future<String?> deletePlace(int placeId) => _change('delete place', () => _repository.deletePlace(placeId));

  static const int _historyPageSize = 20;

  /// Load the ended and cancelled stays of one place; load more asks the
  /// server for a longer list
  Future<void> loadStayHistory(int placeId, {bool loadMore = false}) async {
    final limit = loadMore ? state.historyLimit + _historyPageSize : _historyPageSize;
    final current = loadMore ? state.stayHistory : null;

    state = state.copyWith(
      isLoadingHistory: true,
      clearHistory: !loadMore,
      historyLimit: limit,
    );

    try {
      final history = await _repository.getStayHistory(placeId, limit: limit);

      state = state.copyWith(
        isLoadingHistory: false,
        stayHistory: history,
        hasMoreHistory: history.length >= limit,
      );
    } catch (e) {
      state = state.copyWith(
        isLoadingHistory: false,
        stayHistory: current ?? [],
        hasMoreHistory: false,
      );
    }
  }

  /// Clear stay history when leaving the detail screen
  void clearStayHistory() {
    state = state.copyWith(clearHistory: true, historyLimit: 0);
  }
}

/// Places provider
final placesProvider = NotifierProvider<PlacesNotifier, PlacesState>(PlacesNotifier.new);

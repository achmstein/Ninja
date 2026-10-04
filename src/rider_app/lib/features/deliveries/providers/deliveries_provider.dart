import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../core/config/app_config.dart';
import '../../../core/providers/branch_provider.dart';
import '../models/delivery_order.dart';
import '../services/delivery_service.dart';

/// The rider's deliveries, refetched on every hub nudge and push, and on a
/// slow poll in case both went quiet. A refusal keeps what was last shown.
class DeliveriesNotifier extends AsyncNotifier<RiderDay> {
  Timer? _poll;

  @override
  Future<RiderDay> build() async {
    // Another branch, another list
    ref.watch(selectedBranchIdProvider);
    _poll?.cancel();
    _poll = Timer.periodic(AppConfig.deliveriesPoll, (_) => refresh());
    ref.onDispose(() => _poll?.cancel());
    return _load();
  }

  Future<RiderDay> _load() async => RiderDay.of(await ref.read(deliveryServiceProvider).mine());

  Future<void> refresh() async {
    try {
      state = AsyncData(await _load());
    } catch (e) {
      debugPrint('Deliveries refresh failed: $e');
      if (!state.hasValue) state = AsyncError(e, StackTrace.current);
    }
  }

  /// Left with it, or handed it over; the list follows at once, then the server's word
  Future<void> markOut(int orderId) async {
    await ref.read(deliveryServiceProvider).markOut(orderId);
    await refresh();
  }

  Future<void> markDelivered(int orderId) async {
    await ref.read(deliveryServiceProvider).markDelivered(orderId);
    await refresh();
  }
}

final deliveriesProvider = AsyncNotifierProvider<DeliveriesNotifier, RiderDay>(DeliveriesNotifier.new);

const _dutyKey = 'rider_on_duty';

/// Whether the rider is working: their own switch, remembered on the phone
/// and told to the till (with a heartbeat while the app is open, so a
/// phone that died does not leave them listed as on duty for long).
class DutyNotifier extends Notifier<bool> {
  Timer? _heartbeat;

  @override
  bool build() {
    ref.onDispose(() => _heartbeat?.cancel());
    // The branch the rider works at decides where the till lists them
    ref.listen(selectedBranchIdProvider, (previous, next) {
      if (next != null && next != previous) announce();
    });
    _restore();
    return false;
  }

  Future<void> _restore() async {
    final prefs = await SharedPreferences.getInstance();
    state = prefs.getBool(_dutyKey) ?? false;
    _schedule();
  }

  Future<void> set(bool onDuty) async {
    state = onDuty;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_dutyKey, onDuty);
    _schedule();
    await announce();
  }

  /// Tell the till where the rider stands; quietly, as a heartbeat may fail
  Future<void> announce() async {
    if (ref.read(selectedBranchIdProvider) == null) return;
    try {
      await ref.read(deliveryServiceProvider).setOnDuty(state);
    } catch (e) {
      debugPrint('Duty announce failed: $e');
    }
  }

  /// The app went to the background: stop beating, the till lets the rider go quiet
  void pause() {
    _heartbeat?.cancel();
    _heartbeat = null;
  }

  /// Back in front: say so at once, and keep saying it while on duty
  void resume() {
    _schedule();
    if (state) announce();
  }

  void _schedule() {
    _heartbeat?.cancel();
    _heartbeat = state ? Timer.periodic(AppConfig.dutyHeartbeat, (_) => announce()) : null;
  }
}

final dutyProvider = NotifierProvider<DutyNotifier, bool>(DutyNotifier.new);

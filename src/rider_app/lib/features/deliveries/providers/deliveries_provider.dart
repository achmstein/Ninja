import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../core/auth/auth_service.dart';
import 'package:ninja_app_core/brand/brand_provider.dart';
import '../../../core/config/app_config.dart';
import '../../../core/network/api_errors.dart';
import 'package:ninja_app_core/providers/branch_provider.dart';
import '../models/delivery_order.dart';
import '../services/delivery_service.dart';

/// The rider's deliveries, refetched on every hub nudge and push, and on a
/// slow poll while the app is in front in case both went quiet. A refusal
/// keeps what was last shown, and [deliveriesStaleSinceProvider] says since
/// when the list could not be refreshed.
class DeliveriesNotifier extends AsyncNotifier<RiderDay> {
  Timer? _poll;

  @override
  Future<RiderDay> build() async {
    // Another rider or another branch, another list
    ref.watch(authServiceProvider.select((a) => a.userId));
    ref.watch(selectedBranchIdProvider);
    _startPolling();
    ref.onDispose(_stopPolling);
    return _load();
  }

  Future<RiderDay> _load() async => RiderDay.of(await ref.read(deliveryServiceProvider).mine());

  void _startPolling() {
    _poll?.cancel();
    _poll = Timer.periodic(AppConfig.deliveriesPoll, (_) => refresh());
  }

  void _stopPolling() {
    _poll?.cancel();
    _poll = null;
  }

  /// The app went to the background: no point polling a list nobody sees
  void pause() => _stopPolling();

  /// Back in front: fetch at once, then keep polling
  void resume() {
    _startPolling();
    refresh();
  }

  Future<void> refresh() async {
    try {
      final day = await _load();
      if (!ref.mounted) return;
      state = AsyncData(day);
      ref.read(deliveriesStaleSinceProvider.notifier).fresh();
    } catch (e, stack) {
      if (!ref.mounted) return;
      debugPrint('Deliveries refresh failed: $e');
      // Delivery was switched off (or not bought) mid-shift: the brand says so, and the screen follows
      if (classifyError(e) == ApiFailure.notDelivering) unawaited(ref.read(brandProvider.notifier).refresh());
      if (state.hasValue) {
        ref.read(deliveriesStaleSinceProvider.notifier).failed();
      } else {
        state = AsyncError(e, stack);
      }
    }
  }

  /// Left with it, or handed it over; the list follows the server's word
  Future<void> markOut(int orderId) async {
    await ref.read(deliveryServiceProvider).markOut(orderId);
    await refresh();
  }

  Future<void> markDelivered(int orderId) async {
    await ref.read(deliveryServiceProvider).markDelivered(orderId);
    await refresh();
  }

  /// Could not hand it over: the bag goes back to the branch
  Future<void> markFailed(int orderId, String reason) async {
    await ref.read(deliveryServiceProvider).markFailed(orderId, reason);
    await refresh();
  }
}

final deliveriesProvider = AsyncNotifierProvider<DeliveriesNotifier, RiderDay>(DeliveriesNotifier.new);

/// Since when refreshing the list has failed (it shows what was last fetched);
/// null while it is fresh
class DeliveriesStaleNotifier extends Notifier<DateTime?> {
  @override
  DateTime? build() => null;

  void failed() => state ??= DateTime.now();

  void fresh() => state = null;
}

final deliveriesStaleSinceProvider = NotifierProvider<DeliveriesStaleNotifier, DateTime?>(DeliveriesStaleNotifier.new);

/// The delivery a tapped push points at, for the list to bring into view; null otherwise
class FocusedDeliveryNotifier extends Notifier<int?> {
  @override
  int? build() => null;

  void focus(int? orderId) => state = orderId;
}

final focusedDeliveryProvider = NotifierProvider<FocusedDeliveryNotifier, int?>(FocusedDeliveryNotifier.new);

/// Where the rider stands: on duty or off, and whether the till has heard the latest switch yet
@immutable
class DutyState {
  final bool onDuty;

  /// The switch was flipped and the till has not answered yet
  final bool pending;

  const DutyState({this.onDuty = false, this.pending = false});
}

/// Whether the rider is working: their own switch, remembered on the phone
/// for this rider (another rider signing in on the same phone starts off
/// duty) and told to the till, with a heartbeat while the app is in front.
/// Going to the background (Maps open on the way to a door) does not take
/// the rider off duty: only the switch, or signing out, does.
class DutyNotifier extends Notifier<DutyState> {
  Timer? _heartbeat;

  @override
  DutyState build() {
    ref.onDispose(() => _heartbeat?.cancel());
    final userId = ref.watch(authServiceProvider.select((a) => a.userId));
    // The branch the rider works at decides where the till lists them
    ref.listen(selectedBranchIdProvider, (previous, next) {
      if (next != null && next != previous) announce();
    });
    if (userId != null) _restore(userId);
    return const DutyState();
  }

  static String _key(String userId) => 'rider_on_duty:$userId';

  Future<void> _restore(String userId) async {
    final prefs = await SharedPreferences.getInstance();
    if (!ref.mounted) return;
    state = DutyState(onDuty: prefs.getBool(_key(userId)) ?? false);
    _schedule();
  }

  /// The rider flipped the switch. Shown at once, confirmed by the till; when
  /// the till does not hear it the switch goes back and the error is rethrown
  /// for the screen to say so.
  Future<void> set(bool onDuty) async {
    final before = state.onDuty;
    state = DutyState(onDuty: onDuty, pending: true);
    try {
      await ref.read(deliveryServiceProvider).setOnDuty(onDuty);
    } catch (_) {
      if (ref.mounted) state = DutyState(onDuty: before);
      rethrow;
    }
    if (!ref.mounted) return;
    state = DutyState(onDuty: onDuty);
    final userId = ref.read(authServiceProvider).userId;
    if (userId != null) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(_key(userId), onDuty);
    }
    _schedule();
  }

  /// Tell the till where the rider stands; quietly, as a heartbeat may fail
  Future<void> announce() async {
    if (ref.read(selectedBranchIdProvider) == null) return;
    try {
      await ref.read(deliveryServiceProvider).setOnDuty(state.onDuty);
    } catch (e) {
      debugPrint('Duty announce failed: $e');
    }
  }

  /// Back in front: say so at once, and keep saying it while on duty
  void resume() {
    _schedule();
    if (state.onDuty) announce();
  }

  void _schedule() {
    _heartbeat?.cancel();
    _heartbeat = state.onDuty ? Timer.periodic(AppConfig.dutyHeartbeat, (_) => announce()) : null;
  }
}

final dutyProvider = NotifierProvider<DutyNotifier, DutyState>(DutyNotifier.new);

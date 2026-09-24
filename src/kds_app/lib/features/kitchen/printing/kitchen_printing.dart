import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ninja_printing/ninja_printing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';
import '../../../core/config/app_config.dart';
import '../../../core/network/api_client.dart';
import '../../../core/providers/branch_provider.dart';
import '../../../core/providers/locale_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../l10n/app_localizations.dart';

const _enabledKey = 'kds.kitchen.print';
const _deviceKey = 'kds.device.id';

/// Whether this tablet prints the kitchen's tickets on their stations'
/// printers, as a till can: a shop that runs the till in a browser keeps a
/// tablet for it. Per device.
class KitchenPrintingNotifier extends Notifier<bool> {
  @override
  bool build() {
    SharedPreferences.getInstance().then((prefs) {
      if (ref.mounted) state = prefs.getBool(_enabledKey) ?? false;
    });
    return false;
  }

  Future<void> set(bool enabled) async {
    state = enabled;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_enabledKey, enabled);
  }
}

final kitchenPrintingProvider = NotifierProvider<KitchenPrintingNotifier, bool>(KitchenPrintingNotifier.new);

/// Who this device is to the print queue: made once, kept for good
Future<String> _deviceId() async {
  final prefs = await SharedPreferences.getInstance();
  final existing = prefs.getString(_deviceKey);
  if (existing != null) return existing;
  final id = 'kds-${const Uuid().v4()}';
  await prefs.setString(_deviceKey, id);
  return id;
}

/// Ordering.API's print queue, for the active branch (X-Branch-Id)
class ApiKitchenPrintQueue implements KitchenPrintQueue {
  final ApiClient _api;

  ApiKitchenPrintQueue(this._api);

  @override
  Future<List<KitchenTicket>> pending() async {
    final response = await _api.get<List<dynamic>>('print-jobs');
    return [
      for (final ticket in response.data ?? const []) KitchenTicket.fromJson(ticket as Map<String, dynamic>),
    ];
  }

  @override
  Future<bool> claim(int jobId, String deviceId) async {
    try {
      await _api.post('print-jobs/$jobId/claim', data: {'deviceId': deviceId});
      return true;
    } on DioException catch (e) {
      // Printed already, or another device has it
      if (e.response?.statusCode == 409 || e.response?.statusCode == 404) return false;
      rethrow;
    }
  }

  @override
  Future<void> printed(int jobId) => _api.post('print-jobs/$jobId/printed');

  @override
  Future<void> failed(int jobId, String error) => _api.post('print-jobs/$jobId/failed', data: {'error': error});
}

/// This tablet as the kitchen's printer: while printing is on, every push
/// that a ticket is waiting — and the board's poll interval, for pushes
/// lost to a flaky connection — sends what is waiting to the stations'
/// printers, in the tablet's language.
class KitchenPrintHost {
  final Ref _ref;
  KitchenPrintAgent? _agent;
  Timer? _poll;

  KitchenPrintHost(this._ref);

  bool get enabled => _ref.read(kitchenPrintingProvider);

  void _setPolling(bool on) {
    _poll?.cancel();
    _poll = on ? Timer.periodic(AppConfig.kitchenPoll, (_) => nudge()) : null;
    if (on) nudge();
  }

  /// Something may be waiting: print it. Never throws — a tablet that
  /// cannot reach the queue just tries again at the next nudge.
  Future<void> nudge() async {
    if (!enabled || _ref.read(selectedBranchIdProvider) == null) return;
    try {
      _agent ??= KitchenPrintAgent(
        queue: ApiKitchenPrintQueue(_ref.read(kitchenApiProvider)),
        deviceId: await _deviceId(),
        render: _render,
      );
      await _agent!.drain();
    } catch (e) {
      debugPrint('Kitchen printing: $e');
    }
  }

  Future<List<int>> _render(KitchenTicket ticket) {
    final locale = _ref.read(localeProvider);
    final l10n = lookupAppLocalizations(locale);
    return sheetJob(KitchenTicketSheet(
      ticket: ticket,
      labels: KitchenTicketLabels(
        counter: l10n.counter,
        pickup: l10n.pickup,
        reprint: l10n.kitchenTicketReprint,
        test: l10n.kitchenTicketTest,
        testBody: l10n.kitchenTicketTestBody,
      ),
      languageCode: locale.languageCode,
      fontFamily: getFontFamily(locale),
    ));
  }

  void dispose() => _poll?.cancel();
}

final kitchenPrintHostProvider = Provider<KitchenPrintHost>((ref) {
  final host = KitchenPrintHost(ref);
  ref.listen<bool>(kitchenPrintingProvider, (_, on) => host._setPolling(on), fireImmediately: true);
  ref.onDispose(host.dispose);
  return host;
});

/// Tickets that have waited past a minute for a kitchen printer: the printer
/// is off or out of paper, its address is wrong, or no device in the shop
/// is printing. What the kitchen is warned about, as the till is; polled,
/// since nothing pushes "still not printed".
class StuckKitchenTicketsNotifier extends Notifier<List<KitchenTicket>> {
  static const patience = Duration(minutes: 1);
  Timer? _poll;

  @override
  List<KitchenTicket> build() {
    ref.watch(selectedBranchIdProvider);
    _poll?.cancel();
    _poll = Timer.periodic(AppConfig.kitchenPoll, (_) => refresh());
    ref.onDispose(() => _poll?.cancel());
    Future.microtask(refresh);
    return const [];
  }

  Future<void> refresh() async {
    if (ref.read(selectedBranchIdProvider) == null) return;
    try {
      final waiting = await ApiKitchenPrintQueue(ref.read(kitchenApiProvider)).pending();
      final now = DateTime.now().toUtc();
      if (!ref.mounted) return;
      state = [
        for (final ticket in waiting)
          if (now.difference(ticket.createdAt) > patience) ticket,
      ];
    } catch (_) {
      // Offline, or the queue unreachable: say nothing new
    }
  }
}

final stuckKitchenTicketsProvider =
    NotifierProvider<StuckKitchenTicketsNotifier, List<KitchenTicket>>(StuckKitchenTicketsNotifier.new);

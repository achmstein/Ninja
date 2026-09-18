import 'dart:async';
import 'dart:io' show Platform;

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../auth/auth_service.dart';
import '../config/app_config.dart';
import '../providers/branch_provider.dart';
import '../providers/locale_provider.dart';
import '../router/app_router.dart';
import '../../features/menu/models/menu_item.dart';
import '../../features/menu/services/menu_service.dart';
import '../../features/orders/services/order_service.dart';
import '../../features/places/models/place.dart';
import '../../features/places/services/place_service.dart';

const _channel = MethodChannel('com.chillax.client/session_notification');

class _DrinkInfo {
  final int id;
  final String name;
  final MenuItem item;
  _DrinkInfo({required this.id, required this.name, required this.item});
}

/// Manages the persistent native notification shown during active sessions.
///
/// Architecture:
/// - Owns the full lifecycle: listens for session changes, shows/dismisses.
/// - Resolves favorite drinks directly from the API (no provider dependency).
/// - Action handler registered in constructor (no timing issues).
/// - Waiter/Controller actions handled natively via HTTP (no Flutter dependency).
/// - Drink actions forwarded to Dart via method channel.
class SessionNotificationService {
  final Ref _ref;
  Timer? _updateTimer;
  Stay? _activeSession;
  ProviderSubscription? _sessionSub;

  MenuItem? _drink1Item;
  MenuItem? _drink2Item;

  /// Cached drinks so we don't re-fetch on every periodic update
  List<_DrinkInfo>? _cachedDrinks;
  int? _cachedSessionId;

  SessionNotificationService(this._ref) {
    _channel.setMethodCallHandler((call) async {
      if (call.method == 'onAction') {
        _handleAction(call.arguments as String?);
      }
    });
  }

  /// Start listening for session changes. Call once after auth is ready.
  void startListening() {
    // Avoid duplicate subscriptions
    _sessionSub?.close();

    _sessionSub = _ref.listen<AsyncValue<List<Stay>>>(
      myStaysProvider,
      (previous, next) => _onSessionsChanged(next),
      fireImmediately: true,
    );

    // Ensure fresh data — the provider's initial load may have failed
    // (e.g., 401 before auth was ready). This triggers a silent refresh
    // that updates the state and fires the listener above.
    _ref.read(myStaysProvider.notifier).refresh();
  }

  /// Stop listening (e.g., on logout).
  void stopListening() {
    _sessionSub?.close();
    _sessionSub = null;
    dismissNotification();
  }

  void _onSessionsChanged(AsyncValue<List<Stay>> state) {
    state.whenData((sessions) {
      final active = sessions
          .where((s) => s.status == StayStatus.active)
          .firstOrNull;

      if (active != null) {
        // Skip if we're already showing for this exact session
        if (_activeSession?.id == active.id) return;
        final lang = _ref.read(localeProvider).languageCode;
        _showForSession(active, lang);
      } else {
        dismissNotification();
      }
    });
  }

  /// Show or update the notification for an active session.
  Future<void> _showForSession(Stay session, String locale) async {
    _activeSession = session;

    // Save session info in parallel, don't block notification display
    _saveSessionInfo(session);

    final isArabic = locale == 'ar';
    final roomName = isArabic
        ? (session.placeName.ar ?? session.placeName.en)
        : session.placeName.en;

    // Session context for iOS Live Activity intents (background actions)
    final accessToken = await _ref.read(authServiceProvider.notifier).getAccessToken();
    final branchId = _ref.read(selectedBranchIdProvider);
    final sessionContext = <String, dynamic>{
      if (accessToken != null) 'accessToken': accessToken,
      'apiBaseUrl': AppConfig.notificationsApiUrl,
      'sessionId': session.id,
      // LEGACY(places): the native channel's 'roomId'/'roomNameEn'/'roomNameAr' keys carry the place — remove when the Live Activity / native channel is updated to place keys (the native side must change first).
      'roomId': session.placeId,
      if (branchId != null) 'branchId': branchId,
      'roomNameEn': session.placeName.en,
      if (session.placeName.ar != null) 'roomNameAr': session.placeName.ar,
    };

    // Show Live Activity immediately with basic info (room + timer + waiter/controller)
    try {
      final cached = _cachedDrinks ?? [];
      await _channel.invokeMethod('show', {
        // LEGACY(places): the native channel's 'roomName' key carries the place name — remove when the Live Activity / native channel is updated to place keys (the native side must change first).
        'roomName': roomName,
        'duration': session.formattedDuration,
        'startTimeMs': session.startedAt?.millisecondsSinceEpoch,
        'locale': locale,
        ...sessionContext,
        // Include cached drinks if available from a previous resolve
        if (cached.isNotEmpty) 'drink1Name': cached[0].name,
        if (cached.length > 1) 'drink2Name': cached[1].name,
      });
    } catch (e) {
      debugPrint('Failed to show session notification: $e');
    }

    _startPeriodicUpdate(locale);

    // Resolve drinks in the background, then update the Live Activity with drink buttons
    final needsDrinks = _cachedSessionId != session.id ||
        (_cachedDrinks?.isEmpty ?? true);
    if (needsDrinks) {
      _resolveFavoriteDrinks(locale).then((drinks) async {
        _cachedDrinks = drinks;
        _cachedSessionId = session.id;
        _drink1Item = drinks.isNotEmpty ? drinks[0].item : null;
        _drink2Item = drinks.length > 1 ? drinks[1].item : null;

        if (drinks.isEmpty) return;

        try {
          await _channel.invokeMethod('show', {
            // LEGACY(places): the native channel's 'roomName' key carries the place name — remove when the Live Activity / native channel is updated to place keys (the native side must change first).
            'roomName': roomName,
            'duration': session.formattedDuration,
            'startTimeMs': session.startedAt?.millisecondsSinceEpoch,
            'locale': locale,
            ...sessionContext,
            'drink1Name': drinks[0].name,
            if (drinks.length > 1) 'drink2Name': drinks[1].name,
          });
        } catch (e) {
          debugPrint('Failed to update notification with drinks: $e');
        }
      });
    }
  }

  Future<void> dismissNotification() async {
    _updateTimer?.cancel();
    _updateTimer = null;
    _activeSession = null;
    _drink1Item = null;
    _drink2Item = null;
    _cachedDrinks = null;
    _cachedSessionId = null;

    try {
      await _channel.invokeMethod('dismiss');
    } catch (e) {
      debugPrint('Failed to dismiss session notification: $e');
    }

    await _clearSessionInfo();
  }

  /// Resolve up to 2 drinks: favorites first, then popular items as fallback.
  Future<List<_DrinkInfo>> _resolveFavoriteDrinks(String locale) async {
    try {
      final menuRepo = _ref.read(menuRepositoryProvider);
      final isArabic = locale == 'ar';

      final items = await menuRepo.getMenuItems();
      if (items.isEmpty) return [];

      // Try favorites first
      final favoriteIds = await menuRepo.getFavorites();
      final drinks = <_DrinkInfo>[];

      for (final itemId in favoriteIds) {
        if (drinks.length >= 2) break;
        final item =
            items.where((i) => i.id == itemId && i.isAvailable).firstOrNull;
        if (item == null) continue;
        final name = isArabic ? (item.name.ar ?? item.name.en) : item.name.en;
        drinks.add(_DrinkInfo(id: item.id, name: name, item: item));
      }

      // Fall back to popular items if not enough favorites
      if (drinks.length < 2) {
        final popularItems = items
            .where((i) => i.isPopular && i.isAvailable &&
                !drinks.any((d) => d.id == i.id))
            .toList();
        for (final item in popularItems) {
          if (drinks.length >= 2) break;
          final name =
              isArabic ? (item.name.ar ?? item.name.en) : item.name.en;
          drinks.add(_DrinkInfo(id: item.id, name: name, item: item));
        }
      }

      return drinks;
    } catch (e) {
      debugPrint('Failed to resolve favorite drinks: $e');
      return [];
    }
  }

  void _startPeriodicUpdate(String locale) {
    _updateTimer?.cancel();
    // On iOS, periodic re-posts cause a banner flash (appear/disappear)
    // since iOS doesn't support persistent ongoing notifications.
    // Only Android needs periodic updates for the live timer.
    if (!kIsWeb && Platform.isIOS) return;
    _updateTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (_activeSession != null) {
        _showForSession(_activeSession!, locale);
      }
    });
  }

  // ── Action handling ──────────────────────────────────────────────────

  void _handleAction(String? actionId) async {
    if (actionId == null || _activeSession == null) return;

    if (actionId == 'order_drink_1' || actionId == 'order_drink_2') {
      await _handleDrinkOrder(actionId);
      return;
    }

    // Handle service requests (waiter, controller)
    final requestType = switch (actionId) {
      'call_waiter' => 1,
      'controller' => 2,
      _ => null,
    };
    if (requestType == null) return;

    try {
      final authService = _ref.read(authServiceProvider.notifier);
      final accessToken = await authService.getAccessToken();
      if (accessToken == null) return;

      final branchId = _ref.read(selectedBranchIdProvider);
      final dio = Dio(BaseOptions(
        baseUrl: AppConfig.notificationsApiUrl,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $accessToken',
          if (branchId != null) 'X-Branch-Id': '$branchId',
        },
        queryParameters: {'api-version': '1.0'},
      ));

      await dio.post('service-requests', data: {
        'sessionId': _activeSession!.id,
        // LEGACY(places): the notification action sends the older roomId/roomName fields (no placeId yet) — remove when Ordering and Notification stop reading the old room/table fields.
        'roomId': _activeSession!.placeId,
        'roomName': _activeSession!.placeName.toJson(),
        'requestType': requestType,
      });
    } catch (e) {
      debugPrint('Failed to send service request: $e');
    }
  }

  Future<void> _handleDrinkOrder(String actionId) async {
    final item = actionId == 'order_drink_1' ? _drink1Item : _drink2Item;
    if (item == null) return;

    try {
      final authState = _ref.read(authServiceProvider);
      if (!authState.isAuthenticated) return;

      final menuRepo = _ref.read(menuRepositoryProvider);
      final preference = await menuRepo.getUserPreference(item.id);

      final orderRepo = _ref.read(orderRepositoryProvider);
      await orderRepo.submitFastOrder(
        item: item,
        userId: authState.userId ?? '',
        userName: authState.name ?? '',
        // LEGACY(places): the notification's drink order sends the older roomName/roomId fields (no placeId yet) — remove when Ordering and Notification stop reading the old room/table fields.
        roomName: _activeSession!.placeName.toJson(),
        sessionId: _activeSession!.id,
        roomId: _activeSession!.placeId,
        preference: preference,
      );

      _ref.read(ordersProvider.notifier).refresh();
      _ref.read(routerProvider).go('/bills');
    } catch (e) {
      debugPrint('Failed to submit drink order from notification: $e');
    }
  }

  // ── SharedPreferences for native fallback ────────────────────────────

  Future<void> _saveSessionInfo(Stay session) async {
    final prefs = await SharedPreferences.getInstance();
    final accessToken =
        await _ref.read(authServiceProvider.notifier).getAccessToken();
    final branchId = _ref.read(selectedBranchIdProvider);

    await prefs.setInt('active_session_id', session.id);
    // LEGACY(places): the native side reads the place from the 'active_session_room_id'/'active_session_room_name_*' keys — remove when the Live Activity / native channel is updated to place keys (the native side must change first).
    await prefs.setInt('active_session_room_id', session.placeId);
    await prefs.setString('active_session_room_name_en', session.placeName.en);
    if (session.placeName.ar != null) {
      await prefs.setString('active_session_room_name_ar', session.placeName.ar!);
    }
    if (accessToken != null) {
      await prefs.setString('active_session_access_token', accessToken);
    }
    if (branchId != null) {
      await prefs.setInt('active_session_branch_id', branchId);
    }
  }

  Future<void> _clearSessionInfo() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('active_session_id');
    // LEGACY(places): the native side's 'active_session_room_*' keys — remove when the Live Activity / native channel is updated to place keys (the native side must change first).
    await prefs.remove('active_session_room_id');
    await prefs.remove('active_session_room_name_en');
    await prefs.remove('active_session_room_name_ar');
    await prefs.remove('active_session_access_token');
    await prefs.remove('active_session_branch_id');
  }

  void dispose() {
    _sessionSub?.close();
    _updateTimer?.cancel();
    _updateTimer = null;
  }
}

final sessionNotificationServiceProvider =
    Provider<SessionNotificationService>((ref) {
  final service = SessionNotificationService(ref);
  ref.onDispose(() => service.dispose());
  return service;
});

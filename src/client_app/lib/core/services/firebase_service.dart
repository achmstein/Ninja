import 'dart:io' show Platform;
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../router/app_router.dart';
import '../../features/notifications/services/notification_service.dart';
import '../../features/places/services/place_service.dart';


/// Method channel for native notification (used in background handler)
const _nativeChannel = MethodChannel('com.chillax.client/session_notification');

/// Background message handler (must be top-level function)
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();

  final data = message.data;
  final type = data['type'];

  if (type == 'session_started') {
    // Show notification natively from background
    try {
      await _nativeChannel.invokeMethod('show', {
        // LEGACY(places): the push's older 'roomName' field, passed on the native channel's 'roomName' key — remove when the Live Activity / native channel is updated to place keys (the native side must change first).
        'roomName': data['roomName'] ?? '',
        'duration': '00:00:00',
        'startTimeMs': int.tryParse(data['startTimeMs'] ?? ''),
        'locale': data['locale'] ?? 'en',
      });
    } catch (_) {
      // Method channel may not be available in background isolate
    }

    // Save session info for action handling
    final prefs = await SharedPreferences.getInstance();
    if (data['sessionId'] != null) {
      await prefs.setInt('active_session_id', int.parse(data['sessionId']));
    }
    // LEGACY(places): the push's older roomId/roomName fields, stored under the native side's 'active_session_room_*' keys — remove when the Live Activity / native channel is updated to place keys (the native side must change first).
    if (data['roomId'] != null) {
      await prefs.setInt('active_session_room_id', int.parse(data['roomId']));
    }
    if (data['roomName'] != null) {
      await prefs.setString('active_session_room_name_en', data['roomName']);
    }
    if (data['accessToken'] != null) {
      await prefs.setString('active_session_access_token', data['accessToken']);
    }
  } else if (type == 'session_ended') {
    try {
      await _nativeChannel.invokeMethod('dismiss');
    } catch (_) {}
  }
}

/// Firebase messaging service for handling FCM tokens and notifications
class FirebaseService {
  FirebaseMessaging? _messaging;
  String? _fcmToken;
  bool _initialized = false;
  Ref? _ref;

  /// Callbacks to invoke when the FCM token is refreshed (e.g. re-register subscriptions)
  final List<void Function(String newToken)> _tokenRefreshCallbacks = [];

  String? get fcmToken => _fcmToken;
  bool get isInitialized => _initialized;

  /// Set Riverpod ref for accessing providers in foreground handlers
  void setRef(Ref ref) {
    _ref = ref;
  }

  /// Register a callback to be invoked when the FCM token refreshes.
  void onTokenRefresh(void Function(String newToken) callback) {
    _tokenRefreshCallbacks.add(callback);
  }

  /// Initialize Firebase messaging and request notification permissions.
  /// Firebase.initializeApp() and Crashlytics are configured in main().
  Future<void> initialize() async {
    try {
      _initialized = true;
      _messaging = FirebaseMessaging.instance;

      // Request notification permissions
      final settings = await _messaging!.requestPermission(
        alert: true,
        badge: true,
        sound: true,
        provisional: false,
      );

      if (settings.authorizationStatus == AuthorizationStatus.authorized ||
          settings.authorizationStatus == AuthorizationStatus.provisional) {
        // Get FCM token
        await _refreshToken();

        _messaging!.onTokenRefresh.listen((newToken) {
          _fcmToken = newToken;
          for (final callback in _tokenRefreshCallbacks) {
            callback(newToken);
          }
        });

        FirebaseMessaging.onMessage.listen(_handleForegroundMessage);
        FirebaseMessaging.onMessageOpenedApp.listen(_handleMessageOpenedApp);

        final initialMessage = await _messaging!.getInitialMessage();
        if (initialMessage != null) {
          // Delay navigation to let router initialize
          Future.delayed(const Duration(milliseconds: 500), () {
            _handleMessageOpenedApp(initialMessage);
          });
        }
      }
    } catch (_) {
      // Firebase not configured — app will work without push notifications
    }
  }

  /// Refresh the FCM token.
  /// On iOS, checks for APNs token first — without it, getToken() hangs indefinitely.
  Future<String?> _refreshToken() async {
    if (_messaging == null) return null;
    try {
      // On iOS, getToken() blocks forever if APNs token is not available.
      // Check with retries and bail out if unavailable.
      if (!kIsWeb && Platform.isIOS) {
        String? apnsToken;
        for (int i = 0; i < 5; i++) {
          apnsToken = await _messaging!.getAPNSToken();
          if (apnsToken != null) break;
          await Future.delayed(const Duration(seconds: 1));
        }
        if (apnsToken == null) return null;
      }

      _fcmToken = await _messaging!.getToken()
          .timeout(const Duration(seconds: 10));
      return _fcmToken;
    } catch (_) {
      return null;
    }
  }

  void _handleForegroundMessage(RemoteMessage message) {
    final data = message.data;
    final type = data['type'];

    if (type == 'session_started') {
      _handleSessionStarted(data);
    } else if (type == 'session_ended') {
      _handleSessionEnded();
    } else if (type == 'room_available') {
      // Backend auto-deletes the subscription after notifying — reset cached state
      _ref?.invalidate(roomAvailabilitySubscriptionProvider);
    }
  }

  void _handleSessionStarted(Map<String, dynamic> data) {
    if (_ref == null) return;

    // Vibrate to alert the user
    HapticFeedback.vibrate();

    // Refresh sessions — the session notification listener will
    // automatically show the notification when it sees the active session.
    _ref!.read(myStaysProvider.notifier).refresh();
  }

  void _handleSessionEnded() {
    if (_ref == null) return;

    // Refresh sessions — the listener will auto-dismiss when no active session.
    _ref!.read(myStaysProvider.notifier).refresh();
  }

  void _handleMessageOpenedApp(RemoteMessage message) {
    if (_ref == null) return;

    final type = message.data['type'];
    final route = switch (type) {
      'order_confirmed' || 'order_cancelled' => '/orders',
      'session_started' || 'session_ended' || 'reservation_cancelled' || 'room_available' => '/places',
      _ => null,
    };
    if (route != null) {
      _ref!.read(routerProvider).go(route);
    }
  }

  /// Get or refresh the FCM token
  Future<String?> getToken() async {
    if (_fcmToken == null) {
      return await _refreshToken();
    }
    return _fcmToken;
  }
}

/// Provider for Firebase service
final firebaseServiceProvider = Provider<FirebaseService>((ref) {
  final service = FirebaseService();
  service.setRef(ref);
  return service;
});

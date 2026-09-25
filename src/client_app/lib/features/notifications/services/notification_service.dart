import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../core/network/api_client.dart';
import '../../../core/services/firebase_service.dart';

/// Subscription status response from the backend
class SubscriptionStatus {
  final int? id;
  final bool isSubscribed;
  final DateTime? createdAt;

  SubscriptionStatus({
    this.id,
    required this.isSubscribed,
    this.createdAt,
  });

  factory SubscriptionStatus.fromJson(Map<String, dynamic> json) {
    return SubscriptionStatus(
      id: json['id'] as int?,
      isSubscribed: json['isSubscribed'] as bool? ?? false,
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'] as String)
          : null,
    );
  }

  factory SubscriptionStatus.notSubscribed() {
    return SubscriptionStatus(isSubscribed: false);
  }
}

/// Abstract interface for notification operations
abstract class NotificationRepository {
  Future<bool> subscribeToRoomAvailability({String preferredLanguage = 'en'});
  Future<bool> unsubscribeFromRoomAvailability();
  Future<bool> registerForOrderNotifications({String preferredLanguage = 'en'});
  Future<void> unregisterFromOrderNotifications();
  Future<bool> registerForSessionNotifications({String preferredLanguage = 'en'});
  Future<void> unregisterFromSessionNotifications();
  Future<SubscriptionStatus> getRoomAvailabilitySubscription();
}

/// Service for handling notification subscriptions
class ApiNotificationRepository implements NotificationRepository {
  final ApiClient _apiClient;
  final FirebaseService _firebaseService;

  ApiNotificationRepository(this._apiClient, this._firebaseService);

  /// Subscribe to room availability notifications
  @override
  Future<bool> subscribeToRoomAvailability({String preferredLanguage = 'en'}) async {
    try {
      final fcmToken = await _firebaseService.getToken();
      if (fcmToken == null) {
        debugPrint('Cannot subscribe: FCM token not available');
        return false;
      }

      final prefs = await SharedPreferences.getInstance();
      final branchId = prefs.getInt('selected_branch_id');

      final response = await _apiClient.post(
        'subscriptions/room-availability',
        data: {
          'fcmToken': fcmToken,
          'preferredLanguage': preferredLanguage,
          'branchId': ?branchId,
        },
      ).timeout(const Duration(seconds: 5));

      if (response.statusCode == 201) {
        debugPrint('Successfully subscribed to room availability notifications');
        return true;
      } else if (response.statusCode == 409) {
        // Already subscribed - that's fine
        debugPrint('Already subscribed to room availability notifications');
        return true;
      }
      return false;
    } catch (e) {
      debugPrint('Failed to subscribe to room availability: $e');
      return false;
    }
  }

  /// Unsubscribe from room availability notifications
  @override
  Future<bool> unsubscribeFromRoomAvailability() async {
    try {
      final response = await _apiClient.delete('subscriptions/room-availability')
          .timeout(const Duration(seconds: 5));

      if (response.statusCode == 204) {
        debugPrint('Successfully unsubscribed from room availability notifications');
        return true;
      }
      return false;
    } catch (e) {
      debugPrint('Failed to unsubscribe from room availability: $e');
      return false;
    }
  }

  /// Register for order status notifications (e.g. order cancelled)
  /// Called automatically after login - fire-and-forget
  @override
  Future<bool> registerForOrderNotifications({String preferredLanguage = 'en'}) async {
    try {
      final fcmToken = await _firebaseService.getToken();
      if (fcmToken == null) {
        debugPrint('Cannot register for order notifications: FCM token not available');
        return false;
      }

      final response = await _apiClient.post(
        'subscriptions/user-orders',
        data: {
          'fcmToken': fcmToken,
          'preferredLanguage': preferredLanguage,
        },
      ).timeout(const Duration(seconds: 5));

      final success = response.statusCode == 200 || response.statusCode == 201;
      debugPrint('Order notification registration: ${success ? 'success' : 'failed'}');
      return success;
    } catch (e) {
      debugPrint('Failed to register for order notifications: $e');
      return false;
    }
  }

  /// Unregister from order status notifications
  /// Called on logout
  @override
  Future<void> unregisterFromOrderNotifications() async {
    try {
      await _apiClient.delete('subscriptions/user-orders')
          .timeout(const Duration(seconds: 5));
      debugPrint('Unregistered from order notifications');
    } catch (e) {
      debugPrint('Failed to unregister from order notifications: $e');
    }
  }

  /// Register for session notifications (session started/ended)
  @override
  Future<bool> registerForSessionNotifications({String preferredLanguage = 'en'}) async {
    try {
      final fcmToken = await _firebaseService.getToken();
      if (fcmToken == null) {
        debugPrint('Cannot register for session notifications: FCM token not available');
        return false;
      }

      final response = await _apiClient.post(
        'subscriptions/user-sessions',
        data: {
          'fcmToken': fcmToken,
          'preferredLanguage': preferredLanguage,
        },
      ).timeout(const Duration(seconds: 5));

      final success = response.statusCode == 200 || response.statusCode == 201;
      debugPrint('Session notification registration: ${success ? 'success' : 'failed'}');
      return success;
    } catch (e) {
      debugPrint('Failed to register for session notifications: $e');
      return false;
    }
  }

  /// Unregister from session notifications
  @override
  Future<void> unregisterFromSessionNotifications() async {
    try {
      await _apiClient.delete('subscriptions/user-sessions')
          .timeout(const Duration(seconds: 5));
      debugPrint('Unregistered from session notifications');
    } catch (e) {
      debugPrint('Failed to unregister from session notifications: $e');
    }
  }

  /// Check if user is subscribed to room availability notifications
  @override
  Future<SubscriptionStatus> getRoomAvailabilitySubscription() async {
    try {
      final response = await _apiClient.get('subscriptions/room-availability')
          .timeout(const Duration(seconds: 5));

      if (response.statusCode == 200 && response.data != null) {
        return SubscriptionStatus.fromJson(response.data as Map<String, dynamic>);
      }
      return SubscriptionStatus.notSubscribed();
    } catch (e) {
      debugPrint('Failed to get room availability subscription: $e');
      return SubscriptionStatus.notSubscribed();
    }
  }
}

/// Provider for notification repository
final notificationRepositoryProvider = Provider<NotificationRepository>((ref) {
  return ApiNotificationRepository(
    ref.read(notificationsApiProvider),
    ref.read(firebaseServiceProvider),
  );
});

/// Async provider for subscription status. Caches until invalidated.
/// Invalidated on: room_available FCM, SignalR RoomStatusChanged, manual subscribe/unsubscribe.
final roomAvailabilitySubscriptionProvider = FutureProvider<bool>((ref) async {
  final repo = ref.read(notificationRepositoryProvider);
  final status = await repo.getRoomAvailabilitySubscription();
  return status.isSubscribed;
});

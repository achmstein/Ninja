import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../models/notification_preferences.dart';

/// Abstract interface for settings operations
abstract class SettingsRepository {
  Future<NotificationPreferences> getNotificationPreferences();
  Future<void> updateNotificationPreferences(NotificationPreferences preferences);
  Future<void> changePassword(String newPassword);
  Future<void> updateProfile(String firstName, String lastName, String phoneNumber);
  Future<String?> getPhoneNumber();
  Future<void> deleteAccount();
}

/// Settings repository implementation using API clients
class ApiSettingsRepository implements SettingsRepository {
  final ApiClient _notificationsApiClient;
  final ApiClient _identityApiClient;

  ApiSettingsRepository(this._notificationsApiClient, this._identityApiClient);

  @override
  Future<NotificationPreferences> getNotificationPreferences() async {
    try {
      final response = await _notificationsApiClient.get<Map<String, dynamic>>('preferences');
      if (response.data == null) {
        return const NotificationPreferences();
      }
      return NotificationPreferences.fromJson(response.data!);
    } catch (e) {
      return const NotificationPreferences();
    }
  }

  @override
  Future<void> updateNotificationPreferences(NotificationPreferences preferences) async {
    await _notificationsApiClient.put('preferences', data: preferences.toJson());
  }

  @override
  Future<void> changePassword(String newPassword) async {
    await _identityApiClient.post('change-password', data: {
      'newPassword': newPassword,
    });
  }

  @override
  Future<void> updateProfile(String firstName, String lastName, String phoneNumber) async {
    await _identityApiClient.post('update-profile', data: {
      'firstName': firstName,
      'lastName': lastName,
      'phoneNumber': phoneNumber,
    });
  }

  @override
  Future<String?> getPhoneNumber() async {
    try {
      final response = await _identityApiClient.get<Map<String, dynamic>>('my-profile');
      return response.data?['phoneNumber'] as String?;
    } catch (e) {
      return null;
    }
  }

  @override
  Future<void> deleteAccount() async {
    await _identityApiClient.delete('delete-account');
  }
}

final settingsRepositoryProvider = Provider<SettingsRepository>((ref) {
  final notificationsApiClient = ref.watch(notificationsApiProvider);
  final identityApiClient = ref.watch(identityApiProvider);
  return ApiSettingsRepository(notificationsApiClient, identityApiClient);
});

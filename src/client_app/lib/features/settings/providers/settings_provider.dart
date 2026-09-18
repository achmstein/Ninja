import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/auth/auth_service.dart';
import '../../../core/providers/locale_provider.dart';
import '../../notifications/services/notification_service.dart';
import '../models/notification_preferences.dart';
import '../services/settings_service.dart';

class SettingsState {
  final bool isLoading;
  final String? error;
  final NotificationPreferences preferences;
  final bool isSaving;

  const SettingsState({
    this.isLoading = false,
    this.error,
    this.preferences = const NotificationPreferences(),
    this.isSaving = false,
  });

  SettingsState copyWith({
    bool? isLoading,
    String? error,
    NotificationPreferences? preferences,
    bool? isSaving,
    bool clearError = false,
  }) {
    return SettingsState(
      isLoading: isLoading ?? this.isLoading,
      error: clearError ? null : error ?? this.error,
      preferences: preferences ?? this.preferences,
      isSaving: isSaving ?? this.isSaving,
    );
  }
}

class SettingsNotifier extends Notifier<SettingsState> {
  late SettingsRepository _service;
  late AuthState _authState;

  @override
  SettingsState build() {
    _service = ref.read(settingsRepositoryProvider);
    _authState = ref.watch(authServiceProvider);

    if (_authState.isAuthenticated) {
      Future.microtask(() => _loadPreferences());
    }

    return const SettingsState();
  }

  Future<void> _loadPreferences() async {
    state = state.copyWith(isLoading: true, clearError: true);

    try {
      final preferences = await _service.getNotificationPreferences();
      state = state.copyWith(isLoading: false, preferences: preferences);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<void> refresh() async {
    await _loadPreferences();
  }

  Future<void> updateNotificationPreference({
    bool? orderStatusUpdates,
    bool? promotionsAndOffers,
  }) async {
    final newPreferences = state.preferences.copyWith(
      orderStatusUpdates: orderStatusUpdates,
      promotionsAndOffers: promotionsAndOffers,
    );

    // Optimistic update
    state = state.copyWith(preferences: newPreferences, isSaving: true);

    try {
      await _service.updateNotificationPreferences(newPreferences);
      state = state.copyWith(isSaving: false);

      // Register/unregister FCM token based on order notification toggle
      if (orderStatusUpdates == true) {
        final lang = ref.read(localeProvider).languageCode;
        ref.read(notificationRepositoryProvider).registerForOrderNotifications(
          preferredLanguage: lang,
        );
      } else if (orderStatusUpdates == false) {
        ref.read(notificationRepositoryProvider).unregisterFromOrderNotifications();
      }
    } catch (e) {
      // Revert on error
      state = state.copyWith(
        preferences: state.preferences.copyWith(
          orderStatusUpdates: orderStatusUpdates != null ? !orderStatusUpdates : null,
          promotionsAndOffers: promotionsAndOffers != null ? !promotionsAndOffers : null,
        ),
        isSaving: false,
        error: e.toString(),
      );
    }
  }

  Future<bool> changePassword(String newPassword) async {
    state = state.copyWith(isSaving: true, clearError: true);

    try {
      await _service.changePassword(newPassword);
      state = state.copyWith(isSaving: false);
      return true;
    } catch (e) {
      state = state.copyWith(isSaving: false, error: e.toString());
      return false;
    }
  }

  Future<bool> updateProfile(String newName, String phoneNumber) async {
    state = state.copyWith(isSaving: true, clearError: true);

    try {
      await _service.updateProfile(newName, phoneNumber);
      // Update cached auth state so profile gate sees the new values immediately
      ref.read(authServiceProvider.notifier).setProfile(newName, phoneNumber);
      // Also refresh token to pick up any JWT claim changes
      await ref.read(authServiceProvider.notifier).refreshToken();
      state = state.copyWith(isSaving: false);
      return true;
    } catch (e) {
      state = state.copyWith(isSaving: false, error: e.toString());
      return false;
    }
  }

  Future<String?> getPhoneNumber() async {
    try {
      return await _service.getPhoneNumber();
    } catch (e) {
      return null;
    }
  }

  Future<bool> deleteAccount() async {
    state = state.copyWith(isSaving: true, clearError: true);

    try {
      await _service.deleteAccount();
      state = state.copyWith(isSaving: false);
      return true;
    } catch (e) {
      state = state.copyWith(isSaving: false, error: e.toString());
      return false;
    }
  }
}

final settingsProvider = NotifierProvider<SettingsNotifier, SettingsState>(
  SettingsNotifier.new,
);

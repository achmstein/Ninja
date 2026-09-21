import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _enabledKey = 'kds.kiosk.enabled';

/// What the tablet can do and is doing about being a kitchen display and nothing else
class KioskStatus {
  /// The app was provisioned as device owner, so pinning is silent and total
  final bool isDeviceOwner;

  /// Pinned right now (Home, Recents and the shade are gone)
  final bool isPinned;

  /// The kitchen asked for kiosk mode; re-applied on every resume
  final bool enabled;

  const KioskStatus({this.isDeviceOwner = false, this.isPinned = false, this.enabled = false});
}

/// Lock-task control over the platform channel `MainActivity` answers.
/// Enabling kiosk mode is a per-tablet choice kept in preferences; without
/// device-owner rights Android only offers its screen-pinning prompt, so the
/// settings screen says which of the two it is.
class KioskService {
  static const _channel = MethodChannel('com.ninja.kds/kiosk');

  Future<KioskStatus> status() async {
    final prefs = await SharedPreferences.getInstance();
    return KioskStatus(
      isDeviceOwner: await _call<bool>('isDeviceOwner') ?? false,
      isPinned: await _call<bool>('isInLockTask') ?? false,
      enabled: prefs.getBool(_enabledKey) ?? false,
    );
  }

  Future<void> setEnabled(bool enabled) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_enabledKey, enabled);
    if (enabled) {
      await _call<bool>('startLockTask');
    } else {
      await _call<bool>('stopLockTask');
    }
  }

  /// On start and on every resume: a display that asked to be pinned stays
  /// pinned, even after a reboot or an accidental unpin
  Future<void> reapply() async {
    final prefs = await SharedPreferences.getInstance();
    if (prefs.getBool(_enabledKey) != true) return;
    if (await _call<bool>('isInLockTask') == true) return;
    await _call<bool>('startLockTask');
  }

  Future<T?> _call<T>(String method) async {
    try {
      return await _channel.invokeMethod<T>(method);
    } on PlatformException {
      return null;
    } on MissingPluginException {
      // Not Android (a desktop layout check)
      return null;
    }
  }
}

final kioskServiceProvider = Provider<KioskService>((ref) => KioskService());

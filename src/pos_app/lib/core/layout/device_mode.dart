import 'dart:ui' show FlutterView;

import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'breakpoints.dart';

/// How this device holds the till: lying on a counter (landscape, system
/// bars hidden) or in a hand (upright, system bars kept). Told from the
/// screen unless the till's settings say otherwise: a small tablet measures
/// like a phone, and whoever set it on the counter knows better.
enum DeviceMode { auto, tablet, phone }

const String _modeKey = 'pos_device_mode';

DeviceMode _mode = DeviceMode.auto;

/// What was last applied: a tablet until the screen has said otherwise
bool _phone = false;

/// What Android says the screen is, asked before the first frame: its own
/// line between a phone and a tablet (a smallest width of 600 dp), the one
/// the activity turned the window by (MainActivity.kt). Null where there is
/// nobody to ask (a test); the view's own size answers then.
bool? _screenIsPhone;

/// Whether the till is running as a phone right now
bool get runsAsPhone => _phone;

/// Known to stand on a counter, by its screen or by its settings
bool _knownTablet = false;

/// Whether the screens fold for a narrow width (breakpoints.dart). Never on
/// a device known to be a tablet: it shows what it always showed, however
/// few points wide its screen measures.
bool get foldsForWidth => !_knownTablet;

/// Reads the till's own choice before anything is drawn
Future<void> initializeDeviceMode() async {
  try {
    final prefs = await SharedPreferences.getInstance();
    _mode = DeviceMode.values.asNameMap()[prefs.getString(_modeKey)] ?? DeviceMode.auto;
  } catch (_) {
    _mode = DeviceMode.auto;
  }
  try {
    _screenIsPhone = await const MethodChannel('com.ninja.pos/device').invokeMethod<bool>('isPhone');
  } catch (_) {
    _screenIsPhone = null;
  }
}

/// Turns the screen the way the till is held, as the activity already did
/// before the first frame, so nothing turns or refolds once the till is up.
/// The view's own size is only the fallback: at start Android has often not
/// reported it, and a size of nothing must not be read as a phone (it was,
/// and every tablet came up upright).
Future<void> applyDeviceMode(FlutterView view) async {
  final bool phone;
  switch (_mode) {
    case DeviceMode.tablet:
      phone = false;
    case DeviceMode.phone:
      phone = true;
    case DeviceMode.auto:
      phone = _screenIsPhone ?? (view.physicalSize.isEmpty ? _phone : isPhoneView(view));
  }
  _phone = phone;
  _knownTablet = !phone && (_mode != DeviceMode.auto || _screenIsPhone != null || !view.physicalSize.isEmpty);
  if (phone) {
    await SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
    await SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  } else {
    await SystemChrome.setPreferredOrientations([
      DeviceOrientation.landscapeLeft,
      DeviceOrientation.landscapeRight,
    ]);
    await SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
  }
}

/// The till's choice, for its settings screen
class DeviceModeNotifier extends Notifier<DeviceMode> {
  @override
  DeviceMode build() => _mode;

  Future<void> set(DeviceMode mode, FlutterView view) async {
    _mode = mode;
    state = mode;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_modeKey, mode.name);
    } catch (_) {
      // Not kept: it stands until the till is closed
    }
    await applyDeviceMode(view);
  }
}

final deviceModeProvider = NotifierProvider<DeviceModeNotifier, DeviceMode>(DeviceModeNotifier.new);

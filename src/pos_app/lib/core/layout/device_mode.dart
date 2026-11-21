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
}

/// Turns the screen the way the till is held. Called at start and again
/// whenever the screen reports its size: at start Android has often not
/// said it yet, and a size of nothing must not be read as a phone (it was,
/// and every tablet came up upright). Until the size is known the till
/// stays as it always was, a tablet.
Future<void> applyDeviceMode(FlutterView view) async {
  final bool phone;
  switch (_mode) {
    case DeviceMode.tablet:
      phone = false;
    case DeviceMode.phone:
      phone = true;
    case DeviceMode.auto:
      if (view.physicalSize.isEmpty) {
        phone = _phone;
      } else {
        phone = isPhoneView(view);
      }
  }
  _phone = phone;
  _knownTablet = !phone && (_mode != DeviceMode.auto || !view.physicalSize.isEmpty);
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

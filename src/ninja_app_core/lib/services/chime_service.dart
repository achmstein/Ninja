import 'dart:async';
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// The app's one sound: a short chime when an app order or a room request
/// arrives, rung more than once for an order the reminders are escalating.
/// Plays 700 ms apart, like pos_web's alert.
class ChimeService {
  final AudioPlayer _player = AudioPlayer();
  Timer? _repeat;
  bool _shared = false;

  /// The chime shares the device's sound with whatever else is playing. Left
  /// to the player's own setting it asked Android for the sound outright, and
  /// the music a café plays from the same tablet over its speakers was paused
  /// by every order and never came back. Asked for this way the music only
  /// dips for the second the chime lasts, then carries on.
  static final AudioContext _beside = AudioContext(
    android: const AudioContextAndroid(
      contentType: AndroidContentType.sonification,
      usageType: AndroidUsageType.media,
      audioFocus: AndroidAudioFocus.gainTransientMayDuck,
    ),
    iOS: AudioContextIOS(
      category: AVAudioSessionCategory.playback,
      options: const {AVAudioSessionOptions.mixWithOthers, AVAudioSessionOptions.duckOthers},
    ),
  );

  Future<void> play({int times = 1}) async {
    _repeat?.cancel();
    var remaining = times < 1 ? 1 : times;
    Future<void> once() async {
      remaining -= 1;
      try {
        if (!_shared) {
          await _player.setAudioContext(_beside);
          _shared = true;
        }
        await _player.stop();
        await _player.play(AssetSource('sounds/success.mp3'));
      } catch (e) {
        // No audio route (an emulator, a muted device) — nothing useful to do
        debugPrint('Chime failed: $e');
      }
      if (remaining > 0) _repeat = Timer(const Duration(milliseconds: 700), once);
    }

    await once();
  }

  void dispose() {
    _repeat?.cancel();
    _player.dispose();
  }
}

final chimeServiceProvider = Provider<ChimeService>((ref) {
  final service = ChimeService();
  ref.onDispose(service.dispose);
  return service;
});

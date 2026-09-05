import 'dart:async';
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// The till's one sound: a short chime when an app order or a room request
/// arrives, rung more than once for an order the reminders are escalating.
/// Plays 700 ms apart, like pos_web's alert.
class ChimeService {
  final AudioPlayer _player = AudioPlayer();
  Timer? _repeat;

  Future<void> play({int times = 1}) async {
    _repeat?.cancel();
    var remaining = times < 1 ? 1 : times;
    Future<void> once() async {
      remaining -= 1;
      try {
        await _player.stop();
        await _player.play(AssetSource('sounds/success.mp3'));
      } catch (e) {
        // No audio route (an emulator, a muted tablet) — nothing useful to do
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

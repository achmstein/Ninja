import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/physics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme_provider.dart';
import '../../../core/ui/gesture_hint.dart';
import '../../../core/ui/ui.dart';
import '../../../l10n/app_localizations.dart';
import 'tray_flights.dart';
import 'tray_seats.dart';

/// One pass of the fingertip's drag up the tray, then the pause before the
/// second, and when the first starts (client_web's gesture-timing.ts)
const _passMs = 1400, _gapMs = 500, _delayMs = 200;

/// How long the cue stays up: both passes, the pause and the start (`gestureMs('drag')`)
const trayHintFor = Duration(milliseconds: _delayMs + _passMs * 2 + _gapMs + 300);

/// The tray's first-dish cue (client_web's `useHint('tray')`): the first
/// dish to land lets the order peek out of the dock once, and a fingertip
/// with a word shows how to drag it up. It is one of the app's first-visit
/// cues ([Hint]): kept in the same book on this phone, and waiting while
/// another cue (the deck's swipe, pinch or hold) is on screen, the next dish
/// asking again. Showing it records it at once, so leaving mid-cue does not
/// replay it, and opening the order (shown or not) is the end of it.
class TrayHint extends Hint {
  /// The tray's row, where the cue stands
  final GlobalKey anchor = GlobalKey(debugLabel: 'tray-hint');

  TrayHint() : super(HintKey.tray) {
    trayFlights.bump.addListener(_landed);
  }

  /// A dish landed in the tray: the first one brings the cue
  void _landed() => show();
}

final trayHint = TrayHint();

/// The cue over the whole app, above the tray's row: a fingertip pressing
/// on the tray and drawing up the way the order is pulled out, twice, and a
/// line above the dock saying it. It times itself, so no timer outlives the
/// app. Under reduced motion only the line shows.
class TrayHintLayer extends StatefulWidget {
  const TrayHintLayer({super.key});

  @override
  State<TrayHintLayer> createState() => _TrayHintLayerState();
}

class _TrayHintLayerState extends State<TrayHintLayer> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    trayHint.addListener(_changed);
  }

  @override
  void dispose() {
    trayHint.removeListener(_changed);
    _timer?.cancel();
    super.dispose();
  }

  void _changed() {
    if (trayHint.showing) {
      _timer ??= Timer(trayHintFor, trayHint.done);
    } else {
      _timer?.cancel();
      _timer = null;
    }
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: traySeats,
      builder: (context, _) {
        // Opening the order is the end of the cue; an open order hides it at once
        final shown = trayHint.showing && !(traySeats.motion?.expanded ?? false);
        return AnimatedSwitcher(
          duration: const Duration(milliseconds: 180),
          child: shown ? const _Cue(key: ValueKey('tray-hint')) : const SizedBox.shrink(),
        );
      },
    );
  }
}

class _Cue extends StatefulWidget {
  const _Cue({super.key});

  @override
  State<_Cue> createState() => _CueState();
}

class _CueState extends State<_Cue> with TickerProviderStateMixin {
  /// The whole cue's time: the start, two passes and the pause between
  late final AnimationController _time = AnimationController(vsync: this, duration: const Duration(milliseconds: _delayMs + _passMs * 2 + _gapMs));

  /// The line rising in, on the bubble's spring
  late final AnimationController _rise = AnimationController.unbounded(vsync: this);

  final _layer = GlobalKey(debugLabel: 'tray-hint-layer');

  @override
  void initState() {
    super.initState();
    _time.forward();
    _rise.animateWith(SpringSimulation(const SpringDescription(mass: 1, stiffness: 420, damping: 30), 0, 1, 0));
  }

  @override
  void dispose() {
    _time.dispose();
    _rise.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final reduced = reduceMotion(context);
    return SizedBox.expand(
      key: _layer,
      child: AnimatedBuilder(
        animation: Listenable.merge([_time, _rise]),
        builder: (context, _) {
          // Where the tray's row stood in the last frame: the dock stays put while the cue plays
          final layer = _layer.currentContext?.findRenderObject();
          final row = trayHint.anchor.currentContext?.findRenderObject();
          if (layer is! RenderBox || row is! RenderBox || !row.attached || !row.hasSize || !layer.hasSize) return const SizedBox.shrink();
          final rect = layer.globalToLocal(row.localToGlobal(Offset.zero)) & row.size;
          final rise = reduced ? 1.0 : _rise.value;
          return Stack(
            clipBehavior: Clip.none,
            children: [
              // The line, above the dock, centred on it
              Positioned(
                left: rect.left,
                width: rect.width,
                bottom: layer.size.height - rect.top + 16,
                child: Center(
                  child: Opacity(
                    opacity: (reduced ? _time.value * 10 : rise).clamp(0.0, 1.0),
                    child: Transform.translate(
                      offset: Offset(0, 8 * (1 - rise)),
                      child: Transform.scale(scale: 0.96 + 0.04 * rise, child: const _Bubble()),
                    ),
                  ),
                ),
              ),
              // The fingertip, on the tray and up
              if (!reduced) Positioned.fromRect(rect: rect, child: Center(child: _tip(context, _time.value * _time.duration!.inMilliseconds))),
            ],
          );
        },
      ),
    );
  }

  /// Down on the tray, drawn up 110 px and lifted off, as client_web's
  /// GestureHint `drag` does it, at [ms] into the cue
  Widget _tip(BuildContext context, double ms) {
    final into = ms - _delayMs;
    final pass = into < _passMs + _gapMs ? into : into - _passMs - _gapMs;
    final u = (pass / _passMs).clamp(0.0, 1.0);
    const times = [0.0, 0.1, 0.65, 0.78];
    final y = tipKeyframe(times, const [0, 0, -110, -110], u);
    final opacity = into < 0 ? 0.0 : tipKeyframe(times, const [0, 1, 1, 0], u);
    final scale = tipKeyframe(times, const [1.25, 0.9, 0.9, 1.2], u);
    final ink = context.theme.colors.slabInk;
    return Transform.translate(
      offset: Offset(0, y),
      child: Opacity(
        opacity: opacity.clamp(0.0, 1.0),
        child: Transform.scale(
          scale: scale,
          child: Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: ink.withValues(alpha: 0.75),
              // A soft halo round it, readable on a photo or on the page
              boxShadow: [BoxShadow(color: ink.withValues(alpha: 0.25), spreadRadius: 8), ...Ninja.slabShadow],
            ),
          ),
        ),
      ),
    );
  }
}

/// A value along keyframes at [times] (0 to 1), each step eased in and out,
/// holding the last past the end
double tipKeyframe(List<double> times, List<double> values, double u) {
  if (u <= times.first) return values.first;
  for (var i = 1; i < times.length; i++) {
    if (u <= times[i]) {
      final s = Curves.easeInOut.transform((u - times[i - 1]) / (times[i] - times[i - 1]));
      return values[i - 1] + (values[i] - values[i - 1]) * s;
    }
  }
  return values.last;
}

/// The cue's line in the dock's colours: a slab pill with an arrow up
class _Bubble extends StatelessWidget {
  const _Bubble();

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final c = theme.colors;
    return Semantics(
      liveRegion: true,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: ShapeDecoration(color: c.slab, shape: const StadiumBorder(), shadows: Ninja.slabShadow),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(LucideIcons.arrowUp, size: 14, color: c.slabInk),
            const SizedBox(width: 6),
            Flexible(
              child: Text(
                AppLocalizations.of(context)!.ninjaHintTray,
                style: context.localeText(theme.typography.caption.copyWith(color: c.slabInk, fontWeight: FontWeight.w600)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../motion/motion.dart';
import '../theme/ninja_theme.dart';
import '../theme/theme_provider.dart';

// The first-visit gestures (client_web's components/ninja/gestures/): each
// shown once on this device, one at a time across the app, a fingertip acting
// it out over what it is about and a line of words saying it.

/// The gestures a first visit is shown: the deck's swipe, its pinch to the
/// whole menu, holding a card to add it, and pulling the order out of the tray
enum HintKey { swipe, zoom, holdAdd, tray }

/// Where the shown ones are kept on this device (the web's localStorage key)
const hintsStorageKey = 'ninja-style-hints';

/// Where the tray's cue was kept on its own before it joined the others: a
/// phone that saw it there is not shown it again
const legacyTrayHintKey = 'ninja-hint-tray';

/// Which cues this device has been shown. Kept in the app's preferences;
/// when they are missing or refuse, the app's own memory stands in, so a cue
/// shows at most once a run. Until [load] has read them nothing is pending,
/// so a cue never shows twice for being asked before they were read.
class HintBook {
  final Set<String> _session = {};
  Set<String>? _stored;
  Future<void>? _loading;

  /// Whether the device's list has been read
  bool get loaded => _stored != null;

  /// Reads the device's list, once
  Future<void> load() => _loading ??= () async {
    try {
      final prefs = await SharedPreferences.getInstance();
      // Any shown before it was read stay shown
      final stored = _stored = {...?_stored, ...?prefs.getStringList(hintsStorageKey)};
      // The tray's old place, read once into the list and let go
      if (prefs.getBool(legacyTrayHintKey) ?? false) {
        stored.add(HintKey.tray.name);
        await prefs.setStringList(hintsStorageKey, [...stored]);
        await prefs.remove(legacyTrayHintKey);
      }
    } catch (_) {
      _stored ??= {};
    }
  }();

  bool seen(HintKey key) => _session.contains(key.name) || (_stored?.contains(key.name) ?? false);

  void markSeen(HintKey key) {
    _session.add(key.name);
    final stored = _stored ??= {};
    if (!stored.add(key.name)) return;
    unawaited(() async {
      try {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setStringList(hintsStorageKey, [...stored]);
      } catch (_) {
        // The run's memory already has it
      }
    }());
  }

  /// Forgets what was read and shown this run (tests)
  @visibleForTesting
  void reset() {
    _session.clear();
    _stored = null;
    _loading = null;
  }
}

/// The book the app uses
final hintBook = HintBook();

/// The cue on screen, one at a time across the app: the menu's swipe, pinch
/// and hold and the tray's pull each wait for the one showing to end
final cueOnScreen = ValueNotifier<HintKey?>(null);

/// One first-visit cue (the web's useHint). [pending] until it has been
/// shown or the customer has done the gesture themselves; [show] records it
/// at once, so leaving mid-cue does not replay it, and [done] hides it.
/// [show] does nothing while another cue is on screen: this one stays
/// pending, and its owner asks again when its moment comes round.
class Hint extends ChangeNotifier {
  final HintKey key;
  final HintBook book;
  bool _pending = false;
  bool _showing = false;
  bool _disposed = false;

  Hint(this.key, {HintBook? book}) : book = book ?? hintBook {
    if (this.book.loaded) {
      _pending = !this.book.seen(key);
    } else {
      this.book.load().then((_) {
        if (_disposed) return;
        _pending = !this.book.seen(key);
        if (_pending) notifyListeners();
      });
    }
  }

  bool get pending => _pending;
  bool get showing => _showing;

  void show() {
    if (!_pending || _showing) return;
    final onScreen = cueOnScreen.value;
    if (onScreen != null && onScreen != key) return;
    cueOnScreen.value = key;
    book.markSeen(key);
    _showing = true;
    notifyListeners();
  }

  void done() {
    if (!_pending && !_showing) return;
    book.markSeen(key);
    _pending = false;
    _showing = false;
    if (cueOnScreen.value == key) cueOnScreen.value = null;
    notifyListeners();
  }

  /// Starts a test over: the cue not yet shown, or already seen
  @visibleForTesting
  void debugReset({bool seen = false}) {
    _pending = !seen;
    _showing = false;
    if (cueOnScreen.value == key) cueOnScreen.value = null;
    notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    // A page left mid-cue lets the next one show
    if (cueOnScreen.value == key) cueOnScreen.value = null;
    super.dispose();
  }
}

/// The gestures a fingertip acts out
enum GestureKind { swipe, pinch, hold, drag }

/// One pass of each gesture: the swipe and the pinch the same as the deck's own demo
Duration gesturePass(GestureKind kind) => Duration(
  milliseconds: switch (kind) {
    GestureKind.swipe => 1600,
    GestureKind.pinch => 2200,
    GestureKind.hold => 1600,
    GestureKind.drag => 1400,
  },
);

/// The pause between the two passes
const gestureGap = Duration(milliseconds: 500);

/// When the demo starts, after the cue shows
const gestureDelay = Duration(milliseconds: 200);

/// The whole demo: the start, both passes and the pause between them
Duration gestureRun(GestureKind kind) => gestureDelay + gesturePass(kind) * 2 + gestureGap;

/// How long a cue stays up: the demo and a breath after it
Duration gestureShown(GestureKind kind) => gestureRun(kind) + const Duration(milliseconds: 300);

/// How far through a pass the demo is [elapsed] after it began (twice, with
/// the pause between them held at a pass's end): 0 to 1
double gesturePassAt(GestureKind kind, Duration elapsed) {
  final pass = gesturePass(kind).inMicroseconds;
  var t = (elapsed - gestureDelay).inMicroseconds;
  if (t <= 0) return 0;
  if (t <= pass) return t / pass;
  t -= pass + gestureGap.inMicroseconds;
  if (t <= 0) return 1;
  return math.min(1, t / pass);
}

/// A value moved through [values] at [times] (shares of the pass), eased in
/// and out between each pair, as the web's keyframes are
double keyframes(List<double> values, List<double> times, double p) {
  if (p <= times.first) return values.first;
  for (var i = 1; i < times.length; i++) {
    if (p <= times[i]) {
      final span = times[i] - times[i - 1];
      final local = span <= 0 ? 1.0 : (p - times[i - 1]) / span;
      return values[i - 1] + (values[i] - values[i - 1]) * Curves.easeInOut.transform(local.clamp(0.0, 1.0));
    }
  }
  return values.last;
}

/// A first-visit gesture shown the way a hand would do it: fingertips on the
/// glass pressing, dragging, pinching or holding, in step with the demo the
/// page plays itself (the deck nudged up, breathed out, a card's ring
/// filling). Each runs twice. Under reduced motion there is no demo to act
/// out, so the words beside it carry the cue alone. Put it over the area the
/// gesture is about; it does not take touches.
class GestureHint extends StatefulWidget {
  final GestureKind kind;

  const GestureHint({super.key, required this.kind});

  @override
  State<GestureHint> createState() => _GestureHintState();
}

class _GestureHintState extends State<GestureHint> with SingleTickerProviderStateMixin {
  late final AnimationController _run;

  @override
  void initState() {
    super.initState();
    _run = AnimationController(vsync: this, duration: gestureRun(widget.kind))..forward();
  }

  @override
  void dispose() {
    _run.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (reduceMotion(context)) return const SizedBox.shrink();
    return IgnorePointer(
      child: ExcludeSemantics(
        child: AnimatedBuilder(
          animation: _run,
          builder: (context, _) {
            final p = gesturePassAt(widget.kind, _run.duration! * _run.value);
            double k(List<double> values, List<double> times) => keyframes(values, times, p);
            final tips = switch (widget.kind) {
              // Up with the deck's long nudge, then a shorter flick with its second
              GestureKind.swipe => [
                _Tip(
                  offset: Offset(0, k([70, 70, -70, -70, 40, 40, -20, -20], _swipeTimes)),
                  opacity: k([0, 1, 1, 0, 0, 1, 1, 0], _swipeTimes),
                  scale: k([1.25, 0.9, 0.9, 1.2, 1.25, 0.9, 0.9, 1.2], _swipeTimes),
                ),
              ],
              // Two fingers closing as the deck breathes out to the whole menu, lifting while it breathes back in
              GestureKind.pinch => [
                for (final side in const [-1.0, 1.0])
                  _Tip(
                    offset: Offset(
                      k([side * 95, side * 95, side * 30, side * 30], _pinchTimes),
                      k([side * -60, side * -60, side * -18, side * -18], _pinchTimes),
                    ),
                    opacity: k([0, 1, 1, 0], _pinchTimes),
                    scale: k([1.25, 0.9, 0.9, 1.2], _pinchTimes),
                  ),
              ],
              // Down on the card and kept there while its ring fills, then up
              GestureKind.hold => [
                _Tip(
                  offset: Offset.zero,
                  opacity: k([0, 1, 1, 0], _holdTimes),
                  scale: k([1.3, 0.85, 0.85, 1.25], _holdTimes),
                  ring: k([0, 0, 1, 1], _holdTimes),
                ),
              ],
              // On the tray and up, the way the order is pulled out of it
              GestureKind.drag => [
                _Tip(offset: Offset(0, k([0, 0, -110, -110], _dragTimes)), opacity: k([0, 1, 1, 0], _dragTimes), scale: k([1.25, 0.9, 0.9, 1.2], _dragTimes)),
              ],
            };
            return Stack(alignment: Alignment.center, children: tips);
          },
        ),
      ),
    );
  }
}

const List<double> _swipeTimes = [0, 0.06, 0.3, 0.38, 0.5, 0.56, 0.75, 0.82];
const List<double> _pinchTimes = [0, 0.06, 0.32, 0.42];
const List<double> _holdTimes = [0, 0.1, 0.82, 1.0];
const List<double> _dragTimes = [0, 0.1, 0.65, 0.78];

/// A fingertip on the glass: a soft disc with a halo, readable on a photo or on the page
class _Tip extends StatelessWidget {
  static const size = 48.0;

  final Offset offset;
  final double opacity;
  final double scale;

  /// The hold's time drawn round the fingertip, 0 to 1; none without
  final double? ring;

  const _Tip({required this.offset, required this.opacity, required this.scale, this.ring});

  @override
  Widget build(BuildContext context) {
    final glass = Colors.white;
    return Transform.translate(
      offset: offset,
      child: Opacity(
        opacity: opacity.clamp(0.0, 1.0),
        child: Transform.scale(
          scale: scale,
          child: SizedBox.square(
            dimension: size + 16,
            child: CustomPaint(
              painter: ring == null ? null : _TipRing(ring!, glass),
              child: Center(
                child: Container(
                  width: size,
                  height: size,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: glass.withValues(alpha: 0.75),
                    boxShadow: [
                      BoxShadow(color: glass.withValues(alpha: 0.25), spreadRadius: 8),
                      const BoxShadow(color: Ninja.sheetScrim, offset: Offset(0, 6), blurRadius: 20),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _TipRing extends CustomPainter {
  final double t;
  final Color color;

  _TipRing(this.t, this.color);

  @override
  void paint(Canvas canvas, Size size) {
    if (t <= 0) return;
    canvas.drawArc(
      Rect.fromCircle(center: size.center(Offset.zero), radius: size.width / 2 - 2),
      -math.pi / 2,
      2 * math.pi * t.clamp(0.0, 1.0),
      false,
      Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3
        ..strokeCap = StrokeCap.round,
    );
  }

  @override
  bool shouldRepaint(_TipRing old) => old.t != t;
}

/// The spring a cue's words rise in on
final _bubbleSpring = SpringCurve(const SpringDescription(mass: 1, stiffness: 420, damping: 30));

/// A one-line cue in the dock's colours, an icon before its words. It rises
/// in; under reduced motion it only fades. Its leaving is its owner's (an
/// [AnimatedSwitcher]).
class HintBubble extends StatelessWidget {
  final IconData icon;
  final String text;

  const HintBubble({super.key, required this.icon, required this.text});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final c = theme.colors;
    final reduced = reduceMotion(context);
    final bubble = Semantics(
      liveRegion: true,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width - 48),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: ShapeDecoration(color: c.slab, shape: const StadiumBorder(), shadows: Ninja.ctaShadow),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 14, color: c.slabInk),
              const SizedBox(width: 6),
              Flexible(
                child: Text(
                  text,
                  style: context.localeText(theme.typography.caption.copyWith(fontWeight: FontWeight.w600, color: c.slabInk)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
    return IgnorePointer(
      child: TweenAnimationBuilder<double>(
        tween: Tween(begin: 0, end: 1),
        duration: reduced ? Motion.fast : _bubbleSpring.duration,
        curve: reduced ? Curves.linear : _bubbleSpring,
        child: bubble,
        builder: (context, v, child) => Opacity(
          opacity: v.clamp(0.0, 1.0),
          child: reduced
              ? child
              : Transform.translate(
                  offset: Offset(0, 8 * (1 - v)),
                  child: Transform.scale(scale: 0.96 + 0.04 * v, child: child),
                ),
        ),
      ),
    );
  }
}

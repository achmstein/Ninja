import 'dart:math' as math;
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/physics.dart';
import 'package:flutter/services.dart';
import '../../../core/motion/motion.dart';
import '../../../core/ui/ui.dart';
import 'tray_hint.dart';
import 'tray_model.dart';
import 'tray_seats.dart';

/// A dish's photo on its way into the tray
class TrayFlight {
  final int id;
  final Rect from;

  /// The corner of what it took off from: its clip starts there
  final double radius;

  /// The photo, or null for a dish without one (the business's colour flies instead)
  final String? photo;

  /// What happens as it lands: the dish goes into the order then, not before
  final VoidCallback land;

  const TrayFlight({required this.id, required this.from, required this.radius, required this.photo, required this.land});
}

/// The photos in the air (client_web's flights.tsx), where they land (the
/// tray's first thumbnail, [target]), and the tray's nudge as each lands
/// ([bump]). One for the app.
class TrayFlights extends ChangeNotifier {
  final List<TrayFlight> _flights = [];
  int _next = 0;

  /// Goes up by one each time a dish lands, to give the tray its nudge
  final ValueNotifier<int> bump = ValueNotifier(0);

  /// The tray's first thumbnail's place
  final GlobalKey target = GlobalKey(debugLabel: 'tray-target');

  /// Layers drawing the flights; with none (a test), a dish lands at once
  int _layers = 0;

  List<TrayFlight> get flights => List.unmodifiable(_flights);
  bool get inFlight => _flights.isNotEmpty;

  /// Flies a photo from [from] into the tray and runs [land] as it gets
  /// there; with nowhere to fly from (or less motion wanted) it lands at once
  void fly({required Rect? from, double radius = 20, String? photo, required VoidCallback land, bool reduced = false}) {
    if (from == null || from.isEmpty || reduced || _layers == 0) {
      land();
      _landed();
      return;
    }
    _flights.add(TrayFlight(id: ++_next, from: from, radius: radius, photo: photo, land: land));
    notifyListeners();
  }

  void _arrive(int id) {
    final i = _flights.indexWhere((f) => f.id == id);
    if (i < 0) return;
    final flight = _flights.removeAt(i);
    flight.land();
    _landed();
    notifyListeners();
  }

  void _landed() {
    HapticFeedback.lightImpact();
    bump.value++;
  }
}

final trayFlights = TrayFlights();

/// Every photo in the air, over the whole app
class TrayFlightLayer extends StatefulWidget {
  final Widget child;

  const TrayFlightLayer({super.key, required this.child});

  @override
  State<TrayFlightLayer> createState() => _TrayFlightLayerState();
}

class _TrayFlightLayerState extends State<TrayFlightLayer> {
  @override
  void initState() {
    super.initState();
    trayFlights._layers++;
  }

  @override
  void dispose() {
    trayFlights._layers--;
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Stack(
    children: [
      widget.child,
      Positioned.fill(
        child: IgnorePointer(
          child: Stack(
            children: [
              // The dishes' circles between the dock and the open order's rows
              const Positioned.fill(child: TraySeatLayer()),
              // The first dish's cue on how to open the order
              const Positioned.fill(child: TrayHintLayer()),
              Positioned.fill(
                child: ListenableBuilder(
                  listenable: trayFlights,
                  builder: (context, _) => Stack(
                    clipBehavior: Clip.none,
                    children: [for (final f in trayFlights.flights) _Flight(key: ValueKey(f.id), flight: f)],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    ],
  );
}

/// Where the tray's first thumbnail is, or will be once its row is up
Rect _target(BuildContext context) {
  final box = trayFlights.target.currentContext?.findRenderObject() as RenderBox?;
  if (box != null && box.attached && box.hasSize) {
    final origin = box.localToGlobal(Offset.zero);
    return Rect.fromLTWH(origin.dx, origin.dy + (box.size.height - 44) / 2, 44, 44);
  }
  // The row is still growing: where its first photo will sit
  final media = MediaQuery.of(context);
  final metrics = DockMetrics.of(media.size.height);
  final bottom = math.max(DockMetrics.inset, media.viewPadding.bottom) + metrics.tabs;
  final top = media.size.height - bottom - metrics.row + (metrics.row - 44) / 2;
  final rtl = Directionality.of(context) == TextDirection.rtl;
  final width = math.min(media.size.width, Ninja.maxWidth);
  final left = (media.size.width - width) / 2 + DockMetrics.inset + 24;
  return Rect.fromLTWH(rtl ? media.size.width - left - 44 : left, top, 44, 44);
}

/// The photo of a dish just added: it starts exactly over the photo it came
/// from, corners and all; on the first part of the way it closes into a
/// centred circle and rises a little, then comes down into the tray at the
/// thumbnail's size
class _Flight extends StatefulWidget {
  final TrayFlight flight;

  const _Flight({super.key, required this.flight});

  @override
  State<_Flight> createState() => _FlightState();
}

class _FlightState extends State<_Flight> with SingleTickerProviderStateMixin {
  static const _ease = Cubic(0.3, 0, 0.2, 1);
  static const _turn = 0.45;

  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 620))
    ..forward().whenComplete(() => trayFlights._arrive(widget.flight.id));

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  /// Two legs, each eased (motion's keyframes with one ease)
  (int, double) _leg(double u) => u < _turn ? (0, _ease.transform(u / _turn)) : (1, _ease.transform((u - _turn) / (1 - _turn)));

  @override
  Widget build(BuildContext context) {
    final f = widget.flight;
    final c = context.theme.colors;
    return AnimatedBuilder(
      animation: _c,
      builder: (context, _) {
        final to = _target(context);
        final from = f.from;
        final dx = to.center.dx - from.center.dx;
        final dy = to.center.dy - from.center.dy;
        final side = math.min(from.width, from.height);
        final scale = side > 0 ? to.width / side : 1.0;
        final lift = math.min(90.0, dy.abs() * 0.25);
        final (leg, s) = _leg(_c.value);
        double two(double a, double b, double end) => leg == 0 ? a + (b - a) * s : b + (end - b) * s;
        final x = two(0, dx * 0.45, dx);
        final y = two(0, dy * 0.3 - lift, dy);
        final k = two(1, math.max(scale, 0.35), scale);
        // The clip closes into the largest circle the photo holds, on the first leg
        final close = leg == 0 ? s : 1.0;
        final clipW = from.width + (side - from.width) * close;
        final clipH = from.height + (side - from.height) * close;
        final radius = f.radius + (side / 2 - f.radius) * close;
        final plate = ColoredBox(
          color: c.primary,
          child: Center(child: Icon(LucideIcons.utensilsCrossed, color: c.primaryForeground.withValues(alpha: 0.6))),
        );
        return Positioned.fromRect(
          rect: from,
          child: Transform.translate(
            offset: Offset(x, y),
            child: Transform.scale(
              scale: k,
              child: Center(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(radius),
                  child: SizedBox(
                    width: clipW,
                    height: clipH,
                    child: OverflowBox(
                      maxWidth: from.width,
                      maxHeight: from.height,
                      child: SizedBox(
                        width: from.width,
                        height: from.height,
                        child: f.photo == null ? plate : CachedNetworkImage(imageUrl: f.photo!, fit: BoxFit.cover, errorWidget: (_, _, _) => plate),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

/// The tray's nudge as a dish lands in it: a little swell that springs back
class TrayBump extends StatefulWidget {
  final Widget child;

  const TrayBump({super.key, required this.child});

  @override
  State<TrayBump> createState() => _TrayBumpState();
}

class _TrayBumpState extends State<TrayBump> with SingleTickerProviderStateMixin {
  late final AnimationController _scale = AnimationController.unbounded(vsync: this, value: 1);

  @override
  void initState() {
    super.initState();
    trayFlights.bump.addListener(_bump);
  }

  @override
  void dispose() {
    trayFlights.bump.removeListener(_bump);
    _scale.dispose();
    super.dispose();
  }

  void _bump() {
    if (reduceMotion(context)) return;
    _scale.value = 1.18;
    _scale.animateWith(SpringSimulation(const SpringDescription(mass: 1, stiffness: 500, damping: 14), 1.18, 1, 0));
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: _scale,
    child: widget.child,
    builder: (context, child) => Transform.scale(scale: _scale.value, child: child),
  );
}

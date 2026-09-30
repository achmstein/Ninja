import 'package:flutter/animation.dart';
import 'package:flutter/physics.dart';

/// A spring from rest at 0 to rest at 1, as a curve over the time it takes
/// to settle: for what runs on a duration (a route's transition) but should
/// move as the web's springs do. [duration] is that time.
class SpringCurve extends Curve {
  final SpringDescription spring;
  late final SpringSimulation _simulation = SpringSimulation(spring, 0, 1, 0, tolerance: const Tolerance(distance: 0.001, velocity: 0.01));
  late final double _seconds = _settle();

  SpringCurve(this.spring);

  double _settle() {
    var t = 0.0;
    while (t < 3 && !_simulation.isDone(t)) {
      t += 1 / 240;
    }
    return t;
  }

  /// How long the spring takes to settle
  Duration get duration => Duration(microseconds: (_seconds * 1e6).round());

  @override
  double transformInternal(double t) => _simulation.x(t * _seconds);
}

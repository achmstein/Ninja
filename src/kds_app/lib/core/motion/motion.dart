// The motion language of the till and the kitchen display, shared file for
// file between pos_app and kds_app (keep the copies identical), with the
// same numbers as client_web's src/lib/motion.ts.
//
// One element changes shape instead of cutting to another; springs land
// with at most a hair of overshoot; every step is 150–350 ms and nothing
// holds the hand that tapped. Only transform, opacity and size move, and
// nothing ticks while the screen is still. Reduce motion (the platform's
// "remove animations") leaves plain fades.
import 'package:flutter/widgets.dart';

export 'morph_button.dart';
export 'reflow.dart';
export 'rolling_number.dart';
export 'slide_in_item.dart';

abstract final class Motion {
  /// A colour, a tick, a press
  static const fast = Duration(milliseconds: 150);

  /// Most changes of state
  static const base = Duration(milliseconds: 250);

  /// Things that travel: an entrance, a collapse
  static const slow = Duration(milliseconds: 350);

  /// Arriving: quick off the mark, a long soft landing
  static const Curve enter = Cubic(0.16, 1, 0.3, 1);

  /// Leaving: gathers pace and goes
  static const Curve exit = Cubic(0.4, 0, 1, 1);

  /// From one place to another, both ends eased
  static const Curve move = Cubic(0.65, 0, 0.35, 1);

  /// Damping ratio ≈ 0.93: settles in about 200 ms with a barely-there
  /// overshoot, the "it clicked into place" feel. Never bouncy.
  static const spring = SpringDescription(mass: 1, stiffness: 420, damping: 38);

  /// The same character, slower, for things that travel further
  static const springSoft = SpringDescription(mass: 1, stiffness: 260, damping: 30);

  /// For springs measured in pixels: done within half a pixel
  static const pixelTolerance = Tolerance(distance: 0.5, velocity: 5);
}

/// The platform asked for less motion: fades only, no travel, no shake.
bool reduceMotion(BuildContext context) => MediaQuery.maybeDisableAnimationsOf(context) ?? false;

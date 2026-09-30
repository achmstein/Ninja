// The motion language of the customer app: the same numbers as client_web's
// src/lib/motion.ts and as the till's and the kitchen display's copies
// (pos_app / kds_app lib/core/motion/motion.dart), plus the springs only
// the customer app's dock, tray and sheets use.
//
// One element changes shape instead of cutting to another; springs land
// with at most a hair of overshoot; every step is 150–350 ms and nothing
// holds the hand that tapped. Only transform, opacity and size move, and
// nothing ticks while the screen is still. Reduce motion (the platform's
// "remove animations") leaves plain fades.
import 'package:flutter/widgets.dart';

export 'blur_swap.dart';
export 'rolling_number.dart';
export 'slide_in_item.dart';
export 'spring_curve.dart';

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

  /// A view opening out of what it came from: quick and firm
  static const springOpen = SpringDescription(mass: 1, stiffness: 380, damping: 36);

  /// The tray's order sheet rising out of the dock
  static const springTray = SpringDescription(mass: 1, stiffness: 420, damping: 40);

  /// The liquid pill: its leading edge darts, its trailing edge follows
  static const pillLead = SpringDescription(mass: 0.7, stiffness: 520, damping: 38);
  static const pillTrail = SpringDescription(mass: 0.9, stiffness: 190, damping: 24);

  /// For springs measured in pixels: done within half a pixel
  static const pixelTolerance = Tolerance(distance: 0.5, velocity: 5);
}

/// The platform asked for less motion: fades only, no travel, no shake.
bool reduceMotion(BuildContext context) => MediaQuery.maybeDisableAnimationsOf(context) ?? false;

/// How long an order has been in the kitchen decides the colour of its
/// clock and border: amber once it has waited longer than a drink should
/// take, red once it is the order someone is about to ask about. Same
/// tiers as kds_web's status.ts.
const int warnAfterMinutes = 5;
const int delayedAfterMinutes = 10;

enum OrderUrgency { fresh, warning, delayed }

OrderUrgency orderUrgency(DateTime? since, DateTime now) {
  if (since == null) return OrderUrgency.fresh;
  final minutes = now.difference(since).inMilliseconds / 60000;
  if (minutes >= delayedAfterMinutes) return OrderUrgency.delayed;
  if (minutes >= warnAfterMinutes) return OrderUrgency.warning;
  return OrderUrgency.fresh;
}

/// Elapsed time as a kitchen clock: `4:12` under an hour, `1h 05m` past it.
/// Seconds matter on a board that is glanced at, not read.
String formatElapsed(DateTime? from, DateTime now) {
  if (from == null) return '';
  var total = now.difference(from).inSeconds;
  if (total < 0) total = 0;
  final hours = total ~/ 3600;
  final minutes = (total % 3600) ~/ 60;
  final seconds = total % 60;
  if (hours > 0) return '${hours}h ${minutes.toString().padLeft(2, '0')}m';
  return '$minutes:${seconds.toString().padLeft(2, '0')}';
}

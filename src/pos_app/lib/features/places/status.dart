import 'package:flutter/widgets.dart';
import '../../core/models/localized_text.dart';
import 'models/place.dart';

/// `hh:mm:ss`, never negative
String formatClock(double totalSeconds) {
  final s = totalSeconds < 0 ? 0 : totalSeconds.floor();
  String two(int v) => v.toString().padLeft(2, '0');
  return '${two(s ~/ 3600)}:${two((s % 3600) ~/ 60)}:${two(s % 60)}';
}

/// `mm:ss` — a countdown short enough to drop the hours
String formatCountdown(double totalSeconds) => formatClock(totalSeconds).substring(3);

extension StayState on Stay {
  bool get isRunning => status == StayStatus.running;
  bool get isHeld => status == StayStatus.held;

  /// Seconds since the timer started
  double elapsedSeconds(DateTime now) =>
      startedAt == null ? 0 : now.difference(startedAt!).inMilliseconds / 1000;

  /// Seconds spent on one rate option across the stay's segments
  double optionSeconds(String code, DateTime now) {
    var sum = 0.0;
    for (final segment in segments) {
      if (segment.optionCode != code) continue;
      final end = segment.endTime ?? now;
      sum += end.difference(segment.startTime).inMilliseconds / 1000;
    }
    return sum;
  }

  /// The options that have been used at all, in tariff order
  List<RateOption> usedOptions(DateTime now) =>
      [for (final o in options) if (optionSeconds(o.code, now) > 0) o];

  /// The server bills in rounding steps and puts the rounded figures on
  /// the stay once a segment closes; read them rather than estimating
  double get billedHours => costs.fold(0.0, (sum, c) => sum + c.hours);

  /// What the stay would cost if it ended this second: every segment, the
  /// running one included, rounded the way the server rounds when the
  /// segment closes, at the tariff's rate for its option. The bill only
  /// gets the real figure when the clock stops; this is the cashier's
  /// preview.
  StayEstimate estimate(DateTime now) {
    final lines = [
      for (final o in options)
        (
          option: o,
          hours: roundedHours(optionSeconds(o.code, now), roundingMinutes),
        ),
    ];
    return StayEstimate(
      lines: [for (final l in lines) (option: l.option, hours: l.hours, amount: l.hours * l.option.hourlyRate)],
    );
  }

  /// Seconds until a hold lapses, null when it never does
  double? secondsUntilExpiry(DateTime now) =>
      expiresAt == null ? null : (expiresAt!.difference(now).inMilliseconds / 1000).clamp(0, double.infinity);

  /// The people there as the customer picker offers them: everyone on the
  /// roster who has an account. A member with no name still shows; the
  /// picker labels the blank.
  List<({String id, String name})> get roster => [
        for (final member in members)
          if (member.customerId.isNotEmpty) (id: member.customerId, name: member.customerName ?? ''),
      ];
}

class StayEstimate {
  final List<({RateOption option, double hours, double amount})> lines;
  const StayEstimate({required this.lines});
  double get hours => lines.fold(0.0, (sum, l) => sum + l.hours);
  double get amount => lines.fold(0.0, (sum, l) => sum + l.amount);
}

/// The server's rounding, in the open: minutes to the nearest step of the
/// tariff (a quarter hour by default), halves away from zero.
double roundedHours(double seconds, [int roundingMinutes = 15]) {
  final minutes = seconds / 60;
  if (minutes <= 0) return 0;
  return (minutes / roundingMinutes).round() * roundingMinutes / 60;
}

/// 1.25 → "1.25", 1.5 → "1.5", 2 → "2"
String hoursText(double hours) {
  if (hours == hours.roundToDouble()) return hours.toStringAsFixed(0);
  return hours.toStringAsFixed(2).replaceFirst(RegExp(r'0+$'), '');
}

/// The name of a rate option, as the screen shows it
String optionLabel(BuildContext context, List<RateOption> options, String? code) =>
    options.where((o) => o.code == code).firstOrNull?.name.localized(context) ?? (code ?? '');

/// The rates as one line: "Single 50 · Multi 80" or the one rate
String tariffLine(BuildContext context, List<RateOption> options, String Function(double) money) {
  if (options.isEmpty) return '';
  if (options.length == 1) return money(options.first.hourlyRate);
  return options.map((o) => '${o.name.localized(context)} ${money(o.hourlyRate)}').join(' · ');
}


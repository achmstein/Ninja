import '../../l10n/app_localizations.dart';
import 'models/room.dart';

/// `hh:mm:ss`, never negative
String formatClock(double totalSeconds) {
  final s = totalSeconds < 0 ? 0 : totalSeconds.floor();
  String two(int v) => v.toString().padLeft(2, '0');
  return '${two(s ~/ 3600)}:${two((s % 3600) ~/ 60)}:${two(s % 60)}';
}

/// `mm:ss` — a countdown short enough to drop the hours
String formatCountdown(double totalSeconds) => formatClock(totalSeconds).substring(3);

extension SessionState on RoomSession {
  bool get isActive => status == SessionStatus.active;
  bool get isReserved => status == SessionStatus.reserved;

  /// Seconds since the timer started
  double elapsedSeconds(DateTime now) =>
      startTime == null ? 0 : now.difference(startTime!).inMilliseconds / 1000;

  /// Seconds spent in one player mode across the session's segments
  double modeSeconds(String mode, DateTime now) {
    var sum = 0.0;
    for (final segment in segments) {
      if (segment.playerMode != mode) continue;
      final end = segment.endTime ?? now;
      sum += end.difference(segment.startTime).inMilliseconds / 1000;
    }
    return sum;
  }

  /// The server bills in quarter-hour steps and puts the rounded figures on
  /// the session once a segment closes; read them rather than estimating
  double get billedHours => (singleRoundedHours ?? 0) + (multiRoundedHours ?? 0);

  /// What the session would cost if it ended this second: every segment,
  /// the running one included, rounded the way the server rounds when the
  /// segment closes, at the room's rate for its mode. The bill only gets
  /// the real figure when the session ends; this is the cashier's preview.
  SessionEstimate estimate(DateTime now) {
    final singleHours = roundedHours(modeSeconds('Single', now));
    final multiHours = roundedHours(modeSeconds('Multi', now));
    return SessionEstimate(
      singleHours: singleHours,
      multiHours: multiHours,
      amount: singleHours * singleRate + multiHours * multiRate,
    );
  }

  /// Seconds until a reservation lapses, null when it never does
  double? secondsUntilExpiry(DateTime now) =>
      expiresAt == null ? null : (expiresAt!.difference(now).inMilliseconds / 1000).clamp(0, double.infinity);

  /// The people in the room as the customer picker offers them: everyone
  /// on the roster who has an account. A member with no name still shows;
  /// the picker labels the blank.
  List<({String id, String name})> get roster => [
        for (final member in members)
          if (member.customerId.isNotEmpty) (id: member.customerId, name: member.customerName ?? ''),
      ];
}

class SessionEstimate {
  final double singleHours;
  final double multiHours;
  final double amount;
  const SessionEstimate({required this.singleHours, required this.multiHours, required this.amount});
  double get hours => singleHours + multiHours;
}

/// The server's rounding, in the open: minutes to the nearest quarter hour,
/// halves away from zero. Below seven and a half minutes nothing is billed.
double roundedHours(double seconds) {
  final minutes = seconds / 60;
  if (minutes <= 0) return 0;
  return (minutes / 15).round() / 4;
}

/// 1.25 → "1.25", 1.5 → "1.5", 2 → "2"
String hoursText(double hours) {
  if (hours == hours.roundToDouble()) return hours.toStringAsFixed(0);
  return hours.toStringAsFixed(2).replaceFirst(RegExp(r'0+$'), '');
}

String modeLabel(AppLocalizations l10n, String? mode) => mode == 'Multi' ? l10n.playerModeMulti : l10n.playerModeSingle;

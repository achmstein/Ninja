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
  /// the session; read them rather than estimating
  double get billedHours => (singleRoundedHours ?? 0) + (multiRoundedHours ?? 0);

  /// Seconds until a reservation lapses, null when it never does
  double? secondsUntilExpiry(DateTime now) =>
      expiresAt == null ? null : (expiresAt!.difference(now).inMilliseconds / 1000).clamp(0, double.infinity);

  /// Who the session is for, the way staff say it: the owner, or "walk-in"
  String who(AppLocalizations l10n) {
    for (final member in members) {
      if (member.isOwner && (member.customerName ?? '').isNotEmpty) return member.customerName!;
    }
    return (userName ?? '').isNotEmpty ? userName! : l10n.walkIn;
  }
}

/// 1.25 → "1.25", 1.5 → "1.5", 2 → "2"
String hoursText(double hours) {
  if (hours == hours.roundToDouble()) return hours.toStringAsFixed(0);
  return hours.toStringAsFixed(2).replaceFirst(RegExp(r'0+$'), '');
}

String modeLabel(AppLocalizations l10n, String? mode) => mode == 'Multi' ? l10n.playerModeMulti : l10n.playerModeSingle;

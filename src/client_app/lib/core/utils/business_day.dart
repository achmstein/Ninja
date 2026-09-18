import '../models/branch.dart';

/// When the branch's current business day started. An overnight shift
/// (17:00 → 05:00) that has not reached its start hour yet is still
/// yesterday's; a same-day shift always starts today.
DateTime businessDayStart(Branch? branch) {
  final startHour = branch?.dayStartHour ?? 17;
  final overnight = branch?.isOvernightShift ?? true;
  final now = DateTime.now();
  if (overnight && now.hour < startHour) {
    return DateTime(now.year, now.month, now.day - 1, startHour);
  }
  return DateTime(now.year, now.month, now.day, startHour);
}

/// The shift day a moment belongs to, as that day's local midnight: before
/// the start hour of an overnight shift it is the previous day's.
DateTime shiftDayOf(DateTime moment, Branch? branch) {
  final startHour = branch?.dayStartHour ?? 17;
  final overnight = branch?.isOvernightShift ?? true;
  final local = moment.toLocal();
  final day = overnight && local.hour < startHour ? local.day - 1 : local.day;
  return DateTime(local.year, local.month, day);
}

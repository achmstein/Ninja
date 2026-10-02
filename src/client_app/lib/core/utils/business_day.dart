import '../models/branch.dart';

/// When the branch's current business day started. A business day runs from
/// its start hour to the same hour the next day, whatever the hours it is
/// open: before the start hour it is still yesterday's. This held only for
/// an overnight shift before, so a day-time branch (09:00 → 23:00) put
/// "today" in the future between midnight and nine and lost what happened
/// since midnight.
DateTime businessDayStart(Branch? branch) {
  final day = shiftDayOf(DateTime.now(), branch);
  return DateTime(day.year, day.month, day.day, branch?.dayStartHour ?? 17);
}

/// The business day a moment belongs to, as that day's local midnight: before
/// the start hour it is the previous day's.
DateTime shiftDayOf(DateTime moment, Branch? branch) {
  final startHour = branch?.dayStartHour ?? 17;
  final local = moment.toLocal();
  final day = local.hour < startHour ? local.day - 1 : local.day;
  return DateTime(local.year, local.month, day);
}

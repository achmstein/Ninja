import 'dart:math' show max;

import '../../../core/models/localized_text.dart';
import '../../places/models/place.dart';
import 'bill.dart';

/// One rate the clock ran on, as the till will bill it
class RunningPart {
  final LocalizedText optionName;
  final double hours;
  final double rate;
  final double cost;

  const RunningPart({
    required this.optionName,
    required this.hours,
    required this.rate,
    required this.cost,
  });
}

/// The time a running clock has racked up on an open bill, before the till
/// stops it and it lands as a line
class RunningTime {
  /// Minutes on the clock so far
  final double minutes;
  final List<RunningPart> parts;

  /// The cost with the bill's discount and VAT on top, since that is what
  /// the total will grow by. No service: a place's time is not an order.
  final double charged;

  const RunningTime({required this.minutes, required this.parts, required this.charged});

  double get cost => parts.fold(0, (sum, part) => sum + part.cost);
}

class _Accumulated {
  final LocalizedText optionName;
  final double rate;
  double minutes = 0;

  _Accumulated(this.optionName, this.rate);
}

/// Mirrors Stay.HoursFor: the minutes on each rate, rounded to the tariff's
/// step, times that rate. Only for the stay this customer is in — anyone
/// else's clock is not theirs to see.
RunningTime? runningTime(Bill bill, Stay? stay, DateTime now) {
  if (!bill.isOpen ||
      bill.sessionId == null ||
      bill.sessionEndedAt != null ||
      stay == null ||
      stay.id != bill.sessionId ||
      stay.startedAt == null) {
    return null;
  }

  final step = stay.roundingMinutes > 0 ? stay.roundingMinutes : 15;
  final byOption = <String, _Accumulated>{};
  for (final segment in stay.segments) {
    final end = segment.endTime ?? now;
    final minutes = max(0, end.difference(segment.startTime).inSeconds / 60);
    final part = byOption.putIfAbsent(
      segment.optionCode,
      () => _Accumulated(segment.optionName, segment.hourlyRate),
    );
    part.minutes += minutes;
  }

  final parts = byOption.values.map((part) {
    final hours = (part.minutes / step).round() * step / 60;
    return RunningPart(
      optionName: part.optionName,
      hours: hours,
      rate: part.rate,
      cost: hours * part.rate,
    );
  }).toList();
  final minutes = max(0, now.difference(stay.startedAt!).inSeconds / 60).toDouble();
  final cost = parts.fold<double>(0, (sum, part) => sum + part.cost);

  // As the till bills it: the discount thins it, VAT goes on top unless
  // the prices already hold it, and service never touches time
  var charged = cost * (1 - (bill.discountRate ?? 0));
  if (!bill.vatIncluded) charged += charged * bill.vatRate;

  return RunningTime(minutes: minutes, parts: parts, charged: charged);
}

/// The bill taken apart into what is certainly the customer's and what is
/// the group's
class BillParts {
  /// What the customer's own rounds come to, at menu prices
  final double ownLines;

  /// The place's time on the bill, a running clock's time so far included
  final double time;

  /// Others are on this bill — a roster of more than one splitting the
  /// time, or rounds the till named for somebody else — so what of the
  /// total is theirs is the till's to decide at settle, not the app's to
  /// guess. Unnamed rounds do not make a bill shared.
  final bool shared;

  /// The bill's total, a running clock's time so far included
  final double total;

  const BillParts({
    required this.ownLines,
    required this.time,
    required this.shared,
    required this.total,
  });
}

/// The till says whose each round is; the place's time is nobody's until
/// the group settles it, however they agree, so the app never splits it.
/// A bill with nobody else on it is simply the total. The roster is the
/// stay's, as Spaces reports it to its members.
BillParts billParts(Bill bill, RunningTime? running, Stay? stay) {
  final ownLines = bill.lines
      .where((line) => line.isMine && !line.isTime)
      .fold<double>(0, (sum, line) => sum + line.total);
  final time = bill.lines.where((line) => line.isTime).fold<double>(0, (sum, line) => sum + line.total) +
      (running?.cost ?? 0);
  final others = bill.lines.any((line) => line.isOthers);
  final members = stay?.members.length ?? 0;
  return BillParts(
    ownLines: ownLines,
    time: time,
    shared: others || (members > 1 && (time > 0 || running != null)),
    total: bill.total + (running?.charged ?? 0),
  );
}

/// A percentage for a rate the services give as a fraction (0.14 → 14)
int percent(double? rate) => ((rate ?? 0) * 100).round();

import 'dart:math' as math;

import 'models/pay_view.dart';

/// Online payments (docs/online-payments-plan.md), the arithmetic the guest's
/// phone shows before it asks the server: what a share comes to, the fee
/// when the café passes the provider's on, and the tip. Each one mirrors
/// Sales' OnlineShares, so the summary the guest confirms is the amount the
/// server charges; the server decides in the end all the same.

/// How the server takes a share: the SplitMode enum's numbers.
enum SplitKind {
  full(0),
  items(1),
  equal(2),
  custom(3);

  final int value;
  const SplitKind(this.value);
}

/// The most people an equal split divides by (OnlineShares.MaxParts).
const maxParts = 50;

/// Two decimals, halves away from zero, like the server's Money. The nudge
/// keeps a double's 1.005 (really 1.00499…) rounding up as the decimal does.
double roundMoney(double value) {
  final cents = (value.abs() * 100 + 1e-7).roundToDouble();
  final rounded = cents / 100;
  if (rounded == 0) return 0;
  return value < 0 ? -rounded : rounded;
}

/// The guest's fee on a share when the café passes the provider's fee on:
/// solved so that what the provider keeps (a percentage of the charge plus
/// a fixed part) is what the fee covers. Zero when there is nothing to pay
/// or no fee to pass on.
double guestFee(double amountAndTip, double percent, double fixedFee) {
  if (amountAndTip <= 0 || (percent <= 0 && fixedFee <= 0)) return 0;
  final rate = percent / 100;
  if (rate >= 1) return 0;
  // charged = amount + fee, and the provider takes charged * rate + fixed
  final charged = (amountAndTip + fixedFee) / (1 - rate);
  return roundMoney(charged - amountAndTip);
}

/// Paying [parts] of [of] equal parts: rounding leaves a piaster or two on
/// the last share, and whoever pays it pays them. Never past what is left.
double equalShare(double total, double remaining, int parts, int of) {
  if (remaining <= 0 || of < 1 || parts < 1) return 0;
  var amount = roundMoney(total * parts / of);
  if (remaining - amount < 0.05) amount = remaining;
  return math.min(amount, remaining);
}

/// The lines picked, at their share of the total; the last free lines take
/// whatever is left with them, rounding and all.
double itemsShare(List<PayLine> lines, Set<int> picked, double remaining) {
  final chosen = lines.where((line) => picked.contains(line.id) && !line.claimed).toList();
  if (chosen.isEmpty || remaining <= 0) return 0;
  final amount = math.min(roundMoney(chosen.fold<double>(0, (sum, line) => sum + line.share)), remaining);
  final othersFree = lines.any((line) => !line.claimed && !picked.contains(line.id) && line.total != 0);
  return othersFree ? amount : remaining;
}

const _arabicDigits = '٠١٢٣٤٥٦٧٨٩';

/// A typed amount, as the server would take it: two decimals, or nothing
/// when it is not a positive number. Arabic digits and a comma are read too.
/// Past what is left is the caller's to refuse.
double customShare(String text) {
  final western = text.trim().replaceAll(',', '.').replaceAll('٫', '.').split('').map((c) {
    final i = _arabicDigits.indexOf(c);
    return i >= 0 ? '$i' : c;
  }).join();
  final value = double.tryParse(western);
  return value != null && value.isFinite && value > 0 ? roundMoney(value) : 0;
}

/// A tip chip's amount on a share.
double tipFor(double share, int percent) => percent > 0 ? roundMoney(share * percent / 100) : 0;

/// The confirm button's arithmetic: the share, the tip, and the fee on both.
class PaySummary {
  final double share;
  final double tip;

  /// The provider's fee the guest pays; 0 when the café absorbs it
  final double fee;

  /// What the card is charged
  final double total;

  const PaySummary({required this.share, required this.tip, required this.fee, required this.total});
}

PaySummary paySummary(double share, double tip, PayOptions options) {
  final base = roundMoney(share + tip);
  final fee = options.guestPaysFee ? guestFee(base, options.feePercent, options.feeFixed) : 0.0;
  return PaySummary(share: share, tip: tip, fee: fee, total: roundMoney(base + fee));
}

/// Whether the café takes payments at the table at all: "off" and
/// "not-set-up" hide every pay button, and the guest is not told why.
bool offersPay(String? why) => why != 'off' && why != 'not-set-up';

/// How many equal parts to start from: the room's party where the bill
/// knows it, else two.
int defaultParts(int? people) {
  final n = people ?? 0;
  return n >= 2 ? math.min(n, maxParts) : 2;
}

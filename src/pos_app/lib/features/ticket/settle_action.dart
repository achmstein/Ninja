import '../tickets/models/enums.dart';

/// What the payment page's one button does. The web till's `settleAction` is the same
enum SettleActionKind {
  /// Nothing left to take: the bill is closed as it stands
  settle,

  /// Less than what is left: one payment of several, the bill staying to be paid
  add,

  /// The rest, which closes the bill. Cash may be more than the rest: the change is handed back
  take,

  /// Nothing to do yet: a tab with no amount typed, or a nought
  none,
}

typedef SettleAction = ({SettleActionKind kind, double amount});

/// From the way of paying picked, the amount typed and what is still owed.
/// The button says it before the tap, so there is nothing to work out.
/// [entered] is null when nothing was typed, which means all that is left
/// (never for a tab: what goes on account is typed, share by share)
SettleAction settleActionFor(PaymentTender tender, double? entered, double remaining) {
  if (remaining <= 0) return (kind: SettleActionKind.settle, amount: 0);
  if (entered == null) {
    return tender == PaymentTender.account
        ? (kind: SettleActionKind.none, amount: 0)
        : (kind: SettleActionKind.take, amount: remaining);
  }
  if (!(entered > 0)) return (kind: SettleActionKind.none, amount: 0);
  if (entered < remaining) return (kind: SettleActionKind.add, amount: entered);
  // Only cash goes past what is owed; a card, InstaPay or a tab takes exactly the rest
  return (kind: SettleActionKind.take, amount: tender == PaymentTender.cash ? entered : remaining);
}

/// The notes a customer is likely to hand over in cash for what is left: what
/// it rounds up to, each once. Never the exact amount itself: that is what is
/// taken with nothing typed, so a button for it would only repeat the amount
List<double> settleCashNotes(double remaining) {
  if (remaining <= 0) return const [];
  final notes = <double>[];
  for (final step in const [50, 100, 200, 500]) {
    final note = (remaining / step).ceil() * step.toDouble();
    if (note > remaining && !notes.contains(note)) notes.add(note);
  }
  return notes;
}

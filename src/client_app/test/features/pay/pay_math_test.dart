import 'package:flutter_test/flutter_test.dart';
import 'package:ninja_client/core/models/localized_text.dart';
import 'package:ninja_client/features/pay/models/pay_view.dart';
import 'package:ninja_client/features/pay/pay_math.dart';

/// The phone's arithmetic mirrors Sales' OnlineShares, so the amount the
/// guest confirms is the amount the server charges.

PayLine _line(int id, double share, {double? total, bool claimed = false}) => PayLine(
      id: id,
      description: LocalizedText(en: 'Line $id'),
      qty: 1,
      total: total ?? share,
      share: share,
      claimed: claimed,
    );

void main() {
  group('roundMoney', () {
    test('rounds halves away from zero, like decimal', () {
      expect(roundMoney(1.005), 1.01);
      expect(roundMoney(2.675), 2.68);
      expect(roundMoney(-1.005), -1.01);
      expect(roundMoney(0.004), 0);
    });
  });

  group('guestFee', () {
    test('is solved so the provider keeps exactly what the fee covers', () {
      // charged = (100 + 3) / (1 - 0.0275) = 105.9126… → fee 5.91
      expect(guestFee(100, 2.75, 3), 5.91);
      final charged = 100 + guestFee(100, 2.75, 3);
      // What the provider keeps is within a piaster of the fee
      expect((charged * 0.0275 + 3 - guestFee(100, 2.75, 3)).abs(), lessThan(0.01));
    });

    test('a fixed fee alone is passed on grossed up by nothing', () {
      expect(guestFee(50, 0, 2), 2);
    });

    test('nothing to pay, no fee, or an impossible rate is no fee', () {
      expect(guestFee(0, 2.75, 3), 0);
      expect(guestFee(100, 0, 0), 0);
      expect(guestFee(100, 100, 0), 0);
    });
  });

  group('equalShare', () {
    test('a part of N equal parts of the total', () {
      expect(equalShare(100, 100, 1, 3), 33.33);
      expect(equalShare(100, 100, 2, 3), 66.67);
    });

    test('the last share takes the piasters rounding leaves', () {
      // Two thirds already paid (66.66), 33.34 left: the last third pays it all
      expect(equalShare(100, 33.34, 1, 3), 33.34);
    });

    test('never past what is left', () {
      expect(equalShare(100, 20, 1, 2), 20);
    });

    test('nothing left is nothing to pay', () {
      expect(equalShare(100, 0, 1, 2), 0);
    });
  });

  group('itemsShare', () {
    final lines = [_line(1, 40.5), _line(2, 30.25), _line(3, 29.25, claimed: true)];

    test('the lines picked at their share of the total', () {
      expect(itemsShare(lines, {1}, 70.75), 40.5);
    });

    test('claimed lines do not count even when picked', () {
      expect(itemsShare(lines, {1, 3}, 70.75), 40.5);
    });

    test('the last free lines take whatever is left, rounding and all', () {
      expect(itemsShare(lines, {1, 2}, 70.76), 70.76);
    });

    test('nothing picked is nothing to pay', () {
      expect(itemsShare(lines, {}, 70.75), 0);
    });
  });

  group('customShare', () {
    test('reads western and Arabic digits, with a comma or a point', () {
      expect(customShare('12.345'), 12.35);
      expect(customShare('١٢٫٥'), 12.5);
      expect(customShare('7,25'), 7.25);
    });

    test('a non-positive or unreadable amount is nothing', () {
      expect(customShare(''), 0);
      expect(customShare('-3'), 0);
      expect(customShare('abc'), 0);
    });
  });

  group('paySummary', () {
    const guestPays = PayOptions(feeMode: 'Guest', feePercent: 2.75, feeFixed: 3);
    const cafePays = PayOptions(feeMode: 'Cafe', feePercent: 2.75, feeFixed: 3);

    test('the fee is on the share and the tip together', () {
      final summary = paySummary(90, 10, guestPays);
      expect(summary.fee, guestFee(100, 2.75, 3));
      expect(summary.total, roundMoney(100 + summary.fee));
    });

    test('the café absorbing the fee charges the share and tip only', () {
      final summary = paySummary(90, 10, cafePays);
      expect(summary.fee, 0);
      expect(summary.total, 100);
    });

    test('a tip chip is a percentage of the share', () {
      expect(tipFor(85, 10), 8.5);
      expect(tipFor(85, 0), 0);
    });
  });

  test('equal splits start from the room party, else two', () {
    expect(defaultParts(null), 2);
    expect(defaultParts(1), 2);
    expect(defaultParts(4), 4);
    expect(defaultParts(80), maxParts);
  });

  test('only a café with no payments at the table hides the pay buttons', () {
    expect(offersPay('off'), isFalse);
    expect(offersPay('not-set-up'), isFalse);
    expect(offersPay('paid'), isTrue);
    expect(offersPay(null), isTrue);
  });
}

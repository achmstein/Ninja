import 'package:flutter_test/flutter_test.dart';
import 'package:kds_app/features/kitchen/status.dart';

void main() {
  final now = DateTime.utc(2026, 9, 5, 20, 0, 0);
  DateTime ago(int seconds) => now.subtract(Duration(seconds: seconds));

  group('orderUrgency', () {
    test('turns amber at five minutes and red at ten', () {
      expect(orderUrgency(ago(299), now), OrderUrgency.fresh);
      expect(orderUrgency(ago(300), now), OrderUrgency.warning);
      expect(orderUrgency(ago(599), now), OrderUrgency.warning);
      expect(orderUrgency(ago(600), now), OrderUrgency.delayed);
    });

    test('an order with no timestamp is fresh', () {
      expect(orderUrgency(null, now), OrderUrgency.fresh);
    });
  });

  group('formatElapsed', () {
    test('counts minutes and seconds under an hour', () {
      expect(formatElapsed(ago(0), now), '0:00');
      expect(formatElapsed(ago(59), now), '0:59');
      expect(formatElapsed(ago(60), now), '1:00');
      expect(formatElapsed(ago(3599), now), '59:59');
    });

    test('switches to hours and minutes past an hour', () {
      expect(formatElapsed(ago(3600), now), '1h 00m');
      expect(formatElapsed(ago(3900), now), '1h 05m');
    });

    test('never runs backwards and is blank without a timestamp', () {
      expect(formatElapsed(now.add(const Duration(seconds: 30)), now), '0:00');
      expect(formatElapsed(null, now), '');
    });
  });
}

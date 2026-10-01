import 'package:ninja_client/features/bills/widgets/bill_slip.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('hours print to two places, whole ones without a point', () {
    expect(hoursOf(50 / 60), '0.83');
    expect(hoursOf(1.25), '1.25');
    expect(hoursOf(2), '2');
    expect(hoursOf(1.999), '2');
    expect(tidyHours(0.5), 0.5);
  });
}

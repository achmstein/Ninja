import 'package:flutter_test/flutter_test.dart';
import 'package:pos_app/core/utils/natural_order.dart';

void main() {
  test('digit runs compare by value, the rest as text, case aside', () {
    final names = ['Room 10', 'room 2', 'Garden 1', 'Room 1', 'Table 3', 'اوضة 10', 'اوضة 2']..sort(naturalCompare);
    expect(names, ['Garden 1', 'Room 1', 'room 2', 'Room 10', 'Table 3', 'اوضة 2', 'اوضة 10']);
  });

  test('a shorter prefix sorts first', () {
    expect(naturalCompare('Room', 'Room 1'), lessThan(0));
    expect(naturalCompare('Room 1', 'Room 1'), 0);
  });
}

import 'package:flutter_test/flutter_test.dart';
import 'package:ninja_app_core/network/server_clock.dart';

void main() {
  final clock = ServerClock();
  tearDown(clock.reset);

  test('follows a server a minute ahead of the screen', () {
    final device = DateTime.utc(2026, 10, 2, 10);
    clock.note('Fri, 02 Oct 2026 10:01:00 GMT', receivedAt: device);
    final ahead = clock.now().difference(DateTime.now());
    expect(ahead.inSeconds, inInclusiveRange(59, 61));
  });

  test('leaves the screen alone within the header rounding', () {
    clock.note('Fri, 02 Oct 2026 10:00:00 GMT', receivedAt: DateTime.utc(2026, 10, 2, 10, 0, 0, 300));
    expect(clock.now().difference(DateTime.now()).inMilliseconds.abs(), lessThan(50));
  });

  test('ignores a missing or broken header', () {
    clock.note(null);
    clock.note('not a date');
    expect(clock.now().difference(DateTime.now()).inMilliseconds.abs(), lessThan(50));
  });

  test('is not moved by one slow answer', () {
    final device = DateTime.utc(2026, 10, 2, 10);
    clock.note('Fri, 02 Oct 2026 10:01:00 GMT', receivedAt: device);
    clock.note('Fri, 02 Oct 2026 10:01:00 GMT', receivedAt: device);
    clock.note('Fri, 02 Oct 2026 09:50:00 GMT', receivedAt: device);
    expect(clock.now().difference(DateTime.now()).inSeconds, greaterThan(58));
  });
}

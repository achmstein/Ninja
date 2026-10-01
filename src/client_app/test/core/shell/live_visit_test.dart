import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ninja_client/core/motion/motion.dart';
import 'package:ninja_client/core/shell/live_visit.dart';
import 'package:ninja_client/core/ui/ui.dart';

/// The visit tab while a place is held: the time left as a clock (client_web's formatClock), the
/// share of the hold's window left on the ring, red in the last two minutes.

Widget _host(Widget child) => MaterialApp(
      theme: materialThemeFor(NinjaTheme.neutral(Brightness.light)),
      home: Scaffold(body: Center(child: SizedBox(width: 160, height: 56, child: child))),
    );

void main() {
  test('a clock as the web writes it', () {
    expect(formatClock(0), '0:00');
    expect(formatClock(65.9), '1:05');
    expect(formatClock(600), '10:00');
    expect(formatClock(3727), '1:02:07');
    expect(formatClock(-4), '0:00');
  });

  test('the share left of the window, and the whole ring with none', () {
    final made = DateTime.utc(2026, 10, 2, 12);
    final until = made.add(const Duration(minutes: 10));
    final half = holdLeft(made, until, made.add(const Duration(minutes: 5)));
    expect(half.left, 300);
    expect(half.share, closeTo(0.5, 1e-9));
    final over = holdLeft(made, until, until.add(const Duration(minutes: 1)));
    expect(over.left, 0);
    expect(over.share, 0);
    expect(holdLeft(made, null, made), (left: null, share: 1.0));
  });

  testWidgets('counts the time down by the second, red in the last two minutes', (tester) async {
    final now = DateTime.now();
    await tester.pumpWidget(_host(LiveVisit(
      icon: LucideIcons.gamepad2,
      label: 'PS5 Room',
      made: now.subtract(const Duration(minutes: 9)),
      until: now.add(const Duration(seconds: 90)),
      ink: Colors.white,
    )));
    expect(find.byType(RollingNumber), findsOneWidget);
    final clock = tester.widget<RollingNumber>(find.byType(RollingNumber));
    expect(clock.text, matches(RegExp(r'^1:(29|30)$')));
    expect(clock.style?.color, NinjaColors.error);
    final ring = tester.widget<CustomPaint>(find.descendant(of: find.byType(LiveVisit), matching: find.byType(CustomPaint))).painter as HoldRingPainter;
    expect(ring.tone, NinjaColors.error);
    // Read out as the place
    expect(find.bySemanticsLabel('PS5 Room'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('amber with time to spare, and the name where the hold never lapses', (tester) async {
    final now = DateTime.now();
    await tester.pumpWidget(_host(LiveVisit(
      icon: LucideIcons.gamepad2,
      label: 'PS5 Room',
      made: now,
      until: now.add(const Duration(minutes: 10)),
      ink: Colors.white,
    )));
    final ring = tester.widget<CustomPaint>(find.descendant(of: find.byType(LiveVisit), matching: find.byType(CustomPaint))).painter as HoldRingPainter;
    expect(ring.tone, NinjaColors.warning);

    await tester.pumpWidget(_host(LiveVisit(icon: LucideIcons.gamepad2, label: 'PS5 Room', made: now, until: null, ink: Colors.white)));
    expect(find.byType(RollingNumber), findsNothing);
    expect(find.text('PS5 Room'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
  });
}

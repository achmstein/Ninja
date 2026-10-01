import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ninja_client/core/ui/ui.dart';
import 'package:ninja_client/features/bills/widgets/bill_swipe.dart';

/// Two open bills: one in view with a sliver of the other at its side, a
/// swipe or a tap on the sliver brings that one in, the dots say which.

Widget _host(TextDirection direction) => MaterialApp(
      theme: materialThemeFor(NinjaTheme.neutral(Brightness.light)),
      home: Directionality(
        textDirection: direction,
        child: const Scaffold(
          body: SizedBox(
            width: 390,
            child: BillSwipe(children: [
              SizedBox(height: 120, child: Text('First bill')),
              SizedBox(height: 300, child: Text('Second bill')),
            ]),
          ),
        ),
      ),
    );

/// The bill in view stands at the row's start (the left, or the right in Arabic); a sliver stands at its edge
bool _inView(WidgetTester tester, String bill, {bool rtl = false}) {
  final box = tester.getRect(find.text(bill));
  return rtl ? box.right > 300 : box.left < 90;
}

void main() {
  testWidgets('one bill in view, the next one showing at the end as a sliver; a swipe brings it in, and back', (tester) async {
    await tester.pumpWidget(_host(TextDirection.ltr));
    expect(_inView(tester, 'First bill'), isTrue);
    // The next one is there, but only its edge, at the end
    expect(tester.getRect(find.text('Second bill')).left, greaterThan(390 - 30));

    await tester.fling(find.text('First bill'), const Offset(-300, 0), 1000);
    await tester.pumpAndSettle();
    expect(_inView(tester, 'Second bill'), isTrue);
    // On the last one the sliver is the one before, at the start
    expect(tester.getRect(find.text('First bill')).right, lessThan(30));

    await tester.fling(find.text('Second bill'), const Offset(300, 0), 1000);
    await tester.pumpAndSettle();
    expect(_inView(tester, 'First bill'), isTrue);
  });

  testWidgets('a tap on the sliver brings that bill in', (tester) async {
    await tester.pumpWidget(_host(TextDirection.ltr));
    await tester.tapAt(const Offset(390 - 8, 40));
    await tester.pumpAndSettle();
    expect(_inView(tester, 'Second bill'), isTrue);
  });

  testWidgets('in Arabic the next bill comes from the left', (tester) async {
    await tester.pumpWidget(_host(TextDirection.rtl));
    expect(_inView(tester, 'First bill', rtl: true), isTrue);
    await tester.fling(find.text('First bill'), const Offset(300, 0), 1000);
    await tester.pumpAndSettle();
    expect(_inView(tester, 'Second bill', rtl: true), isTrue);
  });

  testWidgets('one bill stands alone, the full width, with no sliver and no dots', (tester) async {
    await tester.pumpWidget(MaterialApp(
      theme: materialThemeFor(NinjaTheme.neutral(Brightness.light)),
      home: const Scaffold(body: BillSwipe(children: [Text('Only bill')])),
    ));
    expect(find.text('Only bill'), findsOneWidget);
    expect(find.byType(AnimatedContainer), findsNothing);
  });
}

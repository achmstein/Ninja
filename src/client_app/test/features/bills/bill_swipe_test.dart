import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ninja_client/core/ui/ui.dart';
import 'package:ninja_client/features/bills/widgets/bill_swipe.dart';

/// Two open bills, one at a time: a swipe brings the next one in, a dot steps to one.

Widget _host(TextDirection direction) => MaterialApp(
      theme: materialThemeFor(NinjaTheme.neutral(Brightness.light)),
      home: Directionality(
        textDirection: direction,
        child: const Scaffold(
          body: BillSwipe(children: [
            SizedBox(height: 120, child: Text('First bill')),
            SizedBox(height: 300, child: Text('Second bill')),
          ]),
        ),
      ),
    );

void main() {
  testWidgets('a swipe towards the start brings the next bill in, and back', (tester) async {
    await tester.pumpWidget(_host(TextDirection.ltr));
    expect(find.text('First bill'), findsOneWidget);
    expect(find.text('Second bill'), findsNothing);

    await tester.fling(find.text('First bill'), const Offset(-300, 0), 1000);
    await tester.pumpAndSettle();
    expect(find.text('Second bill'), findsOneWidget);
    expect(find.text('First bill'), findsNothing);

    await tester.fling(find.text('Second bill'), const Offset(300, 0), 1000);
    await tester.pumpAndSettle();
    expect(find.text('First bill'), findsOneWidget);
  });

  testWidgets('in Arabic the next bill comes from the left', (tester) async {
    await tester.pumpWidget(_host(TextDirection.rtl));
    await tester.fling(find.text('First bill'), const Offset(300, 0), 1000);
    await tester.pumpAndSettle();
    expect(find.text('Second bill'), findsOneWidget);
  });

  testWidgets('one bill stands alone, with no dots', (tester) async {
    await tester.pumpWidget(MaterialApp(
      theme: materialThemeFor(NinjaTheme.neutral(Brightness.light)),
      home: const Scaffold(body: BillSwipe(children: [Text('Only bill')])),
    ));
    expect(find.text('Only bill'), findsOneWidget);
    expect(find.byType(AnimatedContainer), findsNothing);
  });
}

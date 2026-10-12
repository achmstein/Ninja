import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ninja_client/core/ui/ui.dart';
import 'package:ninja_client/features/bills/widgets/bill_swipe.dart';
import 'package:ninja_client/l10n/app_localizations.dart';

/// Two open bills: one in view the whole width, nothing of the other beside
/// it; a line over them says Bill 1 of 2, and a swipe or its steps bring the
/// other in.

Widget _host(TextDirection direction, {List<Widget>? bills}) => MaterialApp(
      locale: const Locale('en'),
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      theme: materialThemeFor(NinjaTheme.neutral(Brightness.light)),
      home: Directionality(
        textDirection: direction,
        child: Scaffold(
          body: SizedBox(
            width: 390,
            child: BillSwipe(
              children: bills ??
                  const [
                    SizedBox(height: 120, child: Text('First bill')),
                    SizedBox(height: 300, child: Text('Second bill')),
                  ],
            ),
          ),
        ),
      ),
    );

void main() {
  testWidgets('one bill in view, nothing of the other showing; the line over it says which of how many', (tester) async {
    await tester.pumpWidget(_host(TextDirection.ltr));
    expect(find.text('First bill'), findsOneWidget);
    expect(find.text('Second bill'), findsNothing);
    expect(find.text('Bill 1 of 2'), findsOneWidget);

    await tester.fling(find.text('First bill'), const Offset(-300, 0), 1000);
    await tester.pumpAndSettle();
    expect(find.text('Second bill'), findsOneWidget);
    expect(find.text('First bill'), findsNothing);
    expect(find.text('Bill 2 of 2'), findsOneWidget);

    await tester.fling(find.text('Second bill'), const Offset(300, 0), 1000);
    await tester.pumpAndSettle();
    expect(find.text('First bill'), findsOneWidget);
  });

  testWidgets('the steps bring the next bill in and the one before back', (tester) async {
    await tester.pumpWidget(_host(TextDirection.ltr));
    await tester.tap(find.bySemanticsLabel('Next bill'));
    await tester.pumpAndSettle();
    expect(find.text('Second bill'), findsOneWidget);
    await tester.tap(find.bySemanticsLabel('Previous bill'));
    await tester.pumpAndSettle();
    expect(find.text('First bill'), findsOneWidget);
  });

  testWidgets('the bill in view takes the whole width', (tester) async {
    await tester.pumpWidget(_host(TextDirection.ltr, bills: const [
      SizedBox(height: 120, width: double.infinity, child: ColoredBox(key: Key('first'), color: Colors.red)),
      SizedBox(height: 120, child: Text('Second bill')),
    ]));
    expect(tester.getSize(find.byKey(const Key('first'))).width, 390);
  });

  testWidgets('in Arabic the next bill comes with a swipe to the right', (tester) async {
    await tester.pumpWidget(_host(TextDirection.rtl));
    await tester.fling(find.text('First bill'), const Offset(300, 0), 1000);
    await tester.pumpAndSettle();
    expect(find.text('Second bill'), findsOneWidget);
  });

  testWidgets('one bill stands alone, with no line over it', (tester) async {
    await tester.pumpWidget(_host(TextDirection.ltr, bills: const [Text('Only bill')]));
    expect(find.text('Only bill'), findsOneWidget);
    expect(find.textContaining('of'), findsNothing);
    expect(find.byType(AnimatedContainer), findsNothing);
  });
}

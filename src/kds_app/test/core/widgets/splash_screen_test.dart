import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kds_app/core/router/app_router.dart';
import 'package:kds_app/l10n/app_localizations.dart';

Widget _app(Locale locale) => MaterialApp(
      locale: locale,
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      home: const SplashScreen(),
    );

void main() {
  testWidgets('the kitchen display opens on the ninja | KDS lockup on black, saying it is starting', (tester) async {
    await tester.pumpWidget(_app(const Locale('en')));

    expect(find.text('ninja'), findsOneWidget);
    expect(find.text('KDS'), findsOneWidget);
    expect(find.text('Starting…'), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    final scaffold = tester.widget<Scaffold>(find.byType(Scaffold));
    expect(scaffold.backgroundColor, const Color(0xFF000000));
  });

  testWidgets('in Arabic the lockup stays Latin, left to right', (tester) async {
    await tester.pumpWidget(_app(const Locale('ar')));

    expect(find.text('جاري التشغيل…'), findsOneWidget);
    expect(tester.getCenter(find.text('ninja')).dx, lessThan(tester.getCenter(find.text('KDS')).dx));
  });
}

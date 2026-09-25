import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forui/forui.dart';
import 'package:pos_app/core/router/app_router.dart';
import 'package:pos_app/core/theme/app_theme.dart';
import 'package:pos_app/l10n/app_localizations.dart';

Widget _app(Locale locale, AppThemeMode mode) => MaterialApp(
      locale: locale,
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      builder: (context, child) => FTheme(
        data: ThemeState(themeMode: mode).getForuiTheme(context, locale: locale),
        child: child!,
      ),
      home: const SplashScreen(),
    );

void main() {
  testWidgets("the till opens on the ninja | POS lockup in the connect screen's dark, even in a light theme", (tester) async {
    await tester.pumpWidget(_app(const Locale('en'), AppThemeMode.light));

    expect(find.text('ninja'), findsOneWidget);
    expect(find.text('POS'), findsOneWidget);
    expect(find.text('Starting…'), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    final scaffold = tester.widget<Scaffold>(find.byType(Scaffold));
    expect(scaffold.backgroundColor, const Color(0xFF18181B));
  });

  testWidgets("in Arabic the lockup stays Latin, left to right, and a dark theme keeps the connect screen's dark", (tester) async {
    await tester.pumpWidget(_app(const Locale('ar'), AppThemeMode.dark));

    expect(find.text('جاري التشغيل…'), findsOneWidget);
    final ninja = tester.getCenter(find.text('ninja'));
    final pos = tester.getCenter(find.text('POS'));
    expect(ninja.dx, lessThan(pos.dx));
    final scaffold = tester.widget<Scaffold>(find.byType(Scaffold));
    expect(scaffold.backgroundColor, const Color(0xFF18181B));
  });
}

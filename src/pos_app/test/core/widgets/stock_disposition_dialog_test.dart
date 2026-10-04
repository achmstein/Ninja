import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/theme/app_theme.dart';
import 'package:pos_app/core/widgets/stock_disposition_choice.dart';
import 'package:pos_app/features/orders/models/stock_disposition.dart';
import 'package:pos_app/l10n/app_localizations.dart';

/// A delivery that came back: the cancel asks what becomes of the food,
/// starting where the till put it, and answers with what was confirmed
Widget _app(StockDisposition initial, void Function(StockDisposition?) answered) => MaterialApp(
      locale: const Locale('en'),
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      builder: (context, child) => FTheme(
        data: const ThemeState(themeMode: AppThemeMode.light).getForuiTheme(context, locale: const Locale('en')),
        child: child!,
      ),
      home: Builder(
        builder: (context) => Center(
          child: TextButton(
            onPressed: () async => answered(await showStockDispositionDialog(
              context,
              title: 'Cancel the order?',
              actionLabel: 'Cancel the order',
              initial: initial,
            )),
            child: const Text('open'),
          ),
        ),
      ),
    );

/// The bundled fonts, so widths are the tablet's and not the test font's
/// (which draws every glyph a full em wide and overflows narrow rows)
Future<void> _loadFonts() async {
  for (final family in ['Inter', 'Alexandria']) {
    final loader = FontLoader(family);
    for (final weight in ['Regular', 'Medium', 'SemiBold', 'Bold']) {
      loader.addFont(rootBundle.load('assets/fonts/$family-$weight.ttf'));
    }
    await loader.load();
  }
}
void main() {
  setUpAll(_loadFonts);

  testWidgets('it starts where the till put it and answers with what was confirmed', (tester) async {
    tester.view.physicalSize = const Size(1280, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);

    StockDisposition? answer;
    var asked = false;
    await tester.pumpWidget(_app(StockDisposition.waste, (a) {
      asked = true;
      answer = a;
    }));
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();

    expect(find.text('Was the food made?'), findsOneWidget);
    expect(tester.getSemantics(find.text('Waste it')), isSemantics(isInMutuallyExclusiveGroup: true, isChecked: true));

    await tester.tap(find.text('Back to stock'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Cancel the order'));
    await tester.pumpAndSettle();

    expect(asked, isTrue);
    expect(answer, StockDisposition.restock);
    expect(tester.takeException(), isNull);
  });

  testWidgets('stepping back answers nothing', (tester) async {
    tester.view.physicalSize = const Size(1280, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);

    StockDisposition? answer = StockDisposition.waste;
    await tester.pumpWidget(_app(StockDisposition.waste, (a) => answer = a));
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();

    expect(answer, isNull);
  });
}

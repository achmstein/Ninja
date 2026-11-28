import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/theme/app_theme.dart';
import 'package:kds_app/features/kitchen/models/kitchen_order.dart';
import 'package:kds_app/features/kitchen/widgets/order_card.dart';
import 'package:kds_app/l10n/app_localizations.dart';

Widget _card(KitchenOrder order, {required double width, bool showParts = false}) => MaterialApp(
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
      home: Scaffold(
        body: Align(
          alignment: Alignment.topLeft,
          child: SizedBox(
            width: width,
            child: OrderCard(order: order, now: DateTime.utc(2026, 9, 5, 20), acting: false, showParts: showParts),
          ),
        ),
      ),
    );

void main() {
  testWidgets('a place name takes the free width of the header, not half of it', (tester) async {
    final order = KitchenOrder.fromJson({
      'orderNumber': 3121,
      'date': '2026-09-05T19:50:00Z',
      'confirmedAt': '2026-09-05T19:52:00Z',
      'source': 'Customer',
      'placeKind': 'Table',
      'placeName': {'en': 'Table 1', 'ar': 'ترابيزة 1'},
      'items': [
        {
          'productName': {'en': 'Latte', 'ar': 'لاتيه'},
          'units': 2,
        },
      ],
    });

    // Tests draw text in Ahem, a full em per character, so "Table 1" is about twice its real width: at 400 the
    // chip fits in the row's free width but not in half of it, which is all a Flexible beside a Spacer ever got
    await tester.pumpWidget(_card(order, width: 400));
    await tester.pumpAndSettle();

    final paragraph = tester.renderObject<RenderParagraph>(find.text('Table 1'));
    expect(paragraph.didExceedMaxLines, isFalse);
    expect(paragraph.size.width, greaterThanOrEqualTo(paragraph.getMaxIntrinsicWidth(double.infinity) - 0.5));
  });

  KitchenOrder split() => KitchenOrder.fromJson({
        'orderNumber': 3122,
        'date': '2026-09-05T19:50:00Z',
        'confirmedAt': '2026-09-05T19:52:00Z',
        'source': 'Pos',
        'items': [
          {
            'productName': {'en': 'Burger', 'ar': 'برجر'},
            'units': 1,
          },
        ],
        'parts': [
          {
            'stationId': 1,
            'stationName': {'en': 'Grill', 'ar': 'الشواية'},
            'showsOnScreen': true,
            'readyAt': '2026-09-05T19:58:00Z',
          },
          {
            'stationId': 3,
            'stationName': {'en': 'Shisha', 'ar': 'الشيشة'},
            'showsOnScreen': false,
          },
        ],
      });

  testWidgets('the pass shows the stations an order is split between', (tester) async {
    await tester.pumpWidget(_card(split(), width: 400, showParts: true));
    await tester.pumpAndSettle();

    expect(find.text('Grill'), findsOneWidget);
    expect(find.text('Shisha'), findsOneWidget);
    expect(find.byIcon(FIcons.printer), findsOneWidget, reason: 'the printed part says so instead of waiting for a tap');
  });

  testWidgets('a station screen keeps to its own part', (tester) async {
    await tester.pumpWidget(_card(split(), width: 400));
    await tester.pumpAndSettle();

    expect(find.text('Shisha'), findsNothing);
  });

  KitchenOrder withCancels(List<Map<String, dynamic>> items) => KitchenOrder.fromJson({
        'orderNumber': 3125,
        'date': '2026-09-05T19:50:00Z',
        'confirmedAt': '2026-09-05T19:52:00Z',
        'source': 'Pos',
        'items': items,
      });

  testWidgets('an item cancelled whole is struck and muted, a part-cancelled one shows what is left to make', (tester) async {
    final order = withCancels([
      {
        'productName': {'en': 'Latte', 'ar': 'لاتيه'},
        'units': 3,
        'cancelledUnits': 1,
        'cancelReason': 'Too slow',
      },
      {
        'productName': {'en': 'Cheesecake', 'ar': 'تشيز كيك'},
        'units': 1,
        'cancelledUnits': 1,
        'cancelReason': 'Out of stock',
        'specialInstructions': 'Warm',
      },
    ]);
    await tester.pumpWidget(_card(order, width: 400));
    await tester.pumpAndSettle();

    final colors = tester.element(find.byType(OrderCard)).theme.colors;

    // Part cancelled: the count is what is still to make, the name is not struck
    expect(find.text('2×'), findsOneWidget);
    expect(find.text('3×'), findsNothing);
    expect(tester.widget<Text>(find.text('Latte')).style?.decoration, isNot(TextDecoration.lineThrough));
    final partNote = tester.widget<Text>(find.text('1 cancelled · Too slow'));
    expect(partNote.style?.color, colors.destructive);

    // Cancelled whole: struck and muted, with the red line under it and nothing left of how to make it
    final cake = tester.widget<Text>(find.text('Cheesecake'));
    expect(cake.style?.decoration, TextDecoration.lineThrough);
    expect(cake.style?.color, colors.mutedForeground);
    expect(tester.widget<Text>(find.text('1×')).style?.decoration, TextDecoration.lineThrough);
    expect(tester.widget<Text>(find.text('Cancelled · Out of stock')).style?.color, colors.destructive);
    expect(find.text('Warm'), findsNothing);

    // Something is still to make: the ticket is not cancelled
    expect(find.text('Cancelled. Stop making it.'), findsNothing);
  });

  testWidgets('a ticket whose every item was cancelled reads as cancelled', (tester) async {
    final order = withCancels([
      {
        'productName': {'en': 'Latte', 'ar': 'لاتيه'},
        'units': 2,
        'cancelledUnits': 2,
      },
    ]);
    await tester.pumpWidget(_card(order, width: 400));
    await tester.pumpAndSettle();

    expect(find.text('Cancelled. Stop making it.'), findsOneWidget);
    expect(find.text('Cancelled'), findsOneWidget, reason: 'the item says so too, without a reason when none was given');
  });
}

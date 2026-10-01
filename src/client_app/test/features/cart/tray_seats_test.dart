import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ninja_client/core/brand/brand_provider.dart';
import 'package:ninja_client/core/brand/tenant_brand.dart';
import 'package:ninja_client/core/models/localized_text.dart';
import 'package:ninja_client/core/providers/branch_provider.dart';
import 'package:ninja_client/core/providers/current_place_provider.dart';
import 'package:ninja_client/core/providers/locale_provider.dart';
import 'package:ninja_client/core/ui/gesture_hint.dart';
import 'package:ninja_client/core/ui/ui.dart';
import 'package:ninja_client/core/utils/money.dart';
import 'package:ninja_client/features/cart/models/cart_item.dart';
import 'package:ninja_client/features/cart/services/cart_service.dart';
import 'package:ninja_client/features/cart/widgets/tray.dart';
import 'package:ninja_client/features/cart/widgets/tray_flights.dart';
import 'package:ninja_client/features/cart/widgets/tray_hint.dart';
import 'package:ninja_client/features/cart/widgets/tray_seats.dart';
import 'package:ninja_client/features/menu/paired_items.dart';
import 'package:ninja_client/l10n/app_localizations.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// The tray's motion past the plain open and shut (client_web's tray.tsx):
/// the dishes' circles fly from the dock to their rows as the order opens,
/// and the first dish lets the order peek out once with a word on dragging
/// it up, never again on this phone.

class _NoBranches extends BranchNotifier {
  @override
  BranchState build() => const BranchState();
}

class _Locale extends LocaleNotifier {
  @override
  Locale build() => const Locale('en');
}

class _Cart extends CartNotifier {
  @override
  Cart build() => Cart(items: [
        const CartItem(productId: 1, productName: LocalizedText(en: 'Cappuccino', ar: 'كابتشينو'), unitPrice: 50),
        const CartItem(productId: 2, productName: LocalizedText(en: 'Latte', ar: 'لاتيه'), unitPrice: 50, quantity: 2),
      ]);
}

/// The order over the dock's row, the way the shell stacks them, with the app's flight layer over both
class _Host extends StatefulWidget {
  final void Function(TrayMotion motion) onMotion;

  const _Host({required this.onMotion});

  @override
  State<_Host> createState() => _HostState();
}

class _HostState extends State<_Host> with TickerProviderStateMixin {
  late final motion = TrayMotion(this);

  @override
  void initState() {
    super.initState();
    widget.onMotion(motion);
  }

  @override
  void dispose() {
    motion.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
        listenable: motion,
        builder: (context, _) => Column(
          mainAxisAlignment: MainAxisAlignment.end,
          children: [
            if (motion.sheetShown) const Flexible(child: SlabInk(child: TraySheet())),
            Container(color: context.theme.colors.slab, child: SlabInk(child: TrayRow(motion: motion, height: 68))),
          ],
        ),
      );
}

Widget _app({required void Function(TrayMotion motion) onMotion, bool reduced = false}) => ProviderScope(
      overrides: [
        moneyProvider.overrideWithValue(MoneyFormat('EGP', const Locale('en'))),
        branchProvider.overrideWith(_NoBranches.new),
        localeProvider.overrideWith(_Locale.new),
        cartProvider.overrideWith(_Cart.new),
        featuresProvider.overrideWithValue(TenantFeatures.all),
        menuByIdProvider.overrideWithValue(const {}),
        orderDestinationProvider.overrideWithValue(null),
      ],
      child: MaterialApp(
        locale: const Locale('en'),
        supportedLocales: AppLocalizations.supportedLocales,
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        theme: materialThemeFor(NinjaTheme.neutral(Brightness.light)),
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context).copyWith(disableAnimations: reduced),
          child: TrayFlightLayer(child: child!),
        ),
        home: Scaffold(body: SizedBox(width: 390, child: _Host(onMotion: onMotion))),
      ),
    );

/// The circles in the air, drawn by the flight layer
Finder _circles() => find.descendant(of: find.byType(TraySeatLayer), matching: find.byType(DishPhoto));

/// The rows' photos, whose own circles hide until theirs have landed
double _rowPhotoOpacity(WidgetTester tester) {
  final seat = find.byWidgetPredicate((w) => w is TraySeat && w.kind == SeatKind.row).first;
  final opacity = find.descendant(of: seat, matching: find.byType(Opacity)).first;
  return tester.widget<Opacity>(opacity).opacity;
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    hintBook.reset();
    cueOnScreen.value = null;
  });

  testWidgets('as the order is pulled up, each dish flies from the dock to its row', (tester) async {
    trayHint.debugReset(seen: true);
    late TrayMotion motion;
    await tester.pumpWidget(_app(onMotion: (m) => motion = m));
    await tester.pump();
    expect(_circles(), findsNothing);

    motion.dragStart();
    await tester.pump();
    motion.sheetHeight = 300;
    motion.dragUpdate(-120);
    await tester.pump();
    await tester.pump();
    expect(tester.takeException(), isNull);
    // Both lines are in the air, and their rows wait for them
    expect(_circles(), findsNWidgets(2));
    expect(_rowPhotoOpacity(tester), 0);

    motion.dragEnd(-1000);
    await tester.pumpAndSettle();
    expect(motion.expanded, isTrue);
    expect(_circles(), findsNothing);
    expect(_rowPhotoOpacity(tester), 1);
  });

  testWidgets('with less motion wanted nothing flies: the rows show their own photos', (tester) async {
    trayHint.debugReset(seen: true);
    late TrayMotion motion;
    await tester.pumpWidget(_app(onMotion: (m) => motion = m, reduced: true));
    await tester.pump();
    motion.dragStart();
    await tester.pump();
    motion.dragUpdate(-120);
    await tester.pump();
    await tester.pump();
    expect(_circles(), findsNothing);
    expect(find.descendant(of: find.byWidgetPredicate((w) => w is TraySeat && w.kind == SeatKind.row), matching: find.byType(Opacity)), findsNothing);
    motion.dragEnd(0);
    await tester.pumpAndSettle();
  });

  testWidgets('the first dish to land lets the order peek out, with a word on dragging it up, once', (tester) async {
    late TrayMotion motion;
    await tester.pumpWidget(_app(onMotion: (m) => motion = m));
    await tester.pump();
    trayHint.debugReset();

    trayFlights.bump.value++;
    await tester.pump();
    expect(trayHint.showing, isTrue);
    // The order is out of the dock for its peek, and the words are up
    expect(motion.sheetShown, isTrue);
    await tester.pump(const Duration(milliseconds: 400));
    expect(motion.value, greaterThan(0));
    expect(find.text('Drag up to see your order'), findsOneWidget);

    // The peek tucks back, the cue has its time and goes, and is recorded on the phone
    await tester.pump(const Duration(milliseconds: 1000));
    expect(motion.value, 0);
    await tester.pump(trayHintFor);
    await tester.pumpAndSettle();
    expect(trayHint.showing, isFalse);
    expect(trayHint.pending, isFalse);
    expect(find.text('Drag up to see your order'), findsNothing);
    expect((await SharedPreferences.getInstance()).getStringList(hintsStorageKey), contains('tray'));

    // Another dish: no cue
    trayFlights.bump.value++;
    await tester.pump();
    expect(trayHint.showing, isFalse);
  });

  testWidgets("another cue on screen (the deck's) holds it back, still pending, till the next dish", (tester) async {
    late TrayMotion motion;
    await tester.pumpWidget(_app(onMotion: (m) => motion = m));
    await tester.pump();
    trayHint.debugReset();

    cueOnScreen.value = HintKey.swipe;
    trayFlights.bump.value++;
    await tester.pump();
    expect(trayHint.showing, isFalse);
    expect(trayHint.pending, isTrue);
    expect(motion.sheetShown, isFalse);

    cueOnScreen.value = null;
    trayFlights.bump.value++;
    await tester.pump();
    expect(trayHint.showing, isTrue);
    expect(cueOnScreen.value, HintKey.tray);
    await tester.pump(trayHintFor);
    await tester.pumpAndSettle();
    expect(cueOnScreen.value, isNull);
  });

  testWidgets('opening the order ends the cue at once', (tester) async {
    late TrayMotion motion;
    await tester.pumpWidget(_app(onMotion: (m) => motion = m));
    await tester.pump();
    trayHint.debugReset();

    trayFlights.bump.value++;
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('Drag up to see your order'), findsOneWidget);

    motion.setExpanded(true);
    await tester.pumpAndSettle();
    expect(trayHint.showing, isFalse);
    expect(trayHint.pending, isFalse);
    expect(find.text('Drag up to see your order'), findsNothing);
  });

  test('the fingertip holds where its last keyframe left it', () {
    const times = [0.0, 0.1, 0.65, 0.78];
    const y = [0.0, 0.0, -110.0, -110.0];
    expect(tipKeyframe(times, y, 0), 0);
    expect(tipKeyframe(times, y, 0.65), -110);
    expect(tipKeyframe(times, y, 1), -110);
    final half = tipKeyframe(times, y, (0.1 + 0.65) / 2);
    expect(half, closeTo(-55, 0.5));
  });
}

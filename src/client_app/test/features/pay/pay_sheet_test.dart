import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forui/forui.dart';
import 'package:ninja_client/core/brand/brand_provider.dart';
import 'package:ninja_client/core/models/localized_text.dart';
import 'package:ninja_client/core/providers/locale_provider.dart';
import 'package:ninja_client/core/theme/theme_provider.dart';
import 'package:ninja_client/features/pay/models/pay_view.dart';
import 'package:ninja_client/features/pay/pay_math.dart';
import 'package:ninja_client/features/pay/services/pay_service.dart';
import 'package:ninja_client/features/pay/widgets/pay_sheet.dart';
import 'package:ninja_client/l10n/app_localizations.dart';

/// The guest's pay sheet: the bill as the table paid it so far, the share
/// they pick, and the amount the confirm button asks the server for.

class _Started {
  final SplitKind mode;
  final List<int>? lineIds;
  final int? parts;
  final int? of;
  final double? amount;
  _Started(this.mode, this.lineIds, this.parts, this.of, this.amount);
}

class _FakePay implements PayRepository {
  PayView view;
  final started = <_Started>[];
  final cancelled = <String>[];

  /// What the next cancel throws, or null to let it go
  Object? cancelError;
  _FakePay(this.view);

  @override
  Future<void> cancel(String key) async {
    final error = cancelError;
    if (error != null) throw error;
    cancelled.add(key);
  }

  @override
  Future<PayView> getBill(PaySource source) async => view;

  @override
  Future<StartedPayment> start(int ticketId,
      {required SplitKind mode,
      List<int>? lineIds,
      int? parts,
      int? of,
      double? amount,
      String? payerName}) async {
    started.add(_Started(mode, lineIds, parts, of, amount));
    return const StartedPayment(
        key: 'k1', checkoutUrl: 'https://pay.example/k1', amount: 0, fee: 0, charged: 0);
  }

  @override
  Future<PaymentStatus> status(String key) async => const PaymentStatus(status: 'Pending');
}

class _English extends LocaleNotifier {
  @override
  Locale build() => const Locale('en');
}

PayLine _line(int id, String name, double share, {bool mine = false, bool claimed = false}) => PayLine(
      id: id,
      description: LocalizedText(en: name),
      qty: 1,
      total: share,
      share: share,
      isMine: mine,
      claimed: claimed,
    );

PayView _view({
  PayOptions options = const PayOptions(ready: true, allowItems: true, allowEqual: true, allowCustom: true),
  int? people,
  bool canPay = true,
  String? why,
  double paid = 0,
  List<PayShare> shares = const [],
}) =>
    PayView(
      ticketId: 9,
      locationName: const LocalizedText(en: 'Table 4'),
      lines: [
        _line(1, 'Latte', 50, mine: true),
        _line(2, 'Cake', 30),
        _line(3, 'Tea', 20, claimed: true),
      ],
      total: 100,
      paid: paid,
      remaining: 100 - paid,
      shares: shares,
      people: people,
      options: options,
      canPay: canPay,
      why: why,
    );

Widget _app(_FakePay pay,
        {bool split = false,
        Locale locale = const Locale('en'),
        String? customerUrl,
        List<Uri>? opened}) =>
    ProviderScope(
      overrides: [
        payRepositoryProvider.overrideWithValue(pay),
        localeProvider.overrideWith(_English.new),
        customerUrlProvider.overrideWithValue(customerUrl),
      ],
      child: MaterialApp(
        locale: locale,
        supportedLocales: AppLocalizations.supportedLocales,
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        builder: (context, child) => FTheme(
          data: const ThemeState(themeMode: AppThemeMode.dark).getForuiTheme(context, locale: locale),
          child: FToaster(child: child!),
        ),
        home: Scaffold(
          body: PaySheet(
            source: const PaySource.ticket(9),
            startSplit: split,
            openCheckout: (url) async {
              opened?.add(url);
              return true;
            },
          ),
        ),
      ),
    );

/// The sheet polls; replacing it disposes its timers before the test ends
Future<void> _close(WidgetTester tester) async {
  await tester.pumpWidget(const SizedBox());
  await tester.pump(const Duration(seconds: 1));
}

Future<void> _confirm(WidgetTester tester) async {
  final button = find.byKey(const ValueKey('pay-confirm'));
  await tester.ensureVisible(button);
  await tester.tap(button);
  await tester.pump();
}

void main() {
  testWidgets('the bill shows what the table paid, who is paying, and both ways to pay', (tester) async {
    final pay = _FakePay(_view(paid: 20, shares: const [
      PayShare(payerName: 'Sara', amount: 20, status: 'Paid'),
      PayShare(amount: 30, status: 'Pending'),
    ]));
    await tester.pumpWidget(_app(pay));
    await tester.pump();

    expect(find.text('Table 4'), findsOneWidget);
    expect(find.text('Paid so far'), findsOneWidget);
    expect(find.text('80.00 EGP'), findsOneWidget);
    expect(find.text('Sara'), findsOneWidget);
    expect(find.text('Guest'), findsOneWidget);
    expect(find.text('Paying…'), findsOneWidget);
    expect(find.text('Pay fully'), findsOneWidget);
    expect(find.text('Split bill'), findsOneWidget);
    await _close(tester);
  });

  testWidgets("only the guest's own share in checkout can be cancelled, and the bill is read again", (tester) async {
    const mine = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    final pay = _FakePay(_view(shares: const [
      PayShare(amount: 30, status: 'Pending', isMine: true, key: mine),
      PayShare(payerName: 'Sara', amount: 20, status: 'Pending'),
    ]));
    await tester.pumpWidget(_app(pay, customerUrl: 'https://cafe.example'));
    await tester.pump();

    expect(find.byKey(const ValueKey('share-cancel-$mine')), findsOneWidget);
    expect(find.text('Cancel'), findsOneWidget);
    // A café that takes real payments has no pretend checkout to go back to
    expect(find.text('Continue'), findsNothing);

    pay.view = _view();
    await tester.tap(find.byKey(const ValueKey('share-cancel-$mine')));
    await tester.pump();
    await tester.pump();
    expect(pay.cancelled, [mine]);
    expect(find.text('Cancel'), findsNothing);
    await _close(tester);
  });

  testWidgets("a demo café's own pending share continues on the pretend checkout, and can be cancelled there",
      (tester) async {
    const mine = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    final opened = <Uri>[];
    final pay = _FakePay(_view(
      options: const PayOptions(ready: true, allowItems: true, simulated: true),
      shares: const [PayShare(amount: 30, status: 'Pending', isMine: true, key: mine)],
    ));
    await tester.pumpWidget(_app(pay, customerUrl: 'https://cafe.example/', opened: opened));
    await tester.pump();

    await tester.tap(find.byKey(const ValueKey('share-continue-$mine')));
    await tester.pump();
    expect(opened.single.toString(), 'https://cafe.example/pay/aaaaaaaabbbbccccddddeeeeeeeeeeee?simulate=1');
    expect(find.text('Cancel payment'), findsOneWidget);

    // Refused: the guest is told, and the sheet keeps following it
    pay.cancelError = const PayException('Already paid');
    await tester.tap(find.byKey(const ValueKey('pay-cancel')));
    await tester.pump();
    expect(find.text('Already paid'), findsOneWidget);

    pay.cancelError = null;
    await tester.tap(find.byKey(const ValueKey('pay-cancel')));
    await tester.pump();
    await tester.pump();
    expect(pay.cancelled, [mine]);
    // Back on the bill
    expect(find.text('Pay fully'), findsOneWidget);
    await _close(tester);
  });

  testWidgets('without the customer site a demo share offers no Continue', (tester) async {
    const mine = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    final pay = _FakePay(_view(
      options: const PayOptions(ready: true, simulated: true),
      shares: const [PayShare(amount: 30, status: 'Pending', isMine: true, key: mine)],
    ));
    await tester.pumpWidget(_app(pay));
    await tester.pump();
    expect(find.text('Continue'), findsNothing);
    expect(find.text('Cancel'), findsOneWidget);
    await _close(tester);
  });

  testWidgets('a paid bill says so and offers nothing to pay', (tester) async {
    final pay = _FakePay(_view(canPay: false, why: 'paid'));
    await tester.pumpWidget(_app(pay));
    await tester.pump();

    expect(find.text('This bill is fully paid'), findsOneWidget);
    expect(find.text('Pay fully'), findsNothing);
    await _close(tester);
  });

  testWidgets('paying for your items starts from your own, skips what is taken, and sends the lines',
      (tester) async {
    final pay = _FakePay(_view());
    await tester.pumpWidget(_app(pay, split: true));
    await tester.pump();

    // Their latte is already picked; the tea someone paid is not selectable
    expect(find.text('Pay 50.00 EGP'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('item-3')));
    await tester.pump();
    expect(find.text('Pay 50.00 EGP'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('item-2')));
    await tester.pump();
    // Latte and cake are the last free lines: they take what is left
    expect(find.text('Pay 100.00 EGP'), findsOneWidget);

    await _confirm(tester);
    expect(pay.started.single.mode, SplitKind.items);
    expect(pay.started.single.lineIds, unorderedEquals([1, 2]));
    expect(find.text('Waiting for your payment…'), findsOneWidget);
    await _close(tester);
  });

  testWidgets('dividing equally starts from the party, and the guest fee shows on its own line', (tester) async {
    final pay = _FakePay(_view(
      people: 4,
      options: const PayOptions(ready: true, allowEqual: true, feeMode: 'Guest', feePercent: 2.75, feeFixed: 3),
    ));
    await tester.pumpWidget(_app(pay, split: true));
    await tester.pump();

    expect(find.text('4 people'), findsOneWidget);
    expect(find.text('Online payment fee'), findsOneWidget);
    // (25 + 3) / 0.9725 - 25 = 3.79
    expect(find.text('3.79 EGP'), findsOneWidget);
    expect(find.text('Pay 28.79 EGP'), findsOneWidget);

    await _confirm(tester);
    expect(pay.started.single.mode, SplitKind.equal);
    expect(pay.started.single.parts, 1);
    expect(pay.started.single.of, 4);
    await _close(tester);
  });

  testWidgets('a custom amount past what is left cannot be paid', (tester) async {
    final pay = _FakePay(_view(options: const PayOptions(ready: true, allowCustom: true)));
    await tester.pumpWidget(_app(pay, split: true));
    await tester.pump();

    await tester.enterText(find.byType(EditableText), '150');
    await tester.pump();
    expect(find.textContaining('more than is left'), findsOneWidget);
    await _confirm(tester);
    expect(pay.started, isEmpty);

    await tester.enterText(find.byType(EditableText), '40');
    await tester.pump();
    await _confirm(tester);
    expect(pay.started.single.amount, 40);
    await _close(tester);
  });

  testWidgets('the sheet lays out right to left in Arabic', (tester) async {
    final pay = _FakePay(_view());
    await tester.pumpWidget(_app(pay, locale: const Locale('ar')));
    await tester.pump();

    expect(find.text('ادفع الكل'), findsOneWidget);
    expect(Directionality.of(tester.element(find.text('ادفع الكل'))), TextDirection.rtl);
    expect(tester.takeException(), isNull);
    await _close(tester);
  });
}

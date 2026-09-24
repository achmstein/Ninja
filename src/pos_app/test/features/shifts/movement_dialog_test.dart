import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forui/forui.dart';
import 'package:pos_app/core/brand/brand_service.dart';
import 'package:pos_app/core/brand/tenant_brand.dart';
import 'package:pos_app/core/models/localized_text.dart';
import 'package:pos_app/core/providers/branch_provider.dart';
import 'package:pos_app/core/theme/app_theme.dart';
import 'package:pos_app/features/shifts/dialogs/movement_dialog.dart';
import 'package:pos_app/features/shifts/models/shift.dart';
import 'package:pos_app/features/shifts/services/shifts_service.dart';
import 'package:pos_app/features/shifts/services/till_picks_service.dart';
import 'package:pos_app/l10n/app_localizations.dart';

/// The pickers behind the dialog, as the demo has them
class _Picks implements TillPicksRepository {
  @override
  Future<List<TillPick>> employees() async => [
        TillPick.named(1, 'أحمد سعيد', balance: 320),
        TillPick.named(2, 'كريم مصطفى', balance: -50),
        TillPick.named(3, 'منى عادل'),
      ];

  @override
  Future<List<TillPick>> suppliers() async => [TillPick.named(1, 'Beanery Coffee', balance: 3400)];

  @override
  Future<List<TillPick>> partners() async => [TillPick.named(1, 'Omar')];

  @override
  Future<List<TillPick>> categories() async =>
      [const TillPick(id: 1, name: LocalizedText(en: 'Electricity', ar: 'كهرباء'))];
}

/// A tenant with every feature on, so every pay-out kind is offered
class _Tenant implements TenantRepository {
  @override
  Future<TenantBrand> getBrand() async => TenantBrand.neutral;
}

/// Records what the dialog sends
class _Shifts implements ShiftsRepository {
  CashMovementRequest? sent;

  @override
  Future<void> addMovement(int id, CashMovementRequest request, {String? requestId}) async => sent = request;

  @override
  Future<ShiftView?> getCurrentShift() async => null;

  @override
  Future<ShiftView> getShift(int id) => throw UnimplementedError();

  @override
  Future<List<ShiftView>> getClosedShifts({int pageIndex = 0, int pageSize = 20}) async => [];

  @override
  Future<int> openShift(double openingFloat, {String? requestId}) => throw UnimplementedError();

  @override
  Future<ShiftView> closeShift(int id, double closingCount, {String? requestId}) => throw UnimplementedError();
}

Widget _app(_Shifts shifts, CashMovementType type) => ProviderScope(
      overrides: [
        selectedBranchIdProvider.overrideWithValue(1),
        tenantRepositoryProvider.overrideWithValue(_Tenant()),
        shiftsRepositoryProvider.overrideWithValue(shifts),
        tillPicksRepositoryProvider.overrideWithValue(_Picks()),
      ],
      child: MaterialApp(
        locale: const Locale('ar'),
        supportedLocales: AppLocalizations.supportedLocales,
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        builder: (context, child) => FTheme(
          data: const ThemeState(themeMode: AppThemeMode.light).getForuiTheme(context, locale: const Locale('ar')),
          child: FToaster(child: child!),
        ),
        home: Builder(
          builder: (context) => Center(
            child: TextButton(
              onPressed: () => showMovementDialog(context, 7, type),
              child: const Text('open'),
            ),
          ),
        ),
      ),
    );

/// The bundled fonts, so widths are the tablet's and not the test font's
/// (which draws every glyph a full em wide and overflows narrow cells)
Future<void> loadFonts() async {
  for (final family in ['Inter', 'Cairo']) {
    final loader = FontLoader(family);
    for (final weight in ['Regular', 'Medium', 'SemiBold', 'Bold']) {
      loader.addFont(rootBundle.load('assets/fonts/$family-$weight.ttf'));
    }
    await loader.load();
  }
}

void main() {
  setUpAll(loadFonts);

  testWidgets('a wage pay-out names the employee, shows what they are owed and sends the kind', (tester) async {
    tester.view.physicalSize = const Size(1280, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);

    final shifts = _Shifts();
    await tester.pumpWidget(_app(shifts, CashMovementType.payOut));
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();

    // Six kinds for a pay-out, nothing to pick until one that names someone is tapped
    for (final kind in ['مورد', 'يومية / راتب', 'سلفة', 'مصروف', 'شريك', 'أخرى']) {
      expect(find.text(kind), findsOneWidget);
    }
    expect(find.text('لمن؟'), findsNothing);

    await tester.tap(find.text('يومية / راتب'));
    await tester.pumpAndSettle();
    expect(find.text('لمن؟'), findsOneWidget);
    // A daily worker's balance shows; a negative one is flagged; a monthly employee's is absent
    expect(find.text('320.00 ج.م'), findsOneWidget);
    expect(find.text('عليه 50.00 ج.م'), findsOneWidget);
    expect(find.text('منى عادل'), findsOneWidget);
    expect(tester.takeException(), isNull);

    // Picking writes the reason; the amount comes off the keypad
    await tester.tap(find.text('أحمد سعيد'));
    await tester.pumpAndSettle();
    expect(find.widgetWithText(TextField, 'يومية / راتب أحمد سعيد'), findsOneWidget);
    // (no '0': the empty amount box shows one too)
    for (final digit in ['3', '2', '5']) {
      await tester.tap(find.text(digit));
      await tester.pumpAndSettle();
    }

    // The dialog scrolls; the submit button sits below the keypad and the list
    await tester.ensureVisible(find.widgetWithText(FButton, 'سحب من الدرج'));
    await tester.tap(find.widgetWithText(FButton, 'سحب من الدرج'));
    await tester.pumpAndSettle();

    final sent = shifts.sent!;
    expect(sent.type, CashMovementType.payOut);
    expect(sent.amount, 325);
    expect(sent.kind, CashMovementKind.wage);
    expect(sent.employeeId, 1);
    expect(sent.employeeName, 'أحمد سعيد');
    expect(sent.supplierId, isNull);
    expect(sent.reason, 'يومية / راتب أحمد سعيد');
    expect(sent.toJson()['kind'], 2);
  });

  testWidgets('an expense takes the category as its reason and a pay-in offers only partner and other',
      (tester) async {
    tester.view.physicalSize = const Size(1280, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);

    final shifts = _Shifts();
    await tester.pumpWidget(_app(shifts, CashMovementType.payOut));
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('مصروف'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('كهرباء'));
    await tester.pumpAndSettle();
    expect(find.widgetWithText(TextField, 'كهرباء'), findsOneWidget);
    await tester.tap(find.text('9'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.widgetWithText(FButton, 'سحب من الدرج'));
    await tester.tap(find.widgetWithText(FButton, 'سحب من الدرج'));
    await tester.pumpAndSettle();
    expect(shifts.sent!.kind, CashMovementKind.expense);
    expect(shifts.sent!.categoryId, 1);
    expect(shifts.sent!.employeeId, isNull);

    await tester.pumpWidget(_app(shifts, CashMovementType.payIn));
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    expect(find.text('شريك'), findsOneWidget);
    expect(find.text('أخرى'), findsOneWidget);
    expect(find.text('مورد'), findsNothing);
    expect(find.text('سلفة'), findsNothing);
  });
}

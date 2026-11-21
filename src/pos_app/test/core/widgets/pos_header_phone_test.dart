import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/brand/brand_provider.dart';
import 'package:ninja_app_core/brand/tenant_brand.dart';
import 'package:ninja_app_core/models/branch.dart';
import 'package:ninja_app_core/models/localized_text.dart';
import 'package:ninja_app_core/network/network_status.dart';
import 'package:ninja_app_core/providers/branch_provider.dart';
import 'package:ninja_app_core/theme/app_theme.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import 'package:ninja_printing/ninja_printing.dart';
import 'package:pos_app/core/auth/auth_service.dart';
import 'package:pos_app/core/printing/kitchen_printing.dart';
import 'package:pos_app/core/sending/sending.dart';
import 'package:pos_app/core/sending/sending_chip.dart';
import 'package:pos_app/core/widgets/compact_chip.dart';
import 'package:pos_app/core/widgets/compact_status_chips.dart';
import 'package:pos_app/core/widgets/offline_chip.dart';
import 'package:pos_app/core/widgets/pos_header.dart';
import 'package:pos_app/core/widgets/pos_shell.dart';
import 'package:pos_app/features/auth/cashier_roster.dart';
import 'package:pos_app/features/shifts/models/shift.dart';
import 'package:pos_app/features/shifts/providers/shifts_provider.dart';
import 'package:pos_app/features/shifts/widgets/shift_chip.dart';
import 'package:pos_app/features/shifts/widgets/trading_chip.dart';
import 'package:pos_app/l10n/app_localizations.dart';

import '../../support/app_fonts.dart';

/// The header on a phone, on its worst day: a business and a branch with long
/// names, the network down and a charge that never reached the server, so
/// every chip the header has is in it at once. On a tablet the same row keeps
/// its words.

class _Auth extends AuthService {
  @override
  AuthState build() => const AuthState(
        isInitializing: false,
        isAuthenticated: true,
        mayUseApp: true,
        userId: 'cashier',
        name: 'Ahmed Mostafa',
        roles: ['Cashier'],
        branches: [1, 2],
      );

  @override
  Future<void> initialize() async {}
}

class _Branches extends BranchNotifier {
  @override
  BranchState build() => BranchState(
        branches: [
          Branch(id: 1, name: const LocalizedText(en: 'Downtown by the old opera house', ar: 'وسط البلد'), isActive: true, displayOrder: 0),
          Branch(id: 2, name: const LocalizedText(en: 'New Cairo', ar: 'القاهرة الجديدة'), isActive: true, displayOrder: 1),
        ],
        selectedBranchId: 1,
      );
}

class _Brand extends BrandNotifier {
  @override
  TenantBrand build() => const TenantBrand(name: LocalizedText(en: 'The Very Long Named Coffee Roasters', ar: 'محمصة البن'));
}

class _Down extends OnlineNotifier {
  @override
  bool build() => false;
}

class _NoShift extends CurrentShiftNotifier {
  @override
  Future<ShiftView?> build() async => null;
}

class _NothingStuck extends StuckKitchenTicketsNotifier {
  @override
  List<KitchenTicket> build() => const [];
}

class _OneNotSent extends SendingNotifier {
  @override
  List<Sending> build() => [
        Sending(requestId: 'r1', ticketId: 7, branchId: 1, lines: const [], status: SendStatus.failed, startedAt: DateTime(2026)),
      ];
}

Widget _app(Widget home, {Locale locale = const Locale('en'), EdgeInsets padding = EdgeInsets.zero}) => ProviderScope(
      overrides: [
        authServiceProvider.overrideWith(_Auth.new),
        branchProvider.overrideWith(_Branches.new),
        brandProvider.overrideWith(_Brand.new),
        onlineProvider.overrideWith(_Down.new),
        currentShiftProvider.overrideWith(_NoShift.new),
        sendingProvider.overrideWith(_OneNotSent.new),
        cashierRosterKeeperProvider.overrideWith((ref) async {}),
        stuckKitchenTicketsProvider.overrideWith(_NothingStuck.new),
      ],
      child: MaterialApp(
        locale: locale,
        supportedLocales: AppLocalizations.supportedLocales,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context).copyWith(padding: padding, viewPadding: padding),
          child: FTheme(
            data: const ThemeState(themeMode: AppThemeMode.light).getForuiTheme(context, locale: locale),
            child: FToaster(child: child!),
          ),
        ),
        home: home,
      ),
    );

void _surface(WidgetTester tester, Size size) {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
}

const _phone = Size(360, 780);
const _tablet = Size(1280, 800);

void main() {
  setUpAll(loadAppFonts);

  for (final locale in const [Locale('en'), Locale('ar')]) {
    testWidgets('a phone fits every chip the header has, as its sign alone (${locale.languageCode})', (tester) async {
      _surface(tester, _phone);
      await tester.pumpWidget(_app(const Scaffold(body: PosHeader()), locale: locale));
      await tester.pump();

      // Laid out without running past either edge
      expect(tester.takeException(), isNull);
      expect(find.byType(CompactChip), findsNWidgets(4));
      expect(find.byType(CompactShiftChip), findsOneWidget);
      expect(find.byType(CompactTradingChip), findsOneWidget);
      expect(find.byType(ShiftChip), findsNothing);
      expect(find.byType(TradingChip), findsNothing);

      // Each is still a full target for a finger, inside the screen
      for (final chip in tester.widgetList(find.byType(CompactChip))) {
        final rect = tester.getRect(find.byWidget(chip));
        expect(rect.width, greaterThanOrEqualTo(Sizes.control));
        expect(rect.height, greaterThanOrEqualTo(Sizes.control));
        expect(rect.left, greaterThanOrEqualTo(0));
        expect(rect.right, lessThanOrEqualTo(_phone.width));
      }
      final menu = tester.getRect(find.byIcon(FIcons.settings));
      expect(menu.left, greaterThanOrEqualTo(0));
      expect(menu.right, lessThanOrEqualTo(_phone.width));
    });
  }

  testWidgets('a chip that lost its words still says them to a screen reader', (tester) async {
    final handle = tester.ensureSemantics();
    _surface(tester, _phone);
    await tester.pumpWidget(_app(const Scaffold(body: PosHeader())));
    await tester.pump();

    expect(find.text('No shift'), findsNothing);
    expect(find.text('Open to customers'), findsNothing);
    expect(find.bySemanticsLabel('No shift'), findsOneWidget);
    expect(find.bySemanticsLabel('Open to customers'), findsOneWidget);
    expect(find.bySemanticsLabel('Offline'), findsOneWidget);
    expect(find.bySemanticsLabel('1 not sent'), findsOneWidget);
    handle.dispose();
  });

  testWidgets('a long business name is cut short, not pushed past the chips', (tester) async {
    _surface(tester, _phone);
    await tester.pumpWidget(_app(const Scaffold(body: PosHeader())));
    await tester.pump();

    final name = tester.getRect(find.text('The Very Long Named Coffee Roasters'));
    final firstChip = tester.getRect(find.byType(SendingChip));
    expect(name.right, lessThanOrEqualTo(firstChip.left));
    expect(tester.takeException(), isNull);
  });

  testWidgets('a tablet keeps the chips with their words', (tester) async {
    _surface(tester, _tablet);
    await tester.pumpWidget(_app(const Scaffold(body: PosHeader())));
    await tester.pump();

    expect(tester.takeException(), isNull);
    expect(find.byType(CompactChip), findsNothing);
    expect(find.byType(ShiftChip), findsOneWidget);
    expect(find.byType(TradingChip), findsOneWidget);
    expect(find.text('No shift'), findsOneWidget);
    expect(find.text('Open to customers'), findsOneWidget);
    expect(find.text('Offline'), findsOneWidget);
    expect(find.text('1 not sent'), findsOneWidget);
    // The brand at the start edge, the menu at the end one, as before
    expect(tester.getRect(find.text('The Very Long Named Coffee Roasters')).left, lessThan(100));
    expect(tester.getRect(find.byIcon(FIcons.settings)).right, greaterThan(_tablet.width - 40));
    expect(tester.getSize(find.byType(OfflineChip)).height, lessThan(Sizes.control));
  });

  testWidgets('the shell keeps the till out from under a phone\'s status bar and gesture area', (tester) async {
    _surface(tester, _phone);
    const bars = EdgeInsets.only(top: 32, bottom: 24);
    await tester.pumpWidget(_app(const PosShell(child: ColoredBox(color: Colors.white, child: SizedBox.expand())), padding: bars));
    await tester.pump();

    expect(tester.getRect(find.byType(PosHeader)).top, bars.top);
    expect(tester.getRect(find.byType(ColoredBox).last).bottom, _phone.height - bars.bottom);
  });

  testWidgets('with the system bars hidden, as on a tablet, the shell starts at the very top', (tester) async {
    _surface(tester, _tablet);
    await tester.pumpWidget(_app(const PosShell(child: ColoredBox(color: Colors.white, child: SizedBox.expand()))));
    await tester.pump();

    expect(tester.getRect(find.byType(PosHeader)).top, 0);
    expect(tester.getRect(find.byType(ColoredBox).last).bottom, _tablet.height);
  });
}

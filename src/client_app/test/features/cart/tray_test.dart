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
import 'package:ninja_client/core/ui/ui.dart';
import 'package:ninja_client/core/utils/money.dart';
import 'package:ninja_client/features/cart/models/cart_item.dart';
import 'package:ninja_client/features/cart/services/cart_service.dart';
import 'package:ninja_client/features/cart/widgets/tray.dart';
import 'package:ninja_client/features/menu/paired_items.dart';
import 'package:ninja_client/l10n/app_localizations.dart';

/// The tray in the dock and the order it opens into: both lay out with
/// dishes in them, in either direction, and say what the order comes to.

class _NoBranches extends BranchNotifier {
  @override
  BranchState build() => const BranchState();
}

class _Locale extends LocaleNotifier {
  final Locale locale;

  _Locale(this.locale);

  @override
  Locale build() => locale;
}

class _Cart extends CartNotifier {
  @override
  Cart build() => Cart(items: [
        const CartItem(productId: 1, productName: LocalizedText(en: 'Cappuccino', ar: 'كابتشينو'), unitPrice: 50),
        const CartItem(productId: 2, productName: LocalizedText(en: 'Latte', ar: 'لاتيه'), unitPrice: 50, quantity: 2),
        const CartItem(productId: 3, productName: LocalizedText(en: 'Waffle', ar: 'وافل'), unitPrice: 70),
      ]);
}

class _Host extends StatefulWidget {
  final bool open;

  const _Host({required this.open});

  @override
  State<_Host> createState() => _HostState();
}

class _HostState extends State<_Host> with TickerProviderStateMixin {
  late final motion = TrayMotion(this);

  @override
  void initState() {
    super.initState();
    if (widget.open) motion.setExpanded(true, reduced: true);
  }

  @override
  void dispose() {
    motion.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Column(
        mainAxisAlignment: MainAxisAlignment.end,
        children: [
          if (widget.open) const Flexible(child: SlabInk(child: TraySheet())),
          Container(color: context.theme.colors.slab, child: SlabInk(child: TrayRow(motion: motion, height: 68))),
        ],
      );
}

Widget _app({required Locale locale, required bool open}) => ProviderScope(
      overrides: [
        moneyProvider.overrideWithValue(MoneyFormat('EGP', locale)),
        branchProvider.overrideWith(_NoBranches.new),
        localeProvider.overrideWith(() => _Locale(locale)),
        cartProvider.overrideWith(_Cart.new),
        featuresProvider.overrideWithValue(TenantFeatures.all),
        menuByIdProvider.overrideWithValue(const {}),
        orderDestinationProvider.overrideWithValue(null),
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
        theme: materialThemeFor(NinjaTheme.neutral(Brightness.light)),
        home: Scaffold(body: SizedBox(width: 390, child: _Host(open: open))),
      ),
    );

void main() {
  for (final locale in [const Locale('en'), const Locale('ar')]) {
    testWidgets('the tray row shows the count and the total (${locale.languageCode})', (tester) async {
      await tester.pumpWidget(_app(locale: locale, open: false));
      await tester.pump(const Duration(milliseconds: 400));
      expect(tester.takeException(), isNull);
      // 50 + 2 × 50 + 70, four dishes
      expect(find.textContaining('220'), findsWidgets);
      if (locale.languageCode == 'en') expect(find.text('4 items'), findsOneWidget);
    });

    testWidgets('the open order lists every line (${locale.languageCode})', (tester) async {
      await tester.pumpWidget(_app(locale: locale, open: true));
      await tester.pump(const Duration(milliseconds: 400));
      expect(tester.takeException(), isNull);
      expect(find.text(locale.languageCode == 'ar' ? 'وافل' : 'Waffle'), findsOneWidget);
    });
  }
}

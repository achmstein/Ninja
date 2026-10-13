import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/theme/app_theme.dart';
import 'package:pos_app/features/deliveries/models/delivery_order.dart';
import 'package:pos_app/features/deliveries/widgets/delivery_form_dialog.dart';
import 'package:pos_app/l10n/app_localizations.dart';

Widget _host(Widget child) => ProviderScope(
      child: MaterialApp(
        supportedLocales: AppLocalizations.supportedLocales,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        builder: (context, app) => FTheme(
          data: const ThemeState(themeMode: AppThemeMode.light).getForuiTheme(context, locale: const Locale('en')),
          child: app!,
        ),
        home: Scaffold(body: Center(child: SizedBox(width: 640, child: child))),
      ),
    );

/// The form's card of nearer branches, with the choice held the way the form holds it
class _Chooser extends StatefulWidget {
  final List<DeliveryAlternative> alternatives;
  final void Function(DeliveryAlternative?) onChosen;

  const _Chooser({required this.alternatives, required this.onChosen});

  @override
  State<_Chooser> createState() => _ChooserState();
}

class _ChooserState extends State<_Chooser> {
  int? _chosen;

  @override
  Widget build(BuildContext context) => NearerBranches(
        alternatives: widget.alternatives,
        chosen: _chosen,
        branchName: (id) => id == 2 ? 'Maadi' : 'Zamalek',
        onChoose: (a) {
          setState(() => _chosen = a?.branchId);
          widget.onChosen(a);
        },
      );
}

void main() {
  const maadi = DeliveryAlternative(branchId: 2, distanceMeters: 1200, fee: 25);
  const zamalek = DeliveryAlternative(branchId: 3, distanceMeters: 2400, fee: 15, paused: true);

  testWidgets('a nearer branch is offered with how far and its fee, and sent to in one tap', (tester) async {
    DeliveryAlternative? chosen;
    await tester.pumpWidget(_host(_Chooser(alternatives: const [maadi], onChosen: (a) => chosen = a)));
    await tester.pumpAndSettle();

    expect(find.textContaining('Maadi is 1.2 km away and delivers there'), findsOneWidget);
    await tester.tap(find.text('Send to Maadi'));
    await tester.pump(const Duration(milliseconds: 300));

    expect(chosen?.branchId, 2);
    expect(find.text('Goes to Maadi: they make it and deliver it'), findsOneWidget);
    await tester.tap(find.text('Keep it here'));
    await tester.pump(const Duration(milliseconds: 300));
    expect(chosen, isNull);
  });

  testWidgets('a paused branch says so and takes a second tap', (tester) async {
    DeliveryAlternative? chosen;
    await tester.pumpWidget(_host(_Chooser(alternatives: const [maadi, zamalek], onChosen: (a) => chosen = a)));
    await tester.pumpAndSettle();

    expect(find.textContaining('Paused right now'), findsOneWidget);
    await tester.tap(find.text('Send to Zamalek'));
    await tester.pump(const Duration(milliseconds: 300));
    expect(chosen, isNull);

    await tester.tap(find.text('Zamalek is paused. Send anyway?'));
    await tester.pump(const Duration(milliseconds: 300));
    expect(chosen?.branchId, 3);
  });
}

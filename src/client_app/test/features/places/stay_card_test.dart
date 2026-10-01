import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ninja_client/core/models/localized_text.dart';
import 'package:ninja_client/core/ui/ui.dart';
import 'package:ninja_client/core/utils/money.dart';
import 'package:ninja_client/features/places/models/place.dart';
import 'package:ninja_client/features/places/screens/stays_screen.dart';
import 'package:ninja_client/l10n/app_localizations.dart';

/// A stay in the history, as the web's card shows it: how long it ran large,
/// when, what it came to, the rates it ran at as a split bar, and who else
/// was there; a cancelled one before its clock started has no length.

const _options = [
  RateOption(code: 'single', name: LocalizedText(en: 'Single'), hourlyRate: 50),
  RateOption(code: 'multi', name: LocalizedText(en: 'Multi'), hourlyRate: 80),
];

Stay _stay({StayStatus status = StayStatus.completed, bool started = true}) => Stay(
      id: 1,
      placeId: 4,
      placeName: const LocalizedText(en: 'Room 1'),
      options: _options,
      createdAt: DateTime(2026, 10, 1, 19),
      startedAt: started ? DateTime(2026, 10, 1, 19) : null,
      endTime: started ? DateTime(2026, 10, 1, 20, 25) : null,
      totalCost: started ? 95 : null,
      status: status,
      customerId: 'me',
      members: [
        StayMember(customerId: 'me', customerName: 'Salma Adel', joinedAt: DateTime(2026, 10, 1, 19), role: 'Owner'),
        StayMember(customerId: 'omar', customerName: 'Omar Hany', joinedAt: DateTime(2026, 10, 1, 19, 5), role: 'Member'),
      ],
      segments: started
          ? [
              StaySegment(optionCode: 'single', optionName: const LocalizedText(en: 'Single'), hourlyRate: 50, startTime: DateTime(2026, 10, 1, 19), endTime: DateTime(2026, 10, 1, 20)),
              StaySegment(optionCode: 'multi', optionName: const LocalizedText(en: 'Multi'), hourlyRate: 80, startTime: DateTime(2026, 10, 1, 20), endTime: DateTime(2026, 10, 1, 20, 25)),
            ]
          : const [],
    );

Widget _host(Stay stay) => ProviderScope(
      overrides: [moneyProvider.overrideWithValue(MoneyFormat('EGP', const Locale('en')))],
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
        home: Scaffold(body: SizedBox(width: 390, child: StayCard(stay: stay, currentUserId: 'me'))),
      ),
    );

void main() {
  testWidgets('a finished stay: its length, when, what it came to, its two rates and who was there', (tester) async {
    await tester.pumpWidget(_host(_stay()));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(find.text('Room 1'), findsOneWidget);
    expect(find.text('Completed'), findsOneWidget);
    expect(find.textContaining('1h'), findsWidgets);
    expect(find.textContaining('25'), findsWidgets);
    expect(find.textContaining('95'), findsOneWidget);
    // The rates, one under the other beside the bar
    expect(find.text('Single'), findsOneWidget);
    expect(find.text('Multi'), findsOneWidget);
    // The others, by first name; not the customer themselves
    expect(find.text('With'), findsOneWidget);
    expect(find.text('Omar'), findsOneWidget);
    expect(find.text('Salma'), findsNothing);
  });

  testWidgets('cancelled before its clock started: no length to show', (tester) async {
    await tester.pumpWidget(_host(_stay(status: StayStatus.cancelled, started: false)));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(find.text('Cancelled'), findsOneWidget);
    expect(find.textContaining('min'), findsNothing);
  });
}

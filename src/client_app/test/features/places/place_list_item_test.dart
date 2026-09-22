import 'package:ninja_client/core/models/localized_text.dart';
import 'package:ninja_client/core/utils/money.dart';
import 'package:ninja_client/core/theme/theme_provider.dart';
import 'package:ninja_client/features/places/models/place.dart';
import 'package:ninja_client/features/places/screens/places_screen.dart';
import 'package:ninja_client/l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forui/forui.dart';

/// A room on the customer's list. The café's plan decides whether it can be
/// booked at all: with bookings off, the row still shows the room and its
/// rate — it is a real room — but nothing on it invites a reservation the
/// services would refuse.

final _room = Place(
  id: 1,
  kind: PlaceKind.room,
  name: const LocalizedText(en: 'Room 1', ar: 'اوضة ١'),
  displayStatus: PlaceStatus.available,
  isTimed: true,
  reservable: true,
  options: const [RateOption(code: 'single', name: LocalizedText(en: 'Single'), hourlyRate: 40)],
);

Widget _list(Place room, {required bool canReserve}) => ProviderScope(
      overrides: [
        // The café's currency, without the brand call that would fetch it
        moneyProvider.overrideWithValue(const MoneyFormat('EGP', Locale('en'))),
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
        builder: (context, child) => FTheme(
          data: const ThemeState(themeMode: AppThemeMode.light).getForuiTheme(context, locale: const Locale('en')),
          child: child!,
        ),
        home: Scaffold(body: PlaceListItem(room: room, canReserve: canReserve)),
      ),
    );

void main() {
  testWidgets('a room the café takes bookings for invites one', (tester) async {
    await tester.pumpWidget(_list(_room, canReserve: true));
    await tester.pump();

    expect(find.text('Room 1'), findsOneWidget);
    expect(find.byIcon(FIcons.calendarPlus), findsOneWidget);
  });

  testWidgets('with bookings out of the plan the same room is still listed, with nothing to book it by', (tester) async {
    await tester.pumpWidget(_list(_room, canReserve: false));
    await tester.pump();

    expect(find.text('Room 1'), findsOneWidget);
    expect(find.byIcon(FIcons.calendarPlus), findsNothing);
  });

  testWidgets('a room somebody else is in has nothing to book either', (tester) async {
    final occupied = Place(
      id: 2,
      kind: PlaceKind.room,
      name: const LocalizedText(en: 'Room 2'),
      displayStatus: PlaceStatus.occupied,
      isTimed: true,
      reservable: true,
      options: _room.options,
    );

    await tester.pumpWidget(_list(occupied, canReserve: true));
    await tester.pump();

    expect(find.text('Room 2'), findsOneWidget);
    expect(find.byIcon(FIcons.calendarPlus), findsNothing);
  });
}

import 'package:ninja_client/core/models/localized_text.dart';
import 'package:ninja_client/core/utils/money.dart';
import 'package:ninja_client/features/places/models/place.dart';
import 'package:ninja_client/features/places/screens/places_screen.dart';
import 'package:ninja_client/l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ninja_client/core/ui/ui.dart';
import 'package:ninja_client/core/brand/styles.dart';

/// A room on the customer's list. The business's plan decides whether it can be
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

Widget _list(Place room, {required bool canReserve, bool open = false}) =>
    _host(PlaceListItem(room: room, canReserve: canReserve, open: open));

Widget _host(Widget child) => ProviderScope(
      overrides: [
        // The business's currency, without the brand call that would fetch it
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
        theme: materialThemeFor(NinjaTheme.neutral(Brightness.light)),
        home: Scaffold(body: SingleChildScrollView(child: child)),
      ),
    );

void main() {
  testWidgets('a room the business takes bookings for invites one', (tester) async {
    await tester.pumpWidget(_list(_room, canReserve: true));
    await tester.pump();

    expect(find.text('Room 1'), findsOneWidget);
    expect(find.byIcon(LucideIcons.plus), findsOneWidget);
  });

  testWidgets('with bookings out of the plan the same room is still listed, with nothing to book it by', (tester) async {
    await tester.pumpWidget(_list(_room, canReserve: false));
    await tester.pump();

    expect(find.text('Room 1'), findsOneWidget);
    expect(find.byIcon(LucideIcons.plus), findsNothing);
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
    expect(find.byIcon(LucideIcons.plus), findsNothing);
  });

  testWidgets('a tap opens the booking under the card, not a sheet', (tester) async {
    await tester.pumpWidget(_list(_room, canReserve: true));
    await tester.pump();
    expect(find.text('Reserve Now'), findsNothing);

    await tester.pumpWidget(_list(_room, canReserve: true, open: true));
    await tester.pumpAndSettle();
    expect(find.text('10 minutes to arrive'), findsOneWidget);
    expect(find.text('Reserve Now'), findsOneWidget);
    expect(find.text("Start the time now, don't wait for me"), findsOneWidget);
    expect(find.byType(BottomSheet), findsNothing);
  });

  group('how the business lists its places', () {
    final table = Place(
      id: 3,
      kind: PlaceKind.table,
      name: const LocalizedText(en: 'Table 1'),
      displayStatus: PlaceStatus.available,
      isTimed: false,
      reservable: true,
    );
    final room2 = Place(
      id: 4,
      kind: PlaceKind.room,
      name: const LocalizedText(en: 'Room 2'),
      displayStatus: PlaceStatus.occupied,
      isTimed: true,
      reservable: true,
      options: _room.options,
    );

    test('the brand picks the layout; one this build does not know is the cards', () {
      expect(resolveLayout({'places': 'grid'}).places, PlacesLayout.grid);
      expect(resolveLayout({'places': 'list'}).places, PlacesLayout.list);
      expect(resolveLayout({'places': 'carousel'}).places, PlacesLayout.cards);
      expect(resolveLayout(null).places, PlacesLayout.cards);
    });

    testWidgets('as a list: a row a place, each kind under its heading when there are two', (tester) async {
      await tester.pumpWidget(_host(PlacesLaidOut(places: [_room, table, room2], layout: PlacesLayout.list)));
      await tester.pump();

      expect(find.byType(PlaceRow), findsNWidgets(3));
      expect(find.byType(PlaceListItem), findsNothing);
      expect(find.text('Rooms'), findsOneWidget);
      expect(find.text('Tables'), findsOneWidget);
      // The free ones can be booked, the busy one cannot
      expect(find.byIcon(LucideIcons.plus), findsNWidgets(2));
    });

    testWidgets('one kind needs no headings', (tester) async {
      await tester.pumpWidget(_host(PlacesLaidOut(places: [_room, room2], layout: PlacesLayout.list)));
      await tester.pump();

      expect(find.byType(PlaceRow), findsNWidgets(2));
      expect(find.text('Rooms'), findsNothing);
    });

    testWidgets('as a grid: two tiles a row, the open one on a row of its own with its booking', (tester) async {
      final room3 = Place(
        id: 5,
        kind: PlaceKind.room,
        name: const LocalizedText(en: 'Room 3'),
        displayStatus: PlaceStatus.available,
        isTimed: true,
        reservable: true,
        options: _room.options,
      );
      await tester.pumpWidget(_host(PlacesLaidOut(places: [_room, room2, room3], layout: PlacesLayout.grid)));
      await tester.pump();
      expect(find.byType(PlaceTile), findsNWidgets(3));
      expect(tester.takeException(), isNull);
      // Side by side: the first two share a row
      expect(tester.getTopLeft(find.text('Room 1')).dy, tester.getTopLeft(find.text('Room 2')).dy);

      await tester.pumpWidget(_host(PlacesLaidOut(places: [_room, room2, room3], layout: PlacesLayout.grid, openId: _room.id)));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(find.text('Reserve Now'), findsOneWidget);
      // The open one alone, the others paired after it
      expect(tester.getSize(find.byType(PlaceTile).first).width, greaterThan(tester.getSize(find.byType(PlaceTile).last).width));
      expect(tester.getTopLeft(find.text('Room 2')).dy, tester.getTopLeft(find.text('Room 3')).dy);
    });
  });
}

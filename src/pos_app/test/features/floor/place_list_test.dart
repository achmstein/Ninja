import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forui/forui.dart';
import 'package:pos_app/core/models/localized_text.dart';
import 'package:pos_app/core/theme/app_theme.dart';
import 'package:pos_app/features/floor/widgets/place_list.dart';
import 'package:pos_app/features/places/models/place.dart';
import 'package:pos_app/l10n/app_localizations.dart';

/// The column of places with no bill yet. What matters here is the café's
/// clock: with time billing out of the plan, a room that kept its rates is
/// a plain table on this floor — no running clock, no maintenance state —
/// or the till would send the cashier into a dialog Spaces refuses.

final _room = Place(
  id: 1,
  kind: PlaceKind.room,
  name: const LocalizedText(en: 'Room 1', ar: 'اوضة ١'),
  status: PlaceStatus.available,
  options: const [RateOption(code: 'single', name: LocalizedText(en: 'Single'), hourlyRate: 40)],
);

final _table = Place(
  id: 2,
  kind: PlaceKind.table,
  name: const LocalizedText(en: 'Table 4', ar: 'ترابيزة ٤'),
  status: PlaceStatus.available,
);

Stay _runningIn(Place place, {required Duration elapsed}) => Stay(
      id: 9,
      placeId: place.id,
      placeName: place.name,
      createdAt: DateTime.now().subtract(elapsed),
      startedAt: DateTime.now().subtract(elapsed),
      status: StayStatus.running,
      options: place.options,
    );

Widget _floor({required bool timeBilling, List<Stay> sessions = const [], List<Place>? places, void Function(Place)? onPick}) =>
    MaterialApp(
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
        child: FToaster(child: child!),
      ),
      home: Scaffold(
        body: SizedBox(
          width: 360,
          child: PlaceList(
            places: places ?? [_room, _table],
            sessions: sessions,
            tickets: const [],
            busy: false,
            timeBilling: timeBilling,
            onNewTab: () {},
            onPick: onPick ?? (_) {},
          ),
        ),
      ),
    );

void main() {
  testWidgets('a room with a clock running shows how long it has run', (tester) async {
    await tester.pumpWidget(_floor(timeBilling: true, sessions: [_runningIn(_room, elapsed: const Duration(minutes: 12, seconds: 5))]));
    await tester.pump();

    expect(find.text('Room 1'), findsOneWidget);
    expect(find.textContaining('12:0'), findsOneWidget); // mm:ss, a second either way
  });

  testWidgets('with the clock out of the plan, the same room is a plain place on the list', (tester) async {
    await tester.pumpWidget(_floor(timeBilling: false, sessions: [_runningIn(_room, elapsed: const Duration(minutes: 12, seconds: 5))]));
    await tester.pump();

    // Still a place the cashier can open a bill on, with nothing said about a clock
    expect(find.text('Room 1'), findsOneWidget);
    expect(find.textContaining('12:0'), findsNothing);
  });

  testWidgets('a room out of service is only out of service while the clock is in the plan', (tester) async {
    final closed = Place(
      id: 3,
      kind: PlaceKind.room,
      name: const LocalizedText(en: 'Room 3'),
      status: PlaceStatus.outOfService,
      options: _room.options,
    );

    await tester.pumpWidget(_floor(timeBilling: true, places: [closed]));
    await tester.pump();
    expect(find.text('Under maintenance'), findsOneWidget);

    await tester.pumpWidget(_floor(timeBilling: false, places: [closed]));
    await tester.pump();
    expect(find.text('Under maintenance'), findsNothing);
  });

  testWidgets('tapping a place hands it to the floor, clock or no clock', (tester) async {
    Place? picked;
    await tester.pumpWidget(_floor(timeBilling: false, places: [_room], onPick: (p) => picked = p));
    await tester.pump();

    await tester.tap(find.text('Room 1'));
    // forui's tap feedback runs on a timer of its own; let it finish
    await tester.pump(const Duration(milliseconds: 300));
    expect(picked?.id, 1);
  });

  testWidgets('a search narrows the list to what the cashier typed', (tester) async {
    await tester.pumpWidget(_floor(timeBilling: true));
    await tester.pump();
    expect(find.text('Table 4'), findsOneWidget);

    await tester.enterText(find.byType(TextField).first, 'Room');
    await tester.pump();
    expect(find.text('Room 1'), findsOneWidget);
    expect(find.text('Table 4'), findsNothing);
  });
}

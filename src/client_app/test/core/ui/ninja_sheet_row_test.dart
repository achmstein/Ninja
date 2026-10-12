import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ninja_client/core/shell/tuck.dart';
import 'package:ninja_client/features/cart/widgets/tray_model.dart' show DockMetrics;
import 'package:ninja_client/core/ui/ui.dart';

/// A sheet out of the dock's row moves as the order out of the tray's: tapped it springs up out of the
/// row's top edge, pulled it follows the finger and settles by the order's rule, and the dock stays as it
/// was under it

const _dockTop = 700.0;
const _screen = Size(390, 844);

late BuildContext _page;

Widget _host() => MaterialApp(
      theme: materialThemeFor(NinjaTheme.neutral(Brightness.light)),
      home: MediaQuery(
        data: const MediaQueryData(size: _screen),
        child: Builder(builder: (context) {
          _page = context;
          return Stack(
            children: [
              const Positioned.fill(child: ColoredBox(color: Colors.white)),
              // The dock's slab: its row's top edge is where the sheet comes out
              Positioned(left: 8, right: 8, top: _dockTop, height: 124, child: Container(key: dockSlabKey, color: Colors.black)),
            ],
          );
        }),
      ),
    );

Future<void> _open(RowOpen row) async {
  showNinjaSheet<void>(
    context: _page,
    fromRow: row,
    builder: (_) => const SizedBox(height: 300, child: Text('Inside')),
  );
}

/// How far the sheet's content stands below where it rests open
double _below(WidgetTester tester, double rest) => tester.getTopLeft(find.text('Inside')).dy - rest;

void main() {
  testWidgets('tapped, it springs up out of the row\'s top edge and rests on it', (tester) async {
    tester.view
      ..physicalSize = _screen
      ..devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(_host());
    await _open(RowOpen());
    await tester.pump();
    await tester.pumpAndSettle();
    // Open: the sheet as wide as the dock, standing a gap over the row
    final sheet = tester.getRect(find.ancestor(of: find.text('Inside'), matching: find.byType(DarkScope)));
    expect(sheet.left, 8);
    expect(sheet.right, 390 - 8);
    expect(sheet.bottom, _dockTop - DockMetrics.inset);
    final rest = tester.getTopLeft(find.text('Inside')).dy;

    // Shut: it goes back down into the row, nothing of it drawn under the row's top
    Navigator.of(_page, rootNavigator: true).pop();
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 60));
    expect(_below(tester, rest), greaterThan(0));
    await tester.pumpAndSettle();
    expect(find.text('Inside'), findsNothing);
  });

  testWidgets('pulled, it follows the finger, and let go short of the order\'s distance it goes back', (tester) async {
    tester.view
      ..physicalSize = _screen
      ..devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(_host());
    final row = RowOpen(held: true);
    await _open(row);
    await tester.pump();
    // Held: nothing of it shows till the finger moves
    await tester.pump(const Duration(milliseconds: 100));
    final shut = tester.getTopLeft(find.text('Inside')).dy;
    row.update(-40);
    await tester.pump();
    expect(shut - tester.getTopLeft(find.text('Inside')).dy, moreOrLessEquals(40, epsilon: 1));
    row.end(0);
    await tester.pumpAndSettle();
    expect(find.text('Inside'), findsNothing);
  });

  testWidgets('pulled past the order\'s distance it springs the rest of the way open', (tester) async {
    tester.view
      ..physicalSize = _screen
      ..devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(_host());
    final row = RowOpen(held: true);
    await _open(row);
    await tester.pump();
    row.update(-90);
    await tester.pump();
    row.end(0);
    await tester.pumpAndSettle();
    final sheet = tester.getRect(find.ancestor(of: find.text('Inside'), matching: find.byType(DarkScope)));
    expect(sheet.bottom, _dockTop - DockMetrics.inset);
    expect(find.text('Inside'), findsOneWidget);
  });
}

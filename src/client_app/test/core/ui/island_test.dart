import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ninja_client/core/ui/ui.dart';

/// The island's two faces, as client_web's lib/island.ts has them: the live
/// face stays until it is changed; a flash shows over it for a moment and
/// the island goes back to it, or away when there is none.

Widget _app(IslandController controller) => MaterialApp(
      theme: materialThemeFor(NinjaTheme.neutral(Brightness.light)),
      home: IslandHost(controller: controller, child: const SizedBox.expand()),
    );

void main() {
  test('a flash goes back to the live face, or away when there is none', () {
    final island = IslandController();
    expect(island.face, isNull);
    expect(island.busy.value, isFalse);

    island.flash(const IslandFace(title: Text('Saved')));
    expect(island.flashing, isTrue);
    island.end();
    expect(island.face, isNull);
    expect(island.busy.value, isFalse);

    const live = IslandFace(title: Text('Sent · #12'));
    island.live(live);
    expect(island.face, same(live));
    expect(island.flashing, isFalse);
    expect(island.busy.value, isTrue);

    const flash = IslandFace(title: Text('No connection'));
    island.flash(flash);
    expect(island.face, same(flash));
    island.end();
    expect(island.face, same(live));
    expect(island.busy.value, isTrue);
  });

  test('a live face changed under a flash waits for the flash to end', () {
    final island = IslandController();
    island.flash(const IslandFace(title: Text('Removed')));
    const live = IslandFace(title: Text('Confirmed · #12'));
    island.live(live);
    expect(island.face?.title, isA<Text>().having((t) => t.data, 'data', 'Removed'));
    island.end();
    expect(island.face, same(live));
    island.live(null);
    expect(island.face, isNull);
    expect(island.busy.value, isFalse);
  });

  testWidgets('the live face stays; a flash over it goes after its moment', (tester) async {
    final island = IslandController();
    await tester.pumpWidget(_app(island));

    island.live(const IslandFace(title: Text('Sent · #12')));
    await tester.pumpAndSettle();
    await tester.pump(const Duration(seconds: 10));
    expect(find.text('Sent · #12'), findsOneWidget);

    island.flash(const IslandFace(title: Text('No connection')), duration: const Duration(seconds: 2));
    await tester.pumpAndSettle();
    expect(find.text('No connection'), findsOneWidget);
    expect(find.text('Sent · #12'), findsNothing);

    await tester.pump(const Duration(seconds: 2));
    await tester.pumpAndSettle();
    expect(find.text('No connection'), findsNothing);
    expect(find.text('Sent · #12'), findsOneWidget);

    island.live(null);
    await tester.pumpAndSettle();
    expect(find.text('Sent · #12'), findsNothing);
  });

  testWidgets('opened out, the island says more under its line and puts its action below', (tester) async {
    final island = IslandController();
    var tapped = false;
    await tester.pumpWidget(_app(island));
    island.flash(
      IslandFace(
        title: const Text('Cancelled · #12'),
        icon: const Icon(LucideIcons.x),
        description: const Text('The café could not take this order.'),
        actionLabelOf: (context) => 'See your bill',
        onAction: () => tapped = true,
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('The café could not take this order.'), findsOneWidget);
    expect(tester.getTopLeft(find.text('See your bill')).dy, greaterThan(tester.getTopLeft(find.text('The café could not take this order.')).dy));

    await tester.tap(find.text('See your bill'));
    await tester.pumpAndSettle();
    expect(tapped, isTrue);
    expect(island.face, isNull);
  });
}

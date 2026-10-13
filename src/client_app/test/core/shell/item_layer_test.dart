import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ninja_client/core/shell/item_layer.dart';
import 'package:ninja_client/features/menu/item_link.dart';

/// An item opens in the frame's own layer, between the page and the dock: with none open every
/// touch goes through it to the page, one open is over the page and under the dock (which stays
/// in reach), and a page out of the frame opens its items over everything as before.

class _Frame extends StatefulWidget {
  const _Frame();

  @override
  State<_Frame> createState() => _FrameState();
}

class _FrameState extends State<_Frame> {
  final items = GlobalKey<NavigatorState>();
  int pageTaps = 0;
  int dockTaps = 0;

  @override
  Widget build(BuildContext context) => ItemLayer(
        navigator: items,
        child: Stack(
          fit: StackFit.expand,
          children: [
            // The page
            Builder(
              builder: (context) => Center(
                child: TextButton(
                  onPressed: () {
                    pageTaps++;
                    ItemLayer.maybeOf(context)!.push(PageRouteBuilder<void>(opaque: false, pageBuilder: (_, _, _) => const ColoredBox(color: Colors.white, child: Center(child: Text('item')))));
                  },
                  child: const Text('page'),
                ),
              ),
            ),
            ItemNavigator(navigatorKey: items),
            // The dock
            Positioned(
              bottom: 0,
              left: 0,
              right: 0,
              height: 60,
              child: TextButton(onPressed: () => dockTaps++, child: const Text('dock')),
            ),
          ],
        ),
      );
}

void main() {
  testWidgets('touches go through the empty layer; an item opens over the page and under the dock', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: Scaffold(body: _Frame())));
    final frame = tester.state<_FrameState>(find.byType(_Frame));

    await tester.tap(find.text('page'));
    await tester.pumpAndSettle();
    expect(frame.pageTaps, 1);
    expect(find.text('item'), findsOneWidget);

    // The dock stays in reach over the item
    await tester.tap(find.text('dock'));
    expect(frame.dockTaps, 1);

    // All shut at once, as when the page changes
    ItemLayer.closeAll(tester.element(find.text('dock')));
    await tester.pumpAndSettle();
    expect(find.text('item'), findsNothing);
  });

  testWidgets("the phone's back closes the item first", (tester) async {
    await tester.pumpWidget(const MaterialApp(home: Scaffold(body: _Frame())));
    await tester.tap(find.text('page'));
    await tester.pumpAndSettle();
    expect(find.text('item'), findsOneWidget);

    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(find.text('item'), findsNothing);
    expect(find.text('page'), findsOneWidget);
  });

  testWidgets('out of the frame there is no layer', (tester) async {
    await tester.pumpWidget(MaterialApp(home: Builder(builder: (context) => Text(ItemLayer.maybeOf(context) == null ? 'none' : 'layer'))));
    expect(find.text('none'), findsOneWidget);
  });

  test("an item's link reads its id; one that is not a number is no item", () {
    expect(itemIdFromLink('42'), 42);
    expect(itemIdFromLink('latte'), 0);
    expect(itemIdFromLink(null), 0);
  });
}

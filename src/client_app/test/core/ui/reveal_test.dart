import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ninja_client/core/ui/reveal.dart';

/// Something slid open below the edge is brought into view above the dock,
/// never so far that its own top leaves the screen.

// As the shell lays a page out: the dock's height as the bottom padding inside the scaffold, and a
// list with its own padding (which leaves that padding to its children)
Widget _page(ScrollController scroll, {required double opened}) => MaterialApp(
      home: Scaffold(
        body: MediaQuery(
          // The dock over the bottom of the page, 100 high
          data: const MediaQueryData(size: Size(400, 600), padding: EdgeInsets.only(bottom: 100)),
          child: ListView(
            controller: scroll,
            padding: EdgeInsets.zero,
            children: [
              const SizedBox(height: 500),
              Reveal(child: SizedBox(height: opened)),
              const SizedBox(height: 800),
            ],
          ),
        ),
      ),
    );

void main() {
  testWidgets('its end comes up above the dock', (tester) async {
    final scroll = ScrollController();
    await tester.pumpWidget(_page(scroll, opened: 200));
    await tester.pumpAndSettle();
    // Its end at 700, the view's end above the dock at 600 - 100 - 16 = 484
    expect(scroll.offset, closeTo(216, 1));
  });

  testWidgets('a tall one keeps its top on screen', (tester) async {
    final scroll = ScrollController();
    await tester.pumpWidget(_page(scroll, opened: 900));
    await tester.pumpAndSettle();
    // Only as far as its top, 16 below the view's top
    expect(scroll.offset, closeTo(484, 1));
  });
}

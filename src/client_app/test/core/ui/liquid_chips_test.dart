import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ninja_client/core/ui/ui.dart';

/// The categories' chips follow the one in view: the row scrolls it into view, and keeps it there
/// when that brings the row to its end (the last categories), in either direction.

Widget _host(int active, TextDirection direction) => MaterialApp(
      theme: materialThemeFor(NinjaTheme.neutral(Brightness.light)),
      home: Directionality(
        textDirection: direction,
        child: Scaffold(
          body: SizedBox(
            width: 390,
            child: LiquidChips(labels: [for (var i = 0; i < 10; i++) 'Category $i'], active: active, onSelect: (_) {}),
          ),
        ),
      ),
    );

void main() {
  for (final direction in TextDirection.values) {
    testWidgets('the last category in view brings its chip into view and keeps it there ($direction)', (tester) async {
      await tester.pumpWidget(_host(0, direction));
      await tester.pumpAndSettle();
      await tester.pumpWidget(_host(9, direction));
      await tester.pumpAndSettle();
      final chip = tester.getRect(find.text('Category 9'));
      expect(chip.left, greaterThanOrEqualTo(0));
      expect(chip.right, lessThanOrEqualTo(390));

      // And back to the first
      await tester.pumpWidget(_host(0, direction));
      await tester.pumpAndSettle();
      final first = tester.getRect(find.text('Category 0'));
      expect(first.left, greaterThanOrEqualTo(0));
      expect(first.right, lessThanOrEqualTo(390));
    });

    testWidgets('one in the middle comes into view too ($direction)', (tester) async {
      await tester.pumpWidget(_host(0, direction));
      await tester.pumpAndSettle();
      await tester.pumpWidget(_host(5, direction));
      await tester.pumpAndSettle();
      final chip = tester.getRect(find.text('Category 5'));
      expect(chip.left, greaterThanOrEqualTo(0));
      expect(chip.right, lessThanOrEqualTo(390));
    });
  }
}

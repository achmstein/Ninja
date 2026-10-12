import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ninja_client/core/ui/ui.dart';

/// A slab card on a page is the dark slab round what it holds; on a sheet (the slab already) it showed
/// only as its padding, the bill under the room's request tiles standing in from them, so it stands flat

Widget _host(Widget child) => MaterialApp(
      theme: materialThemeFor(NinjaTheme.neutral(Brightness.light)),
      home: Scaffold(body: Align(alignment: Alignment.topLeft, child: SizedBox(width: 300, child: child))),
    );

const _card = SlabCard(child: SizedBox(key: Key('in'), height: 40, width: double.infinity));

void main() {
  testWidgets('on a page the card pads what it holds', (tester) async {
    await tester.pumpWidget(_host(_card));
    expect(tester.getTopLeft(find.byKey(const Key('in'))), const Offset(20, 20));
  });

  testWidgets('on a sheet what it holds stands flat, in line with what is beside it', (tester) async {
    await tester.pumpWidget(_host(const DarkScope(child: _card)));
    expect(tester.getTopLeft(find.byKey(const Key('in'))), Offset.zero);
  });
}

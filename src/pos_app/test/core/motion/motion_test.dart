import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forui/forui.dart';
import 'package:pos_app/core/motion/motion.dart';
import 'package:pos_app/core/theme/app_theme.dart';

Widget _host(Widget child, {double width = 400, bool reduce = false}) => MaterialApp(
      builder: (context, app) => MediaQuery(
        data: MediaQuery.of(context).copyWith(disableAnimations: reduce),
        child: FTheme(
          data: const ThemeState(themeMode: AppThemeMode.light).getForuiTheme(context, locale: const Locale('en')),
          child: app!,
        ),
      ),
      home: Scaffold(body: Center(child: SizedBox(width: width, child: child))),
    );

/// The button's drawn shape: its size is the morph
Size _shape(WidgetTester tester) => tester.getSize(
      find.descendant(of: find.byType(MorphButton), matching: find.byType(DecoratedBox)).first,
    );

class _Harness extends StatefulWidget {
  final VoidCallback onPressed;
  const _Harness({required this.onPressed});

  @override
  State<_Harness> createState() => _HarnessState();
}

class _HarnessState extends State<_Harness> {
  MorphPhase phase = MorphPhase.idle;

  void go(MorphPhase next) => setState(() => phase = next);

  @override
  Widget build(BuildContext context) => MorphButton(
        phase: phase,
        onPressed: widget.onPressed,
        height: 56,
        doneLabel: 'Receipt #1234',
        label: const Text('Settle · 185.00'),
      );
}

void main() {
  group('MorphButton', () {
    testWidgets('idle is the full width and takes the tap', (tester) async {
      var taps = 0;
      await tester.pumpWidget(_host(_Harness(onPressed: () => taps++)));
      await tester.pumpAndSettle();

      expect(_shape(tester), const Size(400, 56));
      expect(find.text('Settle · 185.00'), findsOneWidget);
      await tester.tap(find.byType(MorphButton));
      expect(taps, 1);
    });

    testWidgets('busy draws in to a spinner pill and ignores taps', (tester) async {
      var taps = 0;
      await tester.pumpWidget(_host(_Harness(onPressed: () => taps++)));
      await tester.pumpAndSettle();
      final state = tester.state<_HarnessState>(find.byType(_Harness));

      state.go(MorphPhase.busy);
      await tester.pump();
      // Mid-spring it is somewhere between the two, never a cut
      await tester.pump(const Duration(milliseconds: 60));
      final mid = _shape(tester).width;
      expect(mid, lessThan(400));
      expect(mid, greaterThan(56 * 1.6));

      await tester.pump(const Duration(milliseconds: 500));
      expect(_shape(tester).width, closeTo(56 * 1.6, 1));
      expect(find.byType(CircularProgressIndicator), findsOneWidget);

      await tester.tap(find.byType(MorphButton), warnIfMissed: false);
      expect(taps, 0);
    });

    testWidgets('success closes to a circle, done opens to the receipt chip', (tester) async {
      await tester.pumpWidget(_host(_Harness(onPressed: () {})));
      await tester.pumpAndSettle();
      final state = tester.state<_HarnessState>(find.byType(_Harness));

      state.go(MorphPhase.busy);
      await tester.pump(const Duration(milliseconds: 400));
      state.go(MorphPhase.success);
      await tester.pumpAndSettle();
      expect(_shape(tester), const Size(56, 56));
      expect(find.byType(CircularProgressIndicator), findsNothing);

      state.go(MorphPhase.done);
      await tester.pumpAndSettle();
      expect(find.text('Receipt #1234'), findsOneWidget);
      final chip = _shape(tester).width;
      expect(chip, greaterThan(56));
      expect(chip, lessThan(400));
    });

    testWidgets('an error shakes it and it is a full-width button again', (tester) async {
      await tester.pumpWidget(_host(_Harness(onPressed: () {})));
      await tester.pumpAndSettle();
      final state = tester.state<_HarnessState>(find.byType(_Harness));
      final rest = tester.getTopLeft(find.descendant(of: find.byType(MorphButton), matching: find.byType(DecoratedBox)).first);

      state.go(MorphPhase.busy);
      await tester.pump(const Duration(milliseconds: 400));
      state.go(MorphPhase.error);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 60));
      final shaking = tester.getTopLeft(find.descendant(of: find.byType(MorphButton), matching: find.byType(DecoratedBox)).first);
      expect(shaking.dx, isNot(closeTo(rest.dx, 0.5)));

      await tester.pumpAndSettle();
      expect(_shape(tester), const Size(400, 56));
      expect(find.text('Settle · 185.00'), findsOneWidget);
    });

    testWidgets('with reduced motion the shape changes at once', (tester) async {
      await tester.pumpWidget(_host(_Harness(onPressed: () {}), reduce: true));
      await tester.pumpAndSettle();
      final state = tester.state<_HarnessState>(find.byType(_Harness));

      state.go(MorphPhase.success);
      await tester.pump();
      expect(_shape(tester).width, 56);
    });

    testWidgets('outline until it can be pressed, solid once it can', (tester) async {
      Widget button(bool ready) => _host(MorphButton(
            phase: MorphPhase.idle,
            solid: ready,
            onPressed: ready ? () {} : null,
            color: const Color(0xFF111111),
            label: const Text('Settle'),
          ));
      Color? fill(WidgetTester tester) =>
          ((tester.widget<DecoratedBox>(find.descendant(of: find.byType(MorphButton), matching: find.byType(DecoratedBox)).first))
                  .decoration as BoxDecoration)
              .color;

      await tester.pumpWidget(button(false));
      await tester.pumpAndSettle();
      expect(fill(tester)!.a, 0);

      await tester.pumpWidget(button(true));
      await tester.pump(const Duration(milliseconds: 100));
      final halfway = fill(tester)!.a;
      expect(halfway, greaterThan(0));
      expect(halfway, lessThan(1));
      await tester.pumpAndSettle();
      expect(fill(tester), const Color(0xFF111111));
    });
  });

  group('RollingNumber', () {
    test('splits the figure from what is around it', () {
      expect(splitNumber('185.00 EGP'), (prefix: '', number: '185.00', suffix: ' EGP'));
      expect(splitNumber(r'$12.50'), (prefix: r'$', number: '12.50', suffix: ''));
      expect(splitNumber('—'), (prefix: '—', number: '', suffix: ''));
    });

    testWidgets('only the digits that change roll, and it settles on the new figure', (tester) async {
      Widget figure(String text) => _host(RollingNumber(text, style: const TextStyle(fontSize: 20)));
      await tester.pumpWidget(figure('185.00 EGP'));
      await tester.pumpAndSettle();
      // At rest it is one plain Text
      expect(find.text('185.00 EGP'), findsOneWidget);

      await tester.pumpWidget(figure('175.00 EGP'));
      await tester.pump(const Duration(milliseconds: 80));
      // Mid-roll the old tens and the new are both on screen; the rest sit still
      expect(find.text('8'), findsOneWidget);
      expect(find.text('7'), findsOneWidget);
      expect(find.text('1'), findsOneWidget);
      expect(find.text(' EGP'), findsOneWidget);
      expect(find.byType(ClipRect), findsOneWidget);
      expect(find.bySemanticsLabel('175.00 EGP'), findsOneWidget);

      await tester.pumpAndSettle();
      expect(find.text('8'), findsNothing);
      expect(find.text('175.00 EGP'), findsOneWidget);
    });

    testWidgets('rolls up when the figure grows and down when it shrinks', (tester) async {
      Widget figure(String text) => _host(RollingNumber(text, style: const TextStyle(fontSize: 20)));
      await tester.pumpWidget(figure('3'));
      await tester.pumpAndSettle();
      final rest = tester.getTopLeft(find.text('3')).dy;

      await tester.pumpWidget(figure('4'));
      await tester.pump(const Duration(milliseconds: 40));
      // Bigger: the new digit comes up from below
      expect(tester.getTopLeft(find.text('4')).dy, greaterThan(rest));
      await tester.pumpAndSettle();

      await tester.pumpWidget(figure('2'));
      await tester.pump(const Duration(milliseconds: 40));
      expect(tester.getTopLeft(find.text('2')).dy, lessThan(rest));
      await tester.pumpAndSettle();
    });
  });

  group('Presence and ReflowItem', () {
    Widget column(List<String> names) => _host(Align(
          alignment: Alignment.topLeft,
          child: ReflowScope(
          child: Presence(
            exitDuration: Motion.slow,
            builder: (context, children) => Column(mainAxisSize: MainAxisSize.min, children: children),
            children: [for (final name in names) SizedBox(key: ValueKey(name), height: 40, child: Text(name))],
          ),
        )));

    testWidgets('a child that leaves stays for its exit, then the others glide up', (tester) async {
      await tester.pumpWidget(column(['a', 'b', 'c']));
      await tester.pumpAndSettle();
      final cBefore = tester.getTopLeft(find.text('c')).dy;

      await tester.pumpWidget(column(['a', 'c']));
      await tester.pump(const Duration(milliseconds: 100));
      // Still there, fading; nothing has moved yet
      expect(find.text('b'), findsOneWidget);
      expect(tester.getTopLeft(find.text('c')).dy, cBefore);

      await tester.pump(const Duration(milliseconds: 300));
      expect(find.text('b'), findsNothing);
      // Laid out 40 up already, but painted where it was, then on its way
      await tester.pump(const Duration(milliseconds: 16));
      expect(tester.getTopLeft(find.text('c')).dy, cBefore);
      await tester.pump(const Duration(milliseconds: 40));
      final moving = tester.getTopLeft(find.text('c')).dy;
      expect(moving, lessThan(cBefore));
      expect(moving, greaterThan(cBefore - 40));

      await tester.pumpAndSettle();
      expect(tester.getTopLeft(find.text('c')).dy, closeTo(cBefore - 40, 0.5));
    });

    testWidgets('a child that arrives is drawn by enter; the first ones are not', (tester) async {
      Widget list(List<String> names) => _host(ReflowScope(
            child: Presence(
              enter: (context, key, child) => SlideInItem(child: child),
              builder: (context, children) => Column(mainAxisSize: MainAxisSize.min, children: children),
              children: [for (final name in names) SizedBox(key: ValueKey(name), height: 40, child: Text(name))],
            ),
          ));
      await tester.pumpWidget(list(['a']));
      expect(find.byType(SlideInItem), findsNothing);

      await tester.pumpWidget(list(['a', 'b']));
      expect(find.byType(SlideInItem), findsOneWidget);
      await tester.pump(const Duration(milliseconds: 50));
      final opacity = tester.widget<Opacity>(find.ancestor(of: find.text('b'), matching: find.byType(Opacity)).first).opacity;
      expect(opacity, lessThan(1));
      await tester.pumpAndSettle();
      expect(find.ancestor(of: find.text('b'), matching: find.byType(Opacity)), findsNothing);
    });
  });
}

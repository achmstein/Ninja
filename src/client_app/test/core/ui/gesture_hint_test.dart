import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ninja_client/core/ui/gesture_hint.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// The first-visit cues (client_web's gestures/hints.ts, use-hint.ts,
/// gesture-timing.ts): each shown once on a device, one at a time, for as
/// long as its demo runs.
void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    hintBook.reset();
    cueOnScreen.value = null;
  });

  Future<Hint> loaded(HintKey key) async {
    final hint = Hint(key);
    await hintBook.load();
    await Future<void>.delayed(Duration.zero);
    return hint;
  }

  test('a cue is pending on a first visit, and nothing is pending before the device has been read', () async {
    final hint = Hint(HintKey.swipe);
    expect(hint.pending, isFalse);
    await hintBook.load();
    await Future<void>.delayed(Duration.zero);
    expect(hint.pending, isTrue);
  });

  test('a cue shown once is never pending again on this device, even in a later run', () async {
    final hint = await loaded(HintKey.swipe);
    hint.show();
    expect(hint.showing, isTrue);
    expect(cueOnScreen.value, HintKey.swipe);
    hint.done();
    expect(hint.showing, isFalse);
    expect(hint.pending, isFalse);
    expect(cueOnScreen.value, isNull);

    // Kept on the device
    await Future<void>.delayed(Duration.zero);
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getStringList(hintsStorageKey), contains('swipe'));

    // A later run reads it back
    hintBook.reset();
    final again = await loaded(HintKey.swipe);
    expect(again.pending, isFalse);
    again.show();
    expect(again.showing, isFalse);
  });

  test('showing records it at once, so leaving mid-cue does not replay it', () async {
    final hint = await loaded(HintKey.zoom);
    hint.show();
    hint.dispose();
    expect(cueOnScreen.value, isNull);
    hintBook.reset();
    expect((await loaded(HintKey.zoom)).pending, isFalse);
  });

  test('one cue on screen at a time: another waits, still pending', () async {
    final swipe = await loaded(HintKey.swipe);
    final tray = await loaded(HintKey.tray);
    swipe.show();
    tray.show();
    expect(tray.showing, isFalse);
    expect(tray.pending, isTrue);
    swipe.done();
    tray.show();
    expect(tray.showing, isTrue);
  });

  test('the customer doing the gesture first is the same as being shown it', () async {
    final hold = await loaded(HintKey.holdAdd);
    hold.done();
    expect(hold.pending, isFalse);
    hintBook.reset();
    expect((await loaded(HintKey.holdAdd)).pending, isFalse);
  });

  test("the demo's timing: two passes, a pause between, the cue up a breath longer", () {
    expect(gestureRun(GestureKind.swipe), const Duration(milliseconds: 200 + 1600 * 2 + 500));
    expect(gestureShown(GestureKind.pinch), const Duration(milliseconds: 200 + 2200 * 2 + 500 + 300));
    expect(gesturePassAt(GestureKind.swipe, Duration.zero), 0);
    expect(gesturePassAt(GestureKind.swipe, const Duration(milliseconds: 1000)), closeTo(0.5, 1e-9));
    // Held at the end of the first pass during the pause, then the second pass
    expect(gesturePassAt(GestureKind.swipe, const Duration(milliseconds: 2000)), 1);
    expect(gesturePassAt(GestureKind.swipe, const Duration(milliseconds: 2300 + 800)), closeTo(0.5, 1e-9));
    expect(gesturePassAt(GestureKind.swipe, const Duration(seconds: 10)), 1);
  });

  test('keyframes run through their values at their times', () {
    const values = [0.0, -56.0, 0.0, -28.0, 0.0];
    const times = [0.0, 0.3, 0.55, 0.75, 1.0];
    expect(keyframes(values, times, 0), 0);
    expect(keyframes(values, times, 0.3), -56);
    expect(keyframes(values, times, 0.75), -28);
    expect(keyframes(values, times, 1), 0);
    // Eased in and out: half way between two is half way
    expect(keyframes(values, times, 0.15), closeTo(-28, 1e-9));
  });

  testWidgets('under reduced motion there is no fingertip, the words carry the cue', (tester) async {
    await tester.pumpWidget(
      const MediaQuery(
        data: MediaQueryData(disableAnimations: true),
        child: Directionality(
          textDirection: TextDirection.ltr,
          child: GestureHint(kind: GestureKind.swipe),
        ),
      ),
    );
    expect(find.byType(CustomPaint), findsNothing);
    expect(find.byType(DecoratedBox), findsNothing);
  });

  testWidgets('the fingertip plays its demo and stops', (tester) async {
    await tester.pumpWidget(
      const Directionality(
        textDirection: TextDirection.ltr,
        child: GestureHint(kind: GestureKind.pinch),
      ),
    );
    // Two fingertips for the pinch
    expect(find.byType(Container), findsNWidgets(2));
    await tester.pump(gestureRun(GestureKind.pinch));
    await tester.pump(const Duration(milliseconds: 100));
    expect(tester.takeException(), isNull);
  });
}

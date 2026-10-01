import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ninja_client/core/brand/brand_provider.dart';
import 'package:ninja_client/core/brand/tenant_brand.dart';
import 'package:ninja_client/core/shell/top_bar.dart';

/// The top bar is the top of the page: it goes up as the page scrolls down past it, comes back on
/// the way up, and is always there at the top. On the deck it goes past the first card.
const _bar = 64.0;

/// The bar's settling is timed by the clock on the wall, which a pump does not move
Future<void> _settle(WidgetTester tester) => tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 350)));

/// The neutral brand, without asking the network for it
class _Brand extends BrandNotifier {
  @override
  TenantBrand build() => TenantBrand.neutral;
}

ProviderContainer _container() {
  final container = ProviderContainer(overrides: [brandProvider.overrideWith(_Brand.new)]);
  addTearDown(container.dispose);
  return container;
}

void main() {
  test('stays at the top of the page', () {
    expect(topBarAt(40, _bar, 0, false).hidden, isFalse);
    expect(topBarAt(30, _bar, 400, true).hidden, isFalse);
  });

  test('goes up once a scroll down runs past the slack', () {
    expect(topBarAt(305, _bar, 300, false), (hidden: false, from: 300.0));
    expect(topBarAt(320, _bar, 300, false), (hidden: true, from: 320.0));
  });

  test('comes back once a scroll up runs past the slack', () {
    expect(topBarAt(595, _bar, 600, true), (hidden: true, from: 600.0));
    expect(topBarAt(580, _bar, 600, true), (hidden: false, from: 580.0));
  });

  test('stays up at the end of the page, unlike the dock', () {
    expect(topBarAt(2000, _bar, 1900, true).hidden, isTrue);
  });

  testWidgets('a list scrolled down sends it up, and back up brings it back', (tester) async {
    final container = _container();
    final scroll = ScrollController();
    addTearDown(scroll.dispose);
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          home: TopBarOnScroll(
            child: ListView(controller: scroll, children: [for (var i = 0; i < 60; i++) SizedBox(height: 80, child: Text('$i'))]),
          ),
        ),
      ),
    );
    scroll.jumpTo(600);
    await tester.pump();
    expect(container.read(topBarHiddenProvider), isTrue);
    // A jitter does nothing, once the bar's own settling is over
    await _settle(tester);
    scroll.jumpTo(595);
    await tester.pump();
    expect(container.read(topBarHiddenProvider), isTrue);
    scroll.jumpTo(500);
    await tester.pump();
    expect(container.read(topBarHiddenProvider), isFalse);
  });

  testWidgets('on cards a page each it goes past the first card and comes back on it', (tester) async {
    final container = _container();
    final pages = PageController();
    addTearDown(pages.dispose);
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          home: TopBarOnScroll(
            child: PageView(controller: pages, scrollDirection: Axis.vertical, children: [for (var i = 0; i < 4; i++) Text('card $i')]),
          ),
        ),
      ),
    );
    pages.jumpToPage(2);
    await tester.pump();
    expect(container.read(topBarHiddenProvider), isTrue);
    await _settle(tester);
    pages.jumpToPage(1);
    await tester.pump();
    expect(container.read(topBarHiddenProvider), isTrue);
    await _settle(tester);
    pages.jumpToPage(0);
    await tester.pump();
    expect(container.read(topBarHiddenProvider), isFalse);
  });
}

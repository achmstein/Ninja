import 'package:flutter_test/flutter_test.dart';
import 'package:ninja_client/core/models/localized_text.dart';
import 'package:ninja_client/features/cart/models/cart_item.dart';
import 'package:ninja_client/features/cart/widgets/tray_model.dart';

/// The port of client_web's tray-model.test.ts
CartItem _line(int productId, {int quantity = 1, double price = 10}) => CartItem(
      productId: productId,
      productName: LocalizedText(en: 'Item $productId'),
      unitPrice: price,
      quantity: quantity,
      pictureUri: '/pic/$productId',
    );

void main() {
  group('traySummary', () {
    test('counts and totals every line, the newest first, the rest as a number', () {
      final summary = traySummary([
        _line(1, quantity: 2, price: 25),
        _line(2),
        _line(3),
        _line(4),
        _line(5, price: 40),
      ], max: 3);
      expect(summary.count, 6);
      expect(summary.total, 50 + 10 + 10 + 10 + 40);
      expect(summary.thumbs.map((t) => t.productId), [5, 4, 3]);
      expect(summary.more, 2);
    });

    test('is empty for an empty order', () {
      final summary = traySummary(const []);
      expect(summary.thumbs, isEmpty);
      expect(summary.more, 0);
      expect(summary.count, 0);
      expect(summary.total, 0);
    });
  });

  group('trayOpensAfterDrag', () {
    test('opens when dragged or flicked up, and stays shut otherwise', () {
      expect(trayOpensAfterDrag(false, -80, 0), isTrue);
      expect(trayOpensAfterDrag(false, -10, -500), isTrue);
      expect(trayOpensAfterDrag(false, -20, 0), isFalse);
    });

    test('closes when dragged or flicked down, and stays open otherwise', () {
      expect(trayOpensAfterDrag(true, 80, 0), isFalse);
      expect(trayOpensAfterDrag(true, 5, 600), isFalse);
      expect(trayOpensAfterDrag(true, 20, 0), isTrue);
    });
  });

  test('a short screen draws the dock a size down', () {
    expect(DockMetrics.of(700).row, 58);
    expect(DockMetrics.of(700).tabs, 48);
    expect(DockMetrics.of(844).row, 68);
    expect(DockMetrics.of(844).pill, 44);
  });
}

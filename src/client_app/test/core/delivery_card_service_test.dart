import 'dart:ui';

import 'package:ninja_client/core/services/delivery_card_service.dart';
import 'package:ninja_client/l10n/app_localizations.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('DeliveryLive', () {
    test('reads the live view and hands the card the server\'s own names', () {
      final live = DeliveryLive.fromJson({
        'orderId': 482,
        'stage': 'OnTheWay',
        'version': 5,
        'riderName': ' Mahmoud ',
        'riderPhone': '01112223334',
        'progress': 40,
        'etaMinutes': 12,
        'nearby': false,
        'customerComing': true,
      });

      expect(live.isLive, isTrue);
      expect(live.riderName, 'Mahmoud');
      expect(live.toCard(), {
        'orderId': 482,
        'stage': 'OnTheWay',
        'version': 5,
        'riderName': 'Mahmoud',
        'riderPhone': '01112223334',
        'progress': 40,
        'etaMinutes': 12,
        'nearby': false,
        'coming': true,
        'failureReason': '',
      });
    });

    test('what is not said is empty, so the card drops it', () {
      final live = DeliveryLive.fromJson({'orderId': 7, 'stage': 'Delivered', 'version': 9, 'riderPhone': null});

      expect(live.isLive, isFalse);
      expect(live.toCard()['riderPhone'], '');
      expect(live.toCard()['progress'], isNull);
    });
  });

  group('the card\'s words', () {
    for (final locale in const [Locale('en'), Locale('ar'), Locale('ar', '001')]) {
      test('every template keeps its blank to fill in ($locale)', () {
        final words = deliveryCardStrings(lookupAppLocalizations(locale), 'Cove');

        expect(words['order'], contains('{number}'));
        expect(words['about'], contains('{minutes}'));
        for (final key in ['bringing', 'nearRider', 'knows']) {
          expect(words[key], contains('{rider}'), reason: key);
        }
        expect(words['callCafe'], contains('Cove'));
        expect(words['failed'], contains('Cove'));
        expect(words.values.where((w) => w.isEmpty), isEmpty);
      });
    }

    test('never says dish', () {
      final words = deliveryCardStrings(lookupAppLocalizations(const Locale('en')), 'Cove');
      expect(words.values.any((w) => w.toLowerCase().contains('dish')), isFalse);
    });
  });
}

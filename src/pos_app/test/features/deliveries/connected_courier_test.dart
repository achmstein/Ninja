import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pos_app/features/deliveries/models/delivery_order.dart';
import 'package:pos_app/features/deliveries/widgets/delivery_dialog.dart';
import 'package:pos_app/l10n/app_localizations.dart';

DeliveryOrder _connected({String stage = 'Assigned', String? courierName}) => DeliveryOrder.fromJson({
      'orderNumber': 9,
      'total': 140,
      'delivery': {
        'address': 'Road 9',
        'phone': '01001234567',
        'stage': stage,
        'courierProviderId': 7,
        'courierProvider': 'Fast Couriers',
        'courierName': courierName,
        'courierJobId': 'FC-1',
        'courierTrackingUrl': 'https://track.test/FC-1',
      },
    });

void main() {
  final l10n = lookupAppLocalizations(const Locale('en'));

  test('reads a connected company\'s job and its tracking link', () {
    final d = _connected().delivery;
    expect(d.courierJobId, 'FC-1');
    expect(d.courierTrackingUrl, 'https://track.test/FC-1');
  });

  test('a connected company that has not said who it sends is waited on, then named', () {
    expect(stageText(l10n, _connected()), 'Waiting for Fast Couriers to send a courier');
    expect(stageText(l10n, _connected(courierName: 'Karim')), l10n.deliveryWith('Fast Couriers · Karim'));
    expect(stageText(l10n, _connected(stage: 'OnTheWay')), l10n.deliveryOnTheWayWith('Fast Couriers'));
  });
}

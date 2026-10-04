import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:rider_app/core/services/push_service.dart';

void main() {
  test('a push names what happened and to which order', () {
    final event = PushEvent.of(const RemoteMessage(data: {'type': 'delivery_assigned', 'orderId': '42'}), opened: true);
    expect(event!.type, 'delivery_assigned');
    expect(event.orderId, 42);
    expect(event.opened, isTrue);
  });

  test('a push without a type is not one the app acts on, and a bad order id is none', () {
    expect(PushEvent.of(const RemoteMessage(data: {'orderId': '42'})), isNull);
    expect(PushEvent.of(const RemoteMessage(data: {'type': 'delivery_unassigned', 'orderId': 'x'}))!.orderId, 0);
  });
}

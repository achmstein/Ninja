import 'package:dio/dio.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pos_app/features/deliveries/delivery_errors.dart';
import 'package:pos_app/l10n/app_localizations.dart';

DioException _answer(int status, [Object? data]) {
  final options = RequestOptions(path: '/x');
  return DioException.badResponse(statusCode: status, requestOptions: options, response: Response(requestOptions: options, statusCode: status, data: data));
}

void main() {
  test('a refusal is said from its code, in the till\'s language, never in the server\'s words', () async {
    final ar = await AppLocalizations.delegate.load(const Locale('ar'));
    expect(describeDeliveryError(_answer(400, {'code': 'delivery.out_of_range', 'title': 'This address is outside…'}), ar), ar.deliveryErrorOutOfRange);
    expect(describeDeliveryError(_answer(400, {'code': 'rider.unknown'}), ar), ar.deliveryErrorUnknownRider);
    expect(describeDeliveryError(_answer(409), ar), ar.deliveryErrorConflict);
    expect(describeDeliveryError(_answer(402, {'code': 'module.off'}), ar), ar.deliveryErrorNotDelivering);
    expect(describeDeliveryError(_answer(400, 'The order has left with its rider'), ar), ar.deliveryActionFailed);
  });

  test('nothing reaching the server is said as offline', () async {
    final en = await AppLocalizations.delegate.load(const Locale('en'));
    expect(describeDeliveryError(DioException.connectionError(requestOptions: RequestOptions(path: '/'), reason: 'down'), en), en.deliveryErrorOffline);
  });
}

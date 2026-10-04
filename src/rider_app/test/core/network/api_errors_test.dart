import 'package:dio/dio.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:rider_app/core/network/api_errors.dart';
import 'package:rider_app/l10n/app_localizations.dart';

DioException _answer(int status, [Object? data]) {
  final options = RequestOptions(path: '/x');
  return DioException.badResponse(statusCode: status, requestOptions: options, response: Response(requestOptions: options, statusCode: status, data: data));
}

void main() {
  test('reads what failed from the code, not the words', () {
    expect(classifyError(_answer(400, {'code': 'delivery.not_out', 'title': 'The order hasn\'t left yet.'})), ApiFailure.notOutYet);
    expect(classifyError(_answer(400, {'code': 'delivery.already_out'})), ApiFailure.alreadyOut);
    expect(classifyError(_answer(400, {'code': 'delivery.already_settled'})), ApiFailure.alreadyDone);
    expect(classifyError(_answer(403, {'code': 'rider.not_yours'})), ApiFailure.notYours);
    expect(classifyError(_answer(409)), ApiFailure.conflict);
    expect(classifyError(_answer(402, {'code': 'module.off'})), ApiFailure.notDelivering);
    expect(classifyError(_answer(400, 'The order has left with its rider')), ApiFailure.other);
  });

  test('nothing reaching the server is offline', () {
    expect(classifyError(DioException.connectionError(requestOptions: RequestOptions(path: '/x'), reason: 'down')), ApiFailure.offline);
  });

  test("never shows the server's English to an Arabic rider", () async {
    final ar = await AppLocalizations.delegate.load(const Locale('ar'));
    final said = describeError(_answer(400, 'The order has left with its rider'), ar);
    expect(said, ar.somethingWentWrong);
    expect(describeError(_answer(400, {'code': 'delivery.not_out'}), ar), ar.errorNotOutYet);
  });
}

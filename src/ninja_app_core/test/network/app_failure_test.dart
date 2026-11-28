import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ninja_app_core/network/app_failure.dart';

DioException answered(int status, Object? data) {
  final options = RequestOptions(path: '/x');
  return DioException(
    requestOptions: options,
    type: DioExceptionType.badResponse,
    response: Response<dynamic>(requestOptions: options, statusCode: status, data: data),
  );
}

void main() {
  test('reads offline, signed out, a refusal and anything else', () {
    final offline = DioException(requestOptions: RequestOptions(path: '/x'), type: DioExceptionType.connectionError);
    expect(AppFailure.from(offline), isA<OfflineFailure>());
    expect(AppFailure.from(answered(401, null)), isA<SignedOutFailure>());

    final refused = AppFailure.from(answered(409, {'code': 'delivery.conflict', 'title': 'Taken'}));
    expect(refused, isA<ServerFailure>());
    refused as ServerFailure;
    expect((refused.status, refused.code, refused.reason), (409, 'delivery.conflict', 'Taken'));

    expect(AppFailure.from(const FormatException('bad')), isA<UnknownFailure>());
  });

  test("prefers a short text body, then the title, then the detail as the server's reason", () {
    expect(serverReason(answered(400, 'Shift is closed')), 'Shift is closed');
    expect(serverReason(answered(400, {'title': 'T', 'detail': 'D'})), 'T');
    expect(serverReason(answered(400, {'detail': 'D'})), 'D');
    expect(serverReason(answered(400, 'x' * 300)), isNull);
    expect(serverReason(Exception('no answer')), isNull);
  });
}

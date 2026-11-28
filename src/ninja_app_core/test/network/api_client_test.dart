import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ninja_app_core/network/api_client.dart';

class _Tokens implements TokenSource {
  @override
  Future<String?> getAccessToken() async => 'token';

  @override
  Future<bool> refreshToken() async => false;
}

/// Answers every request with {} and keeps the headers it was sent
class _Recorder implements HttpClientAdapter {
  final sent = <Map<String, dynamic>>[];

  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<Uint8List>? requestStream, Future<void>? cancelFuture) async {
    sent.add(Map.of(options.headers));
    return ResponseBody.fromString(jsonEncode({}), 200, headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    });
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  late _Recorder recorder;
  late ApiClient client;

  setUp(() {
    recorder = _Recorder();
    client = ApiClient(_Tokens(), baseUrl: 'https://api.test/', branchIdGetter: () => 3);
    client.dio.httpClientAdapter = recorder;
  });

  test('sends the token, the selected branch and a request id on a change', () async {
    await client.get<dynamic>('x');
    await client.post<dynamic>('x');
    expect(recorder.sent[0]['Authorization'], 'Bearer token');
    expect(recorder.sent[0]['X-Branch-Id'], '3');
    expect(recorder.sent[0].containsKey('x-requestid'), isFalse);
    expect(recorder.sent[1]['x-requestid'], isNotEmpty);
  });

  test('a branch the call names itself wins, then an inBranch zone, then the selected one', () async {
    await client.get<dynamic>('x', headers: {'X-Branch-Id': '9'});
    await inBranch(5, () => client.get<dynamic>('x'));
    expect(recorder.sent[0]['X-Branch-Id'], '9');
    expect(recorder.sent[1]['X-Branch-Id'], '5');
  });

  test("keeps the caller's request id and headers together", () async {
    await client.post<dynamic>('x', requestId: 'r-1', headers: {'X-Extra': 'yes'});
    expect(recorder.sent.single['x-requestid'], 'r-1');
    expect(recorder.sent.single['X-Extra'], 'yes');
  });
}

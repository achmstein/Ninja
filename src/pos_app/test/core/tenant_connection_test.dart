import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pos_app/core/config/tenant_connection.dart';

/// A stack that answers /api/tenant on some hosts and not others
class _Stacks extends Interceptor {
  final Map<String, Object?> answers;
  final List<String> asked = [];
  _Stacks(this.answers);

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    asked.add(options.uri.toString());
    final answer = answers[options.uri.origin];
    if (answer == null) {
      return handler.reject(DioException.connectionError(requestOptions: options, reason: 'no such host'));
    }
    if (answer is int) {
      return handler.reject(DioException.badResponse(
        statusCode: answer,
        requestOptions: options,
        response: Response(requestOptions: options, statusCode: answer, data: {'code': 'paused'}),
      ));
    }
    handler.resolve(Response(requestOptions: options, statusCode: 200, data: answer));
  }
}

Dio _dio(_Stacks stacks) => Dio()..interceptors.add(stacks);

void main() {
  group('the hosts an address means', () {
    test('the gateway host as typed, with or without a scheme', () {
      expect(TenantConnection.candidates('api.lucaffe.ninja.app'), ['https://api.lucaffe.ninja.app']);
      expect(TenantConnection.candidates(' https://api.lucaffe.ninja.app/ '), ['https://api.lucaffe.ninja.app']);
    });

    test("the café's own host first, then its api. host", () {
      expect(TenantConnection.candidates('lucaffe.ninja.app'),
          ['https://lucaffe.ninja.app', 'https://api.lucaffe.ninja.app']);
      expect(TenantConnection.candidates('admin.lucaffe.ninja.app'),
          ['https://admin.lucaffe.ninja.app', 'https://api.lucaffe.ninja.app']);
    });

    test('the dev machine stays as typed', () {
      expect(TenantConnection.candidates('http://localhost:5000'), ['http://localhost:5000']);
      expect(TenantConnection.candidates('http://10.0.2.2:5000/api/tenant'), ['http://10.0.2.2:5000']);
      expect(TenantConnection.candidates('https://api.cove.localhost'), ['https://api.cove.localhost']);
    });

    test('nothing, and not an address, mean nothing', () {
      expect(TenantConnection.candidates(''), isEmpty);
      expect(TenantConnection.candidates('   '), isEmpty);
    });
  });

  group('probing', () {
    final tenant = {
      'name': {'en': 'Lucaffe', 'ar': 'لوكافيه'},
      'auth': {'authority': 'https://auth.ninja.app/realms/lucaffe'},
    };

    test('keeps the first host that is a café, with its realm', () async {
      final stacks = _Stacks({'https://api.lucaffe.ninja.app': tenant});
      final c = await TenantConnection.probe('lucaffe.ninja.app', dio: _dio(stacks));
      expect(c.apiUrl, 'https://api.lucaffe.ninja.app');
      expect(c.authority, 'https://auth.ninja.app/realms/lucaffe');
      expect(c.cafeName, 'Lucaffe');
      expect(c.host, 'api.lucaffe.ninja.app');
      expect(stacks.asked, ['https://lucaffe.ninja.app/api/tenant', 'https://api.lucaffe.ninja.app/api/tenant']);
    });

    test('a stack that did not name its realm leaves the authority to the build', () async {
      final stacks = _Stacks({'http://localhost:5000': {'name': {'en': 'Chillax'}}});
      final c = await TenantConnection.probe('http://localhost:5000', dio: _dio(stacks));
      expect(c.authority, isNull);
    });

    test('says why when no host answers, is not a café, or is paused', () async {
      expect(
        () => TenantConnection.probe('nowhere.example', dio: _dio(_Stacks({}))),
        throwsA(isA<ConnectException>().having((e) => e.failure, 'failure', ConnectFailure.unreachable)),
      );
      expect(
        () => TenantConnection.probe('api.blog.example', dio: _dio(_Stacks({'https://api.blog.example': {'title': 'hi'}}))),
        throwsA(isA<ConnectException>().having((e) => e.failure, 'failure', ConnectFailure.notACafe)),
      );
      expect(
        () => TenantConnection.probe('api.late.ninja.app', dio: _dio(_Stacks({'https://api.late.ninja.app': 503}))),
        throwsA(isA<ConnectException>().having((e) => e.failure, 'failure', ConnectFailure.paused)),
      );
      expect(
        () => TenantConnection.probe('', dio: _dio(_Stacks({}))),
        throwsA(isA<ConnectException>().having((e) => e.failure, 'failure', ConnectFailure.invalidAddress)),
      );
    });
  });

  test('the record round-trips through the device', () {
    const c = TenantConnection(apiUrl: 'https://api.x.ninja.app', authority: null, cafeName: 'X');
    final back = TenantConnection.fromJson(c.toJson());
    expect(back?.apiUrl, c.apiUrl);
    expect(back?.authority, isNull);
    expect(back?.cafeName, 'X');
    expect(TenantConnection.fromJson({'apiUrl': ''}), isNull);
    expect(TenantConnection.fromJson('junk'), isNull);
  });
}

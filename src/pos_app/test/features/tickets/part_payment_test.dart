import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ninja_app_core/network/api_client.dart';
import 'package:pos_app/features/tickets/models/enums.dart';
import 'package:pos_app/features/tickets/models/ticket_detail.dart';
import 'package:pos_app/features/tickets/services/tickets_service.dart';

/// What the repository sent, answered with what the server would say
class _Api implements ApiClient {
  final Object? Function(String path) answer;
  _Api(this.answer);

  final List<(String path, Object? data, String? requestId)> posts = [];

  @override
  Future<Response<T>> post<T>(String path, {dynamic data, String? requestId, Map<String, dynamic>? headers}) async {
    posts.add((path, data, requestId));
    return Response<T>(requestOptions: RequestOptions(path: path), statusCode: 200, data: answer(path) as T?);
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError('${invocation.memberName}');
}

/// A refusal in the domain's own words
class _Refusing implements ApiClient {
  @override
  Future<Response<T>> post<T>(String path, {dynamic data, String? requestId, Map<String, dynamic>? headers}) async {
    final options = RequestOptions(path: path);
    throw DioException(
      requestOptions: options,
      response: Response<dynamic>(requestOptions: options, statusCode: 400, data: 'That pays the bill in full.'),
    );
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError('${invocation.memberName}');
}

/// Part payments on an open bill: how the bill reads with them, how it
/// reads from a server that never heard of them, and what the till sends.
void main() {
  test('an open bill reads its part payments, what they come to and the lines they paid for', () {
    final ticket = TicketDetail.fromJson({
      'id': 7,
      'status': 'Open',
      'total': 300,
      'lines': [
        {'id': 1, 'total': 120, 'customerName': 'Sara', 'paid': true},
        {'id': 2, 'total': 180},
      ],
      'partPayments': [
        {
          'id': 4,
          'tender': 'Card',
          'amount': 120,
          'payerName': 'Sara',
          'lineIds': [1],
          'recordedBy': 'Mona',
          'recordedAt': '2026-11-27T10:00:00Z',
        },
        {'id': 5, 'tender': 'Cash', 'amount': '30.50', 'payerName': null, 'lineIds': <dynamic>[], 'recordedBy': 'Mona', 'recordedAt': '2026-11-27T10:05:00Z'},
      ],
      'partPaid': 150.5,
    });

    expect(ticket.partPaid, 150.5);
    expect(ticket.partPayments.map((p) => p.id), [4, 5]);
    final first = ticket.partPayments.first;
    expect(first.tender, PaymentTender.card);
    expect(first.amount, 120);
    expect(first.payerName, 'Sara');
    expect(first.lineIds, [1]);
    expect(first.recordedBy, 'Mona');
    expect(first.recordedAt, DateTime.utc(2026, 11, 27, 10));
    final second = ticket.partPayments.last;
    expect(second.tender, PaymentTender.cash);
    expect(second.amount, 30.5);
    expect(second.payerName, isNull);
    expect(second.lineIds, isEmpty);
    expect(ticket.lines.map((l) => l.paid), [true, false]);
  });

  test('a server from before part payments: none taken, nothing paid, no line paid', () {
    final ticket = TicketDetail.fromJson({
      'id': 7,
      'total': 300,
      'lines': [
        {'id': 1, 'total': 300},
      ],
      'payments': [
        {'id': 1, 'tender': 'Cash', 'amount': 300},
      ],
    });
    expect(ticket.partPayments, isEmpty);
    expect(ticket.partPaid, 0);
    expect(ticket.lines.single.paid, isFalse);
    expect(ticket.payments.single.partPaymentId, isNull);
    expect(ticket.payments.single.canChangeTender, isTrue);

    final part = PartPayment.fromJson({'id': 1});
    expect(part.lineIds, isEmpty);
    expect(part.recordedBy, '');
    expect(part.recordedAt, isNull);
  });

  test('a settled bill says which payments were taken as parts, and those keep their method', () {
    final ticket = TicketDetail.fromJson({
      'id': 7,
      'status': 'Settled',
      'total': 300,
      'payments': [
        {'id': 1, 'tender': 'Cash', 'amount': 120, 'partPaymentId': 4},
        {'id': 2, 'tender': 'Cash', 'amount': 180},
      ],
    });
    expect(ticket.payments.map((p) => p.partPaymentId), [4, null]);
    expect(ticket.payments.map((p) => p.canChangeTender), [false, true]);
  });

  test('the answer to a part payment reads, and a repeated request has no ids', () {
    final result = PartPaymentResult.fromJson({
      'partPaymentIds': [4],
      'paid': 120,
      'remaining': '180.00',
    });
    expect(result.partPaymentIds, [4]);
    expect(result.paid, 120);
    expect(result.remaining, 180);

    final repeated = PartPaymentResult.fromJson({'partPaymentIds': <dynamic>[], 'paid': 120, 'remaining': 180});
    expect(repeated.partPaymentIds, isEmpty);
  });

  test('taking a part sends one tender, who paid and their lines, under the request id', () async {
    final api = _Api((_) => <String, dynamic>{
          'partPaymentIds': [4],
          'paid': 120,
          'remaining': 180,
        });
    final result = await ApiTicketsRepository(api).takePartPayment(
      7,
      tender: PaymentTender.card,
      amount: 120,
      payerName: 'Sara',
      lineIds: [1, 3],
      requestId: 'r-1',
    );

    final (path, data, requestId) = api.posts.single;
    expect(path, 'tickets/7/part-payments');
    expect(requestId, 'r-1');
    expect(data, {
      'payments': [
        {'tender': PaymentTender.card.value, 'amount': 120.0},
      ],
      'payerName': 'Sara',
      'lineIds': [1, 3],
    });
    expect(result.partPaymentIds, [4]);
    expect(result.remaining, 180);
  });

  test('an amount on account of the bill names no lines', () async {
    final api = _Api((_) => <String, dynamic>{'partPaymentIds': [5], 'paid': 50, 'remaining': 250});
    await ApiTicketsRepository(api).takePartPayment(7, tender: PaymentTender.cash, amount: 50);
    final data = api.posts.single.$2 as Map<String, dynamic>;
    expect(data['lineIds'], isEmpty);
    expect(data['payerName'], isNull);
  });

  test('giving a part back posts to its own return', () async {
    final api = _Api((_) => <String, dynamic>{'partPaymentIds': [4], 'paid': 0, 'remaining': 300});
    final result = await ApiTicketsRepository(api).returnPartPayment(7, 4, requestId: 'r-2');
    final (path, _, requestId) = api.posts.single;
    expect(path, 'tickets/7/part-payments/4/return');
    expect(requestId, 'r-2');
    expect(result.paid, 0);
    expect(result.remaining, 300);
  });

  test('a refusal comes back in the server\'s words', () {
    expect(
      ApiTicketsRepository(_Refusing()).takePartPayment(7, tender: PaymentTender.cash, amount: 300),
      throwsA(isA<SalesException>().having((e) => e.message, 'message', 'That pays the bill in full.')),
    );
  });
}

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ninja_client/features/service_request/models/service_request.dart';
import 'package:ninja_client/features/service_request/services/service_request_service.dart';

/// The customer's requests as the staff have them: read from the server,
/// a sent one shown at once, a taken-back one gone at once.

ServiceRequestResponse _request(int id, ServiceRequestStatus status, {String? by}) => ServiceRequestResponse(
      id: id,
      userName: 'Salma',
      placeId: 4,
      requestType: ServiceRequestType.callWaiter,
      status: status,
      createdAt: DateTime(2026, 10, 1, 20),
      acknowledgedBy: by,
    );

class _Requests implements ServiceRequestRepository {
  List<ServiceRequestResponse> mine;

  _Requests(this.mine);

  @override
  Future<List<ServiceRequestResponse>> getMine() async => mine;

  @override
  Future<void> cancel(int id) async => mine = mine.where((r) => r.id != id).toList();

  @override
  Future<ServiceRequestResponse> createRequest(CreateServiceRequest request) => throw UnimplementedError();
}

void main() {
  test('reads the requests, adds a sent one at once and drops a taken-back one', () async {
    final repo = _Requests([_request(1, ServiceRequestStatus.acknowledged, by: 'Omar')]);
    final container = ProviderContainer(overrides: [serviceRequestRepositoryProvider.overrideWithValue(repo)]);
    addTearDown(container.dispose);
    final sub = container.listen(myRequestsProvider, (_, _) {});
    addTearDown(sub.close);

    await Future<void>.delayed(Duration.zero);
    expect(container.read(myRequestsProvider).single.acknowledgedBy, 'Omar');
    expect(container.read(myRequestsProvider).single.isOpen, isTrue);

    container.read(myRequestsProvider.notifier).add(_request(2, ServiceRequestStatus.pending));
    expect(container.read(myRequestsProvider).map((r) => r.id), [2, 1]);

    container.read(myRequestsProvider.notifier).remove(2);
    expect(container.read(myRequestsProvider).map((r) => r.id), [1]);
  });

  test('a done or cancelled request is no longer open', () {
    expect(_request(1, ServiceRequestStatus.completed).isOpen, isFalse);
    expect(_request(1, ServiceRequestStatus.cancelled).isOpen, isFalse);
    expect(_request(1, ServiceRequestStatus.pending).isOpen, isTrue);
  });

  test('acknowledgedBy is read from the server', () {
    final request = ServiceRequestResponse.fromJson({
      'id': 7,
      'userName': 'Salma',
      'placeId': 4,
      'requestType': 1,
      'status': 2,
      'createdAt': '2026-10-01T20:00:00Z',
      'acknowledgedBy': 'Omar',
    });
    expect(request.acknowledgedBy, 'Omar');
    expect(request.status, ServiceRequestStatus.acknowledged);
  });
}

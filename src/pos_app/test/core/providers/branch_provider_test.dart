import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pos_app/core/auth/auth_service.dart';
import 'package:pos_app/core/models/branch.dart';
import 'package:pos_app/core/models/localized_text.dart';
import 'package:pos_app/core/providers/branch_provider.dart';
import 'package:pos_app/core/services/branch_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _FakeAuth extends AuthService {
  final AuthState _state;
  _FakeAuth(this._state);

  @override
  AuthState build() => _state;

  @override
  Future<void> initialize() async {}
}

class _FakeBranches implements BranchRepository {
  @override
  Future<List<Branch>> getBranches() async => [
        for (final id in [1, 2, 3])
          Branch(id: id, name: LocalizedText(en: 'Branch $id'), isActive: true, displayOrder: id),
      ];

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError('${invocation.memberName}');
}

AuthState signedIn({required bool owner, List<int> branches = const []}) => AuthState(
      isInitializing: false,
      isAuthenticated: true,
      isPosUser: true,
      isOwner: owner,
      userId: 'u1',
      roles: [owner ? 'Owner' : 'Cashier'],
      branches: branches,
    );

Future<ProviderContainer> containerFor(AuthState auth) async {
  SharedPreferences.setMockInitialValues({});
  await initializeBranch();
  final container = ProviderContainer(overrides: [
    authServiceProvider.overrideWith(() => _FakeAuth(auth)),
    branchRepositoryProvider.overrideWithValue(_FakeBranches()),
  ]);
  addTearDown(container.dispose);
  return container;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('a cashier sees only the branches in the token and lands on the first', () async {
    final container = await containerFor(signedIn(owner: false, branches: [2, 3]));
    await container.read(branchProvider.notifier).loadBranches();
    final state = container.read(branchProvider);
    expect([for (final b in state.branches) b.id], [2, 3]);
    expect(state.selectedBranchId, 2);
    expect(state.noBranch, isFalse);
  });

  test('an owner sees every branch', () async {
    final container = await containerFor(signedIn(owner: true));
    await container.read(branchProvider.notifier).loadBranches();
    expect(container.read(branchProvider).branches, hasLength(3));
  });

  test('no claim means no branch and nothing selected', () async {
    final container = await containerFor(signedIn(owner: false));
    await container.read(branchProvider.notifier).loadBranches();
    final state = container.read(branchProvider);
    expect(state.branches, isEmpty);
    expect(state.selectedBranchId, isNull);
    expect(state.noBranch, isTrue);
  });
}

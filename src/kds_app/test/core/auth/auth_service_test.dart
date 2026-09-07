import 'package:flutter_test/flutter_test.dart';
import 'package:kds_app/core/auth/auth_service.dart';

void main() {
  group('extractBranches', () {
    test('reads the multivalued claim as sorted, distinct ids', () {
      expect(AuthService.extractBranches({'branches': ['2', '1', '2']}), [1, 2]);
    });

    test('a scalar claim is one branch', () {
      expect(AuthService.extractBranches({'branches': '3'}), [3]);
    });

    test('a missing claim is no branch, never every branch', () {
      expect(AuthService.extractBranches({}), isEmpty);
      expect(AuthService.extractBranches({'branches': null}), isEmpty);
    });

    test('values that are not ids are dropped', () {
      expect(AuthService.extractBranches({'branches': ['x', '', '4']}), [4]);
    });
  });
}

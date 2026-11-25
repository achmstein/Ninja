import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:ninja_app_core/auth/auth_service.dart';

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

  group('isFresh', () {
    String token(Object? exp) {
      String part(Object value) => base64Url.encode(utf8.encode(json.encode(value))).replaceAll('=', '');
      return '${part({'alg': 'none'})}.${part({'sub': 'rider', 'exp': exp})}.sig';
    }

    final now = DateTime.utc(2026, 11, 25, 1, 40, 48);
    int at(DateTime t) => t.millisecondsSinceEpoch ~/ 1000;
    const leeway = Duration(seconds: 30);

    test('a token with minutes left is fresh', () {
      expect(AuthService.isFresh(token(at(now.add(const Duration(minutes: 4)))), now, leeway), isTrue);
    });

    test('a token that ran out, or runs out within the leeway, is not', () {
      expect(AuthService.isFresh(token(at(now.subtract(const Duration(minutes: 5)))), now, leeway), isFalse);
      expect(AuthService.isFresh(token(at(now.add(const Duration(seconds: 10)))), now, leeway), isFalse);
    });

    test('a token whose expiry cannot be read is taken as spent', () {
      expect(AuthService.isFresh(token(null), now, leeway), isFalse);
      expect(AuthService.isFresh('not-a-jwt', now, leeway), isFalse);
      expect(AuthService.isFresh('a.!!!.c', now, leeway), isFalse);
    });
  });

  group('holdsAllBranches', () {
    test('a star is every branch, lists no id', () {
      expect(AuthService.holdsAllBranches({'branches': ['*']}), isTrue);
      expect(AuthService.holdsAllBranches({'branches': '*'}), isTrue);
      expect(AuthService.extractBranches({'branches': ['*']}), isEmpty);
    });

    test('ids alone, or no claim, are not every branch', () {
      expect(AuthService.holdsAllBranches({'branches': ['1', '2']}), isFalse);
      expect(AuthService.holdsAllBranches({}), isFalse);
    });
  });
}

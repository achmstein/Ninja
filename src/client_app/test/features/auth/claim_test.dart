import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forui/forui.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:ninja_client/core/brand/brand_service.dart';
import 'package:ninja_client/core/brand/tenant_brand.dart';
import 'package:ninja_client/core/models/localized_text.dart';
import 'package:ninja_client/core/theme/theme_provider.dart';
import 'package:ninja_client/features/auth/claim/claim_screen.dart';
import 'package:ninja_client/features/auth/claim/claim_service.dart';
import 'package:ninja_client/l10n/app_localizations.dart';

const _token = '7b4e2fee6aa04cd59851c04be2220a00.Qm9vdHN0cmFwLXRoZS1zZWNyZXQtb2YtNDMtY2hhcnM';

/// Identity answering the claim endpoints however the test says
class _Claims implements ClaimRepository {
  final ClaimFailure? previewFails;
  final ClaimFailure? claimFails;

  _Claims({this.previewFails, this.claimFails});

  @override
  Future<ClaimPreview> preview(String token) async {
    if (previewFails != null) throw ClaimException(previewFails!);
    return const ClaimPreview(name: 'Salma Nabil', phoneNumber: '01012345678');
  }

  @override
  Future<String> claim(String token, String email, String password) async {
    if (claimFails != null) throw ClaimException(claimFails!);
    return email;
  }
}

/// The café, answering without the network
class _Tenant implements TenantRepository {
  @override
  Future<TenantBrand> getBrand() async => const TenantBrand(name: LocalizedText(en: 'Chillax', ar: 'تشيلاكس'));
}

Widget _app(ClaimRepository claims, {String? token}) => ProviderScope(
      overrides: [
        claimRepositoryProvider.overrideWithValue(claims),
        tenantRepositoryProvider.overrideWithValue(_Tenant()),
      ],
      child: MaterialApp(
        locale: const Locale('en'),
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: AppLocalizations.supportedLocales,
        builder: (context, child) => FTheme(
          data: const ThemeState(themeMode: AppThemeMode.light).getForuiTheme(context, locale: const Locale('en')),
          child: child!,
        ),
        home: ClaimScreen(token: token),
      ),
    );

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  group('claimTokenFrom', () {
    test('reads the token off the link the till shared', () {
      expect(claimTokenFrom('https://chillax.site/claim?token=$_token'), _token);
      expect(claimTokenFrom('  https://cafe.example/claim?token=$_token  '), _token);
    });

    test('takes a link pasted without its scheme, or the bare token', () {
      expect(claimTokenFrom('chillax.site/claim?token=$_token'), _token);
      expect(claimTokenFrom(_token), _token);
    });

    test('anything else is no token', () {
      expect(claimTokenFrom(null), isNull);
      expect(claimTokenFrom(''), isNull);
      expect(claimTokenFrom('hello'), isNull);
      expect(claimTokenFrom('https://chillax.site/p/12'), isNull);
      expect(claimTokenFrom('https://chillax.site/claim?token=nope'), isNull);
    });
  });

  group('failureOf', () {
    test('says why in the words the screen uses', () {
      expect(failureOf(404, {'reason': 'invalid'}), ClaimFailure.invalid);
      expect(failureOf(410, {'reason': 'used'}), ClaimFailure.used);
      expect(failureOf(410, {'reason': 'expired'}), ClaimFailure.expired);
      expect(failureOf(409, {'field': 'email'}), ClaimFailure.emailTaken);
      expect(failureOf(400, {'field': 'password'}), ClaimFailure.badPassword);
      expect(failureOf(400, {'field': 'email'}), ClaimFailure.badEmail);
      expect(failureOf(429, null), ClaimFailure.tooManyAttempts);
      expect(failureOf(null, null), ClaimFailure.network);
    });
  });

  group('ClaimScreen', () {
    testWidgets('shows who the café added, read-only, above the form', (tester) async {
      await tester.pumpWidget(_app(_Claims(), token: _token));
      await tester.pumpAndSettle();

      expect(find.text('Salma Nabil'), findsOneWidget);
      expect(find.text('01012345678'), findsOneWidget);
      expect(find.text('Create my account'), findsOneWidget);
    });

    testWidgets('an expired link asks for a new one', (tester) async {
      await tester.pumpWidget(_app(_Claims(previewFails: ClaimFailure.expired), token: _token));
      await tester.pumpAndSettle();

      expect(find.text('This link has expired. Ask the café for a new one.'), findsOneWidget);
      expect(find.text('Use another code'), findsOneWidget);
    });

    testWidgets('a used link sends them to sign in', (tester) async {
      await tester.pumpWidget(_app(_Claims(previewFails: ClaimFailure.used), token: _token));
      await tester.pumpAndSettle();

      expect(find.text('This link was already used. Sign in instead.'), findsOneWidget);
      expect(find.text('Use another code'), findsNothing);
    });

    testWidgets('a taken email is said under the email field', (tester) async {
      await tester.pumpWidget(_app(_Claims(claimFails: ClaimFailure.emailTaken), token: _token));
      await tester.pumpAndSettle();

      final fields = find.byType(EditableText);
      await tester.enterText(fields.at(0), 'salma@example.com');
      await tester.enterText(fields.at(1), 'a-good-password');
      await tester.enterText(fields.at(2), 'a-good-password');
      await tester.ensureVisible(find.text('Create my account'));
      await tester.tap(find.text('Create my account'));
      await tester.pumpAndSettle();

      expect(find.text('That email already has an account'), findsOneWidget);
    });

    testWidgets('a short password never leaves the phone', (tester) async {
      await tester.pumpWidget(_app(_Claims(), token: _token));
      await tester.pumpAndSettle();

      final fields = find.byType(EditableText);
      await tester.enterText(fields.at(0), 'salma@example.com');
      await tester.enterText(fields.at(1), 'short');
      await tester.enterText(fields.at(2), 'short');
      await tester.ensureVisible(find.text('Create my account'));
      await tester.tap(find.text('Create my account'));
      await tester.pumpAndSettle();

      expect(find.text('Password must be at least 8 characters.'), findsOneWidget);
    });

    testWidgets('from the sign-in page, a pasted link that is not one says so', (tester) async {
      await tester.pumpWidget(_app(_Claims()));
      await tester.pumpAndSettle();

      expect(find.text('Have a code from the café?'), findsOneWidget);
      await tester.enterText(find.byType(EditableText).first, 'not a link');
      await tester.ensureVisible(find.text('Continue'));
      await tester.tap(find.text('Continue'));
      await tester.pumpAndSettle();

      expect(find.text("This link isn't valid."), findsOneWidget);
    });
  });
}

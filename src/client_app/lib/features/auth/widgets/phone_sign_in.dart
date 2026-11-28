import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/auth/auth_service.dart';
import '../../../core/brand/brand_provider.dart';
import '../../../core/theme/theme_provider.dart';
import '../../../core/ui/ui.dart';
import '../../../core/widgets/app_text.dart';
import '../../../l10n/app_localizations.dart';

/// The account by phone, on the app's own sheet: the number, the code that
/// went to it, and for a number that is new the name the business will call
/// its owner by. One thing asked at a time. The business's sign-in does all
/// of it (src/keycloak-phone, by the token endpoint): the code is its own
/// and so are the tokens. Resolves true once signed in.
Future<bool> showPhoneSignIn(BuildContext context) async =>
    await showNinjaSheet<bool>(context: context, builder: (context) => const _PhoneSignIn()) ?? false;

enum _Step { phone, code, name }

class _PhoneSignIn extends ConsumerStatefulWidget {
  const _PhoneSignIn();

  @override
  ConsumerState<_PhoneSignIn> createState() => _PhoneSignInState();
}

class _PhoneSignInState extends ConsumerState<_PhoneSignIn> {
  static const _digits = 6;

  final _phone = TextEditingController();
  final _code = TextEditingController();
  final _first = TextEditingController();
  final _last = TextEditingController();
  _Step _step = _Step.phone;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _phone.dispose();
    _code.dispose();
    _first.dispose();
    _last.dispose();
    super.dispose();
  }

  String get _number => ref.read(brandProvider).locale.normalizePhone(_phone.text);

  String? _say(AppLocalizations l10n, PhoneAnswer answer) => switch (answer) {
        PhoneAnswer.signedIn || PhoneAnswer.codeSent || PhoneAnswer.nameNeeded => null,
        PhoneAnswer.unavailable => l10n.phoneSignInUnavailable,
        PhoneAnswer.invalid => l10n.phoneSignInInvalid,
        PhoneAnswer.tooSoon => l10n.phoneSignInTooSoon,
        PhoneAnswer.tooMany => l10n.phoneSignInTooMany,
        PhoneAnswer.codeWrong => l10n.phoneSignInCodeWrong,
        PhoneAnswer.codeGone => l10n.phoneSignInCodeGone,
        PhoneAnswer.failed => l10n.phoneSignInFailed,
      };

  Future<void> _ask(Future<PhoneAnswer> Function(AuthService auth) request) async {
    final l10n = AppLocalizations.of(context)!;
    setState(() {
      _busy = true;
      _error = null;
    });
    final answer = await request(ref.read(authServiceProvider.notifier));
    if (!mounted) return;
    if (answer == PhoneAnswer.signedIn) {
      Navigator.of(context, rootNavigator: true).pop(true);
      return;
    }
    setState(() {
      _busy = false;
      _error = _say(l10n, answer);
      if (answer == PhoneAnswer.codeSent) _step = _Step.code;
      if (answer == PhoneAnswer.nameNeeded) _step = _Step.name;
      // A code that is no longer good is typed again once another is sent
      if (answer == PhoneAnswer.codeWrong || answer == PhoneAnswer.codeGone) _code.clear();
    });
  }

  void _sendCode() {
    if (!ref.read(brandProvider).locale.isValidPhone(_phone.text)) {
      setState(() => _error = AppLocalizations.of(context)!.phoneSignInInvalid);
      return;
    }
    _ask((auth) => auth.requestPhoneCode(_number));
  }

  void _checkCode() {
    if (_code.text.length < _digits || _busy) return;
    _ask((auth) => auth.signInWithPhone(_number, _code.text));
  }

  void _finish() {
    if (_first.text.trim().isEmpty || _last.text.trim().isEmpty) {
      setState(() => _error = AppLocalizations.of(context)!.phoneSignInNameMissing);
      return;
    }
    _ask((auth) => auth.signInWithPhone(_number, _code.text, firstName: _first.text.trim(), lastName: _last.text.trim()));
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final colors = theme.colors;
    final l10n = AppLocalizations.of(context)!;
    final note = context.localeText(theme.typography.note.copyWith(color: colors.mutedForeground));
    final link = context.localeText(theme.typography.note.copyWith(color: colors.foreground, fontWeight: FontWeight.w700));

    final (String title, String hint) = switch (_step) {
      _Step.phone => (l10n.phoneSignInTitle, l10n.phoneSignInHint),
      _Step.code => (l10n.phoneSignInCodeTitle, '${l10n.phoneSignInCodeHint} \u2066$_number\u2069'),
      _Step.name => (l10n.phoneSignInNameTitle, l10n.phoneSignInNameHint),
    };

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(title, style: context.localeText(theme.typography.headline.copyWith(fontWeight: FontWeight.w800, color: colors.foreground))),
        const SizedBox(height: 4),
        Text(hint, style: note),
        const SizedBox(height: 16),
        if (_error != null) ...[
          Text(_error!, style: context.localeText(theme.typography.note.copyWith(color: colors.destructive))),
          const SizedBox(height: 12),
        ],
        ...switch (_step) {
          _Step.phone => [
              NinjaField(
                controller: _phone,
                hint: ref.watch(brandProvider).locale.phonePlaceholder,
                autofocus: true,
                keyboardType: TextInputType.phone,
                autofillHints: const [AutofillHints.telephoneNumber],
                textInputAction: TextInputAction.done,
                onSubmit: (_) => _sendCode(),
              ),
              const SizedBox(height: 16),
              NinjaButton(lifted: true, busy: _busy, onPress: _busy ? null : _sendCode, child: AppText(l10n.phoneSignInSend)),
            ],
          _Step.code => [
              // The code goes in by itself once it is all typed; the phone's own suggestion fills it
              NinjaField(
                controller: _code,
                autofocus: true,
                keyboardType: TextInputType.number,
                autofillHints: const [AutofillHints.oneTimeCode],
                inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(_digits)],
                onChange: (_) => _checkCode(),
                onSubmit: (_) => _checkCode(),
              ),
              const SizedBox(height: 16),
              NinjaButton(lifted: true, busy: _busy, onPress: _busy ? null : _checkCode, child: AppText(l10n.phoneSignInContinue)),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  GestureDetector(
                    onTap: _busy ? null : () => _ask((auth) => auth.requestPhoneCode(_number)),
                    child: Text(l10n.phoneSignInResend, style: link),
                  ),
                  GestureDetector(
                    onTap: _busy
                        ? null
                        : () => setState(() {
                              _step = _Step.phone;
                              _error = null;
                              _code.clear();
                            }),
                    child: Text(l10n.phoneSignInChange, style: link),
                  ),
                ],
              ),
            ],
          _Step.name => [
              NinjaField(
                controller: _first,
                label: AppText(l10n.firstName),
                autofocus: true,
                textCapitalization: TextCapitalization.words,
                autofillHints: const [AutofillHints.givenName],
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: 12),
              NinjaField(
                controller: _last,
                label: AppText(l10n.lastName),
                textCapitalization: TextCapitalization.words,
                autofillHints: const [AutofillHints.familyName],
                textInputAction: TextInputAction.done,
                onSubmit: (_) => _finish(),
              ),
              const SizedBox(height: 16),
              NinjaButton(lifted: true, busy: _busy, onPress: _busy ? null : _finish, child: AppText(l10n.phoneSignInContinue)),
            ],
        },
      ],
    );
  }
}

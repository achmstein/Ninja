import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import 'package:ninja_app_core/theme/text_styles.dart';

import '../../core/auth/auth_service.dart';
import '../../core/auth/cashier_sign_in.dart';
import '../../core/widgets/pos_dialog.dart';
import '../../core/widgets/toast_helpers.dart';
import '../../l10n/app_localizations.dart';
import 'cashier_roster.dart';

const int _maxDigits = 6;
const int _minDigits = 4;

/// The pad a cashier types their PIN on to take over the till. True once
/// they are signed in. The PIN is only ever held here, as dots, until it is
/// sent (core/auth/cashier_sign_in.dart).
Future<bool> showPinSignIn(BuildContext context, Cashier cashier) async {
  final signedIn = await showPosDialog<bool>(
    context,
    maxWidth: 360,
    builder: (context) => _PinSignIn(cashier: cashier),
  );
  return signedIn == true;
}

class _PinSignIn extends ConsumerStatefulWidget {
  final Cashier cashier;
  const _PinSignIn({required this.cashier});

  @override
  ConsumerState<_PinSignIn> createState() => _PinSignInState();
}

class _PinSignInState extends ConsumerState<_PinSignIn> {
  String _pin = '';
  bool _busy = false;
  String? _error;

  void _press(String key) {
    if (_busy) return;
    setState(() {
      _error = null;
      if (key == 'back') {
        if (_pin.isNotEmpty) _pin = _pin.substring(0, _pin.length - 1);
      } else if (_pin.length < _maxDigits) {
        _pin += key;
      }
    });
  }

  Future<void> _signIn() async {
    final l10n = AppLocalizations.of(context)!;
    setState(() {
      _busy = true;
      _error = null;
    });
    final result = await ref.read(authServiceProvider.notifier).signInWithPin(widget.cashier.username, _pin);
    if (!mounted) return;
    if (result == PinSignIn.success) {
      Navigator.of(context, rootNavigator: true).pop(true);
      return;
    }
    setState(() {
      _busy = false;
      _pin = '';
      _error = switch (result) {
        PinSignIn.wrong => l10n.pinWrong,
        PinSignIn.unavailable => l10n.pinUnavailable,
        PinSignIn.notAuthorized => l10n.accessDeniedDescription,
        _ => l10n.pinSignInFailed,
      };
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final keyStyle = theme.typography.xl.forButton.copyWith(
      fontWeight: FontWeight.w600,
      fontFeatures: const [FontFeature.tabularFigures()],
    );

    Widget key(String label, {Widget? child}) => Expanded(
          child: SizedBox(
            height: Sizes.controlLarge,
            child: FButton(
              variant: FButtonVariant.outline,
              onPress: _busy ? null : () => _press(label),
              child: child ?? Text(label, style: keyStyle),
            ),
          ),
        );
    Widget row(List<Widget> keys) => Row(
          children: [
            for (final (index, k) in keys.indexed) ...[
              if (index > 0) const SizedBox(width: 8),
              k,
            ],
          ],
        );

    return DialogScroll(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            widget.cashier.name,
            style: theme.typography.xl.copyWith(fontWeight: FontWeight.w700),
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 4),
          Text(
            l10n.enterYourPin,
            style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          // What has been typed, as dots: never the digits
          Semantics(
            label: l10n.pinDigitsTyped(_pin.length),
            child: SizedBox(
              height: 24,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  for (var i = 0; i < _maxDigits; i++)
                    Container(
                      width: 14,
                      height: 14,
                      margin: const EdgeInsets.symmetric(horizontal: 6),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: i < _pin.length ? theme.colors.foreground : null,
                        border: Border.all(color: i < _pin.length ? theme.colors.foreground : theme.colors.border, width: 1.5),
                      ),
                    ),
                ],
              ),
            ),
          ),
          SizedBox(
            height: 36,
            child: Center(
              child: _error == null
                  ? null
                  : Text(
                      _error!,
                      style: theme.typography.sm.copyWith(color: theme.colors.destructive, fontWeight: FontWeight.w500),
                      textAlign: TextAlign.center,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
            ),
          ),
          // Digits read left to right in Arabic too, as on every keypad
          Directionality(
            textDirection: TextDirection.ltr,
            child: Column(
              children: [
                row([key('1'), key('2'), key('3')]),
                const SizedBox(height: 8),
                row([key('4'), key('5'), key('6')]),
                const SizedBox(height: 8),
                row([key('7'), key('8'), key('9')]),
                const SizedBox(height: 8),
                row([
                  const Expanded(child: SizedBox()),
                  key('0'),
                  key('back', child: const Icon(FIcons.delete, size: Sizes.icon)),
                ]),
              ],
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            height: Sizes.controlLarge,
            child: FButton(
              onPress: _busy || _pin.length < _minDigits ? null : _signIn,
              child: _busy
                  ? SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: theme.colors.primaryForeground),
                    )
                  : Text(l10n.signIn, style: theme.typography.base.forButton),
            ),
          ),
          const SizedBox(height: 8),
          SizedBox(
            height: Sizes.control,
            child: FButton(
              variant: FButtonVariant.ghost,
              onPress: _busy ? null : () => Navigator.of(context, rootNavigator: true).pop(false),
              child: Text(l10n.cancel, style: theme.typography.base.forButton),
            ),
          ),
        ],
      ),
    );
  }
}

/// Where the signed-in person chooses their PIN: their password, to prove
/// it is them, and the PIN twice. Keycloak sets it (and refuses the easy
/// ones); the till only says how it went.
Future<void> showChoosePin(BuildContext context) => showPosDialog<void>(
      context,
      maxWidth: 400,
      builder: (context) => const _ChoosePin(),
    );

class _ChoosePin extends ConsumerStatefulWidget {
  const _ChoosePin();

  @override
  ConsumerState<_ChoosePin> createState() => _ChoosePinState();
}

class _ChoosePinState extends ConsumerState<_ChoosePin> {
  final _password = TextEditingController();
  final _pin = TextEditingController();
  final _again = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _password.dispose();
    _pin.dispose();
    _again.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final l10n = AppLocalizations.of(context)!;
    final pin = _pin.text.trim();
    final problem = _password.text.isEmpty
        ? l10n.enterPassword
        : !looksLikePin(pin)
            ? l10n.pinFormat
            : pin != _again.text.trim()
                ? l10n.pinMismatch
                : null;
    if (problem != null) {
      setState(() => _error = problem);
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    final result = await ref.read(authServiceProvider.notifier).chooseMyPin(_password.text, pin);
    if (!mounted) return;
    if (result == PinChoice.saved) {
      Navigator.of(context, rootNavigator: true).pop();
      showSuccessToast(context, l10n.pinSaved);
      return;
    }
    setState(() {
      _busy = false;
      _error = switch (result) {
        PinChoice.wrongPassword => l10n.pinWrongPassword,
        PinChoice.format => l10n.pinFormat,
        PinChoice.guessable => l10n.pinGuessable,
        _ => l10n.pinNotSaved,
      };
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final digits = [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(_maxDigits)];

    return DialogScroll(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(l10n.setMyPin, style: theme.typography.xl.copyWith(fontWeight: FontWeight.w700)),
          const SizedBox(height: 4),
          Text(l10n.pinHint, style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground)),
          const SizedBox(height: 16),
          FTextField.password(
            control: FTextFieldControl.managed(controller: _password),
            label: Text(l10n.password),
            textInputAction: TextInputAction.next,
          ),
          const SizedBox(height: 12),
          FTextField(
            control: FTextFieldControl.managed(controller: _pin),
            label: Text(l10n.newPin),
            obscureText: true,
            keyboardType: TextInputType.number,
            inputFormatters: digits,
            textInputAction: TextInputAction.next,
          ),
          const SizedBox(height: 12),
          FTextField(
            control: FTextFieldControl.managed(controller: _again),
            label: Text(l10n.newPinAgain),
            obscureText: true,
            keyboardType: TextInputType.number,
            inputFormatters: digits,
            textInputAction: TextInputAction.done,
            onSubmit: (_) => _save(),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(
              _error!,
              style: theme.typography.sm.copyWith(color: theme.colors.destructive, fontWeight: FontWeight.w500),
            ),
          ],
          const SizedBox(height: 20),
          DialogActions(
            children: [
              FButton(
                variant: FButtonVariant.outline,
                onPress: _busy ? null : () => Navigator.of(context, rootNavigator: true).pop(),
                child: Text(l10n.cancel),
              ),
              FButton(
                onPress: _busy ? null : _save,
                child: Text(l10n.save),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

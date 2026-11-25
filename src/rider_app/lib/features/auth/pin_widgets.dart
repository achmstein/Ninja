import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import 'package:ninja_app_core/theme/text_styles.dart';

import '../../core/auth/auth_service.dart';
import '../../core/auth/remembered_rider.dart';
import '../../core/widgets/rider_toast.dart';
import '../../l10n/app_localizations.dart';

const int pinMaxDigits = 6;
const int pinMinDigits = 4;

/// What has been typed, as dots (never the digits), and the pad to type it
/// on: big keys for a thumb, digits left to right in Arabic too, as on
/// every keypad. The PIN itself lives with whoever shows the pad.
class PinPad extends StatelessWidget {
  final String pin;
  final bool enabled;
  final ValueChanged<String> onDigit;
  final VoidCallback onBack;

  const PinPad({super.key, required this.pin, required this.onDigit, required this.onBack, this.enabled = true});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final keyStyle = theme.typography.xl.forButton.copyWith(
      fontWeight: FontWeight.w600,
      fontFeatures: const [FontFeature.tabularFigures()],
    );

    Widget key(String label, {Widget? child, VoidCallback? onPress}) => Expanded(
          child: SizedBox(
            height: Sizes.controlLarge,
            child: FButton(
              variant: FButtonVariant.outline,
              onPress: enabled ? (onPress ?? () => onDigit(label)) : null,
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

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(
          label: l10n.pinDigitsTyped(pin.length),
          child: SizedBox(
            height: 24,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                for (var i = 0; i < pinMaxDigits; i++)
                  Container(
                    width: 14,
                    height: 14,
                    margin: const EdgeInsets.symmetric(horizontal: 6),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: i < pin.length ? theme.colors.foreground : null,
                      border: Border.all(color: i < pin.length ? theme.colors.foreground : theme.colors.border, width: 1.5),
                    ),
                  ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 20),
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
                key('back', onPress: onBack, child: const Icon(FIcons.delete, size: Sizes.icon)),
              ]),
            ],
          ),
        ),
      ],
    );
  }
}

/// Where the signed-in rider chooses their PIN: the PIN twice, and their
/// password to prove it is them, unless they typed it a moment ago
/// ([password], the offer right after a password sign-in). Keycloak sets it
/// and refuses the easy ones; the phone then knows to ask for the PIN.
Future<void> showChoosePin(BuildContext context, {String? password, RememberedRider? rider}) {
  return showFDialog<void>(
    context: context,
    useRootNavigator: true,
    builder: (context, style, animation) => FDialog.raw(
      style: style,
      animation: animation,
      constraints: const BoxConstraints(maxWidth: 448),
      builder: (context, _) => _ChoosePin(password: password, rider: rider),
    ),
  );
}

class _ChoosePin extends ConsumerStatefulWidget {
  final String? password;
  final RememberedRider? rider;

  const _ChoosePin({this.password, this.rider});

  @override
  ConsumerState<_ChoosePin> createState() => _ChoosePinState();
}

class _ChoosePinState extends ConsumerState<_ChoosePin> {
  final _password = TextEditingController();
  final _pin = TextEditingController();
  final _again = TextEditingController();
  bool _busy = false;
  String? _error;

  bool get _offer => widget.password != null;

  @override
  void dispose() {
    _password.dispose();
    _pin.dispose();
    _again.dispose();
    super.dispose();
  }

  void _close() => Navigator.of(context, rootNavigator: true).pop();

  Future<void> _save() async {
    final l10n = AppLocalizations.of(context)!;
    final password = widget.password ?? _password.text;
    final pin = _pin.text.trim();
    final problem = password.isEmpty
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
    final auth = ref.read(authServiceProvider.notifier);
    final result = await auth.chooseMyPin(password, pin);
    if (!mounted) return;
    if (result == PinChoice.saved) {
      // The phone asks this rider for their PIN from now on
      final state = ref.read(authServiceProvider);
      final rider = widget.rider ?? await RememberedRider.load();
      final username = rider?.username ?? state.email;
      if (username != null) {
        await RememberedRider(username: username, name: state.name ?? rider?.name ?? '', hasPin: true).save();
      }
      if (!mounted) return;
      _close();
      showRiderToast(context, RiderToastType.success, l10n.pinSaved);
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
    final digits = [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(pinMaxDigits)];

    return Padding(
      padding: const EdgeInsets.all(24),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(_offer ? l10n.pinOfferTitle : l10n.setMyPin, style: theme.typography.xl.copyWith(fontWeight: FontWeight.w600)),
            const SizedBox(height: 6),
            Text(l10n.pinOfferHint, style: theme.typography.base.copyWith(color: theme.colors.mutedForeground)),
            const SizedBox(height: 16),
            if (!_offer) ...[
              FTextField.password(
                control: FTextFieldControl.managed(controller: _password),
                label: Text(l10n.password),
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: 12),
            ],
            FTextField(
              control: FTextFieldControl.managed(controller: _pin),
              label: Text(l10n.newPin),
              obscureText: true,
              autofocus: _offer,
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
              Text(_error!, style: theme.typography.sm.copyWith(color: theme.colors.destructive, fontWeight: FontWeight.w500)),
            ],
            const SizedBox(height: 20),
            SizedBox(
              height: Sizes.control,
              child: FButton(
                onPress: _busy ? null : _save,
                child: _busy ? const FCircularProgress() : Text(l10n.savePin, style: theme.typography.base.forButton),
              ),
            ),
            const SizedBox(height: 8),
            SizedBox(
              height: Sizes.control,
              child: FButton(
                variant: FButtonVariant.ghost,
                onPress: _busy ? null : _close,
                child: Text(_offer ? l10n.notNow : l10n.cancel, style: theme.typography.base.forButton),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Shows the one-time PIN offer the sign-in left (a password sign-in on a
/// phone with no PIN for this rider) once the deliveries are on screen.
class PinOfferListener extends ConsumerStatefulWidget {
  final Widget child;

  const PinOfferListener({super.key, required this.child});

  @override
  ConsumerState<PinOfferListener> createState() => _PinOfferListenerState();
}

class _PinOfferListenerState extends ConsumerState<PinOfferListener> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _show());
  }

  void _show() {
    if (!mounted) return;
    final offer = ref.read(pinOfferProvider.notifier).take();
    if (offer == null) return;
    showChoosePin(context, password: offer.password, rider: offer.rider);
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(pinOfferProvider, (_, next) {
      if (next != null) WidgetsBinding.instance.addPostFrameCallback((_) => _show());
    });
    return widget.child;
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import '../../../core/auth/auth_service.dart';
import '../../../core/auth/remembered_rider.dart';
import 'package:ninja_app_core/brand/brand_provider.dart';
import 'package:ninja_staff_ui/brand_mark.dart';
import 'package:ninja_app_core/widgets/app_text.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import 'package:ninja_app_core/theme/text_styles.dart';
import '../../../core/widgets/connection_foot.dart';
import '../../../l10n/app_localizations.dart';
import '../pin_widgets.dart';

/// The rider signs in on the app's own screen, never a browser page. The
/// rider this phone remembers, with a PIN, is greeted by name and types only
/// the PIN; anyone else (or that rider, when they ask) types their username
/// and password. Both go straight to Keycloak's token endpoint
/// (src/keycloak-pin lets the PIN in). After a password sign-in with no PIN
/// on this phone, the deliveries screen offers to set one (PinOffer).
class LoginScreen extends ConsumerStatefulWidget {
  final String? error;

  const LoginScreen({super.key, this.error});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isLoading = false;
  String? _errorMessage;

  /// Null until the phone has been asked
  RememberedRider? _remembered;
  bool _loaded = false;

  /// The password form, though the phone knows this rider's PIN
  bool _usePassword = false;
  String _pin = '';

  bool get _pinMode => _remembered?.hasPin == true && !_usePassword;

  @override
  void initState() {
    super.initState();
    RememberedRider.load().then((rider) {
      if (!mounted) return;
      setState(() {
        _remembered = rider;
        _loaded = true;
        if (rider != null) _usernameController.text = rider.username;
      });
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (widget.error == 'not_authorized' && _errorMessage == null) {
      final l10n = AppLocalizations.of(context);
      if (l10n != null) {
        _errorMessage = l10n.accessDeniedDescription;
      }
    }
  }

  @override
  void dispose() {
    _usernameController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _signInWithPassword() async {
    final l10n = AppLocalizations.of(context)!;
    final username = _usernameController.text.trim();
    final password = _passwordController.text;
    if (username.isEmpty || password.isEmpty) {
      setState(() => _errorMessage = l10n.enterBothFields);
      return;
    }
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final known = _remembered;
    final hasPinHere = known != null && known.hasPin && known.username.toLowerCase() == username.toLowerCase();
    final offers = ref.read(pinOfferProvider.notifier);
    // Left before signing in: the router leaves this screen the moment the session starts
    if (!hasPinHere) offers.offer(PinOffer(password: password, rider: RememberedRider(username: username, name: '', hasPin: false)));

    final result = await ref.read(authServiceProvider.notifier).signIn(username, password);
    if (result != SignInResult.success) offers.take();
    if (result == SignInResult.success) {
      final name = ref.read(authServiceProvider).name ?? '';
      await RememberedRider(username: username, name: name, hasPin: hasPinHere).save();
    }
    if (!mounted) return;
    _finish(result);
  }

  Future<void> _signInWithPin() async {
    final rider = _remembered;
    if (rider == null) return;
    final l10n = AppLocalizations.of(context)!;
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    final result = await ref.read(authServiceProvider.notifier).signInWithPin(rider.username, _pin);
    if (!mounted) return;
    switch (result) {
      case PinSignIn.success:
        context.go('/');
      case PinSignIn.unavailable:
        // No PIN to use: the password, and the phone stops asking for the PIN
        await rider.withPin(false).save();
        if (!mounted) return;
        setState(() {
          _remembered = rider.withPin(false);
          _errorMessage = l10n.pinUnavailable;
        });
      case PinSignIn.wrong:
        setState(() => _errorMessage = l10n.pinWrong);
      case PinSignIn.notAuthorized:
        setState(() => _errorMessage = l10n.accessDeniedDescription);
      case PinSignIn.failed:
        setState(() => _errorMessage = l10n.pinSignInFailed);
    }
    if (mounted) {
      setState(() {
        _isLoading = false;
        _pin = '';
      });
    }
  }

  void _finish(SignInResult result) {
    final l10n = AppLocalizations.of(context)!;
    switch (result) {
      case SignInResult.success:
        context.go('/');
      case SignInResult.notAuthorized:
        setState(() => _errorMessage = l10n.accessDeniedDescription);
      case SignInResult.failed:
        setState(() => _errorMessage = l10n.invalidCredentials);
      case SignInResult.cancelled:
        break;
    }
    setState(() => _isLoading = false);
  }

  void _digit(String digit) {
    if (_isLoading || _pin.length >= pinMaxDigits) return;
    setState(() {
      _errorMessage = null;
      _pin += digit;
    });
  }

  void _back() {
    if (_isLoading || _pin.isEmpty) return;
    setState(() => _pin = _pin.substring(0, _pin.length - 1));
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    // Which business this phone belongs to, under the platform's name
    final business = ref.watch(brandProvider).displayName(Localizations.localeOf(context));
    final rider = _remembered;

    return Scaffold(
      backgroundColor: theme.colors.background,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24.0),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 400),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Brand: the business's mark and name, then what this app is
                  Center(child: BrandMark(size: _pinMode ? 64 : 96)),
                  const SizedBox(height: 16),
                  Center(
                    child: AppText(
                      business.isEmpty ? l10n.appName : business,
                      style: theme.typography.heading.copyWith(
                        fontWeight: FontWeight.w600,
                        letterSpacing: -0.5,
                        color: theme.colors.foreground,
                      ),
                    ),
                  ),
                  if (business.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Center(
                      child: AppText(
                        l10n.appName,
                        style: theme.typography.base.copyWith(color: theme.colors.mutedForeground),
                      ),
                    ),
                  ],
                  const SizedBox(height: 32),

                  if (!_loaded)
                    const SizedBox(height: Sizes.control, child: Center(child: FCircularProgress()))
                  else if (_pinMode) ...[
                    // The rider this phone knows: their name, and the pad
                    Text(
                      rider!.name.isEmpty ? rider.username : rider.name,
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
                    _ErrorLine(message: _errorMessage),
                    PinPad(pin: _pin, enabled: !_isLoading, onDigit: _digit, onBack: _back),
                    const SizedBox(height: 16),
                    SizedBox(
                      height: Sizes.controlLarge,
                      child: FButton(
                        onPress: _isLoading || _pin.length < pinMinDigits ? null : _signInWithPin,
                        child: _isLoading ? const FCircularProgress() : Text(l10n.signIn, style: theme.typography.base.forButton),
                      ),
                    ),
                    const SizedBox(height: 8),
                    SizedBox(
                      height: Sizes.control,
                      child: FButton(
                        variant: FButtonVariant.ghost,
                        onPress: _isLoading
                            ? null
                            : () => setState(() {
                                  _usePassword = true;
                                  _pin = '';
                                  _errorMessage = null;
                                }),
                        child: Text(l10n.usePassword, style: theme.typography.base.forButton),
                      ),
                    ),
                  ] else ...[
                    if (_errorMessage != null)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 16),
                        child: FAlert(
                          variant: FAlertVariant.destructive,
                          icon: const Icon(Icons.error_outline),
                          title: AppText(l10n.error),
                          subtitle: AppText(_errorMessage!),
                        ),
                      ),
                    FTextField.email(
                      control: FTextFieldControl.managed(controller: _usernameController),
                      label: AppText(l10n.email),
                      hint: l10n.enterEmail,
                      textInputAction: TextInputAction.next,
                    ),
                    const SizedBox(height: 16),
                    FTextField.password(
                      control: FTextFieldControl.managed(controller: _passwordController),
                      label: AppText(l10n.password),
                      hint: l10n.enterPassword,
                      autofocus: rider != null,
                      textInputAction: TextInputAction.done,
                      onSubmit: (_) => _signInWithPassword(),
                    ),
                    const SizedBox(height: 24),
                    SizedBox(
                      height: Sizes.control,
                      child: FButton(
                        onPress: _isLoading ? null : _signInWithPassword,
                        child: _isLoading ? const FCircularProgress() : AppText(l10n.signIn),
                      ),
                    ),
                  ],
                  const SizedBox(height: 32),
                  const PoweredBy(),
                  const ConnectionFoot(),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The pad's one line of trouble, in a fixed height so the keys never jump
class _ErrorLine extends StatelessWidget {
  final String? message;

  const _ErrorLine({this.message});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    return SizedBox(
      height: 36,
      child: Center(
        child: message == null
            ? null
            : Text(
                message!,
                style: theme.typography.sm.copyWith(color: theme.colors.destructive, fontWeight: FontWeight.w500),
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
      ),
    );
  }
}

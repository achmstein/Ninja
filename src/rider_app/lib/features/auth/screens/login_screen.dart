import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import '../../../core/auth/auth_service.dart';
import 'package:ninja_app_core/brand/brand_provider.dart';
import '../../../core/brand/brand_mark.dart';
import '../../../core/config/app_config.dart';
import 'package:ninja_app_core/widgets/app_text.dart';
import '../../../core/widgets/connection_foot.dart';
import '../../../l10n/app_localizations.dart';

/// Keycloak is the only identity provider: the rider signs in once, on
/// Keycloak's own page in the browser (the app never sees the password).
/// A debug build may ask for the password form instead (AppConfig.passwordSignIn).
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

  Future<void> _signIn() async {
    final l10n = AppLocalizations.of(context)!;
    final auth = ref.read(authServiceProvider.notifier);
    final Future<SignInResult> attempt;
    if (AppConfig.passwordSignIn) {
      final username = _usernameController.text.trim();
      final password = _passwordController.text;
      if (username.isEmpty || password.isEmpty) {
        setState(() => _errorMessage = l10n.enterBothFields);
        return;
      }
      attempt = auth.signIn(username, password);
    } else {
      // Keycloak's own page in the browser, then back here
      attempt = auth.signInWithBrowser();
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final result = await attempt;
      if (!mounted) return;

      switch (result) {
        case SignInResult.success:
          context.go('/');
        case SignInResult.notAuthorized:
          setState(() => _errorMessage = l10n.accessDeniedDescription);
        case SignInResult.failed:
          setState(() => _errorMessage = AppConfig.passwordSignIn ? l10n.invalidCredentials : l10n.signInFailed);
        case SignInResult.cancelled:
          // Closed the browser: nothing to say, the button is still there
          break;
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    // Which business this till belongs to, under the platform's name
    final business = ref.watch(brandProvider).displayName(Localizations.localeOf(context));

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
                  const Center(child: BrandMark(size: 96)),
                  const SizedBox(height: 16),
                  Center(
                    child: AppText(
                      business.isEmpty ? l10n.appName : business,
                      style: theme.typography.xl2.copyWith(
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

                  // Error message
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

                  // The password form only in a debug build asked for it; otherwise Keycloak's page in the browser
                  if (AppConfig.passwordSignIn) ...[
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
                      textInputAction: TextInputAction.done,
                      onSubmit: (_) => _signIn(),
                    ),
                    const SizedBox(height: 24),
                  ] else ...[
                    AppText(
                      l10n.signInInBrowser,
                      textAlign: TextAlign.center,
                      style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground),
                    ),
                    const SizedBox(height: 16),
                  ],

                  // Sign in button
                  SizedBox(
                    height: 48,
                    child: FButton(
                      onPress: _isLoading ? null : _signIn,
                      child: _isLoading ? const FCircularProgress() : AppText(l10n.signIn),
                    ),
                  ),
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

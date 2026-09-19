import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import '../../../core/auth/auth_service.dart';
import '../../../core/brand/ninja_mark.dart';
import '../../../core/widgets/app_text.dart';
import '../../../l10n/app_localizations.dart';

/// Keycloak is the only identity provider and the kitchen display signs in with a
/// staff username and password, once. Same form as admin_app.
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
    final username = _usernameController.text.trim();
    final password = _passwordController.text;

    if (username.isEmpty || password.isEmpty) {
      setState(() {
        _errorMessage = l10n.enterBothFields;
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final result = await ref.read(authServiceProvider.notifier).signIn(
        username,
        password,
      );

      if (!mounted) return;

      switch (result) {
        case SignInResult.success:
          context.go('/');
          break;
        case SignInResult.notAuthorized:
          setState(() {
            _errorMessage = l10n.accessDeniedDescription;
          });
          break;
        case SignInResult.failed:
          setState(() {
            _errorMessage = l10n.invalidCredentials;
          });
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
                  // Brand: the mark, then "Ninja Kitchen"
                  const Center(child: NinjaMark(size: 96)),
                  const SizedBox(height: 16),
                  Center(
                    child: AppText(
                      '$ninjaName ${l10n.appName}',
                      style: theme.typography.xl2.copyWith(
                        fontWeight: FontWeight.w600,
                        letterSpacing: -0.5,
                        color: theme.colors.foreground,
                      ),
                    ),
                  ),
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

                  // Username field
                  FTextField.email(
                    control: FTextFieldControl.managed(controller: _usernameController),
                    label: AppText(l10n.email),
                    hint: l10n.enterEmail,
                    textInputAction: TextInputAction.next,
                  ),
                  const SizedBox(height: 16),

                  // Password field
                  FTextField.password(
                    control: FTextFieldControl.managed(controller: _passwordController),
                    label: AppText(l10n.password),
                    hint: l10n.enterPassword,
                    textInputAction: TextInputAction.done,
                    onSubmit: (_) => _signIn(),
                  ),
                  const SizedBox(height: 24),

                  // Sign in button
                  SizedBox(
                    height: 48,
                    child: FButton(
                      onPress: _isLoading ? null : _signIn,
                      child: _isLoading
                          ? SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: theme.colors.primaryForeground,
                              ),
                            )
                          : AppText(l10n.signIn),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

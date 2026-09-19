import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import '../../../core/auth/auth_service.dart';
import '../../../core/brand/brand_mark.dart';
import '../../../core/widgets/app_text.dart';
import '../../../l10n/app_localizations.dart';

/// Login screen with native email/password authentication
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isLoading = false;
  SocialProvider? _loadingProvider;
  String? _error;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleSignIn() async {
    final l10n = AppLocalizations.of(context)!;
    final email = _emailController.text.trim();
    final password = _passwordController.text;

    if (email.isEmpty || password.isEmpty) {
      setState(() {
        _error = l10n.enterBothEmailAndPassword;
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final authService = ref.read(authServiceProvider.notifier);
      final success = await authService.signIn(email, password);

      if (!success && mounted) {
        setState(() {
          _error = l10n.invalidCredentials;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = l10n.anErrorOccurred(e.toString());
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _handleSocialSignIn(SocialProvider provider) async {
    final l10n = AppLocalizations.of(context)!;
    setState(() {
      _loadingProvider = provider;
      _error = null;
    });

    try {
      final authService = ref.read(authServiceProvider.notifier);
      final success = await authService.signInWithProvider(provider);

      if (!success && mounted) {
        setState(() {
          _error = l10n.socialSignInFailed;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = l10n.anErrorOccurred(e.toString());
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _loadingProvider = null;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final colors = theme.colors;
    final l10n = AppLocalizations.of(context)!;

    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Brand: the wordmark, or the mark then the name
                Center(
                  child: BrandWordmark(
                    height: 120,
                    nameStyle: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w600,
                      color: colors.foreground,
                    ),
                  ),
                ),
                const SizedBox(height: 32),

                // Error message
                if (_error != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: FAlert(
                      variant: FAlertVariant.destructive,
                      icon: Icon(FIcons.circleAlert),
                      title: AppText(l10n.error),
                      subtitle: AppText(_error!),
                    ),
                  ),

                // Email field
                FTextField.email(
                  control: FTextFieldControl.managed(controller: _emailController),
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
                  onSubmit: (_) => _handleSignIn(),
                ),
                const SizedBox(height: 24),

                // Sign in button
                FButton(
                  onPress: _isLoading || _loadingProvider != null ? null : _handleSignIn,
                  child: _isLoading
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : AppText(l10n.signIn),
                ),
                const SizedBox(height: 24),

                // Divider with "or"
                Row(
                  children: [
                    Expanded(
                      child: Divider(
                        color: colors.border,
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: AppText(
                        l10n.orContinueWith,
                        style: TextStyle(
                          color: colors.mutedForeground,
                          fontSize: 14,
                        ),
                      ),
                    ),
                    Expanded(
                      child: Divider(
                        color: colors.border,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),

                // Social login buttons
                Row(
                  children: [
                    // Google button
                    Expanded(
                      child: FButton(
                        variant: FButtonVariant.outline,
                        onPress: _isLoading || _loadingProvider != null
                            ? null
                            : () => _handleSocialSignIn(SocialProvider.google),
                        child: _loadingProvider == SocialProvider.google
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Image.network(
                                    'https://www.google.com/favicon.ico',
                                    width: 20,
                                    height: 20,
                                    errorBuilder: (context, error, stackTrace) =>
                                        Icon(Icons.g_mobiledata, size: 20,
                                          color: _loadingProvider != null ? colors.mutedForeground : null),
                                  ),
                                  const SizedBox(width: 8),
                                  AppText(
                                    l10n.google,
                                    style: _loadingProvider != null
                                        ? TextStyle(color: colors.mutedForeground)
                                        : null,
                                  ),
                                ],
                              ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    // Apple button
                    Expanded(
                      child: FButton(
                        variant: FButtonVariant.outline,
                        onPress: _isLoading || _loadingProvider != null
                            ? null
                            : () => _handleSocialSignIn(SocialProvider.apple),
                        child: _loadingProvider == SocialProvider.apple
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(Icons.apple, size: 20,
                                    color: _loadingProvider != null ? colors.mutedForeground : colors.foreground),
                                  const SizedBox(width: 8),
                                  AppText(
                                    l10n.apple,
                                    style: _loadingProvider != null
                                        ? TextStyle(color: colors.mutedForeground)
                                        : null,
                                  ),
                                ],
                              ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),

                // Register link
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    AppText(
                      l10n.dontHaveAccount,
                      style: TextStyle(
                        color: colors.mutedForeground,
                        fontSize: 14,
                      ),
                    ),
                    GestureDetector(
                      onTap: () => context.push('/register'),
                      child: AppText(
                        l10n.register,
                        style: TextStyle(
                          color: colors.primary,
                          fontWeight: FontWeight.w600,
                          fontSize: 14,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import '../../../core/auth/auth_service.dart';
import '../../../core/auth/cashier_sign_in.dart';
import '../cashier_roster.dart';
import '../../../core/brand/brand_provider.dart';
import '../../../core/brand/brand_mark.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import 'package:ninja_app_core/widgets/app_text.dart';
import '../../../core/widgets/connection_foot.dart';
import '../../../l10n/app_localizations.dart';

/// Keycloak is the only identity provider and the till signs in with a
/// staff username and password, once. Same form as admin_app.
///
/// A till that has been signed in to before also shows the branch's till
/// staff by name, above the form: a tap hands the sign-in to Keycloak's own
/// page, which asks that person for their PIN (core/auth/cashier_sign_in.dart).
/// That is how one cashier takes over from the next.
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

  /// The name being signed in by PIN, so its tile shows the wait
  String? _signingInAs;

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
        case SignInResult.cancelled:
          // Only a browser sign-in is cancelled; the till signs in with a password
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

  Future<void> _signInAs(Cashier cashier) async {
    final l10n = AppLocalizations.of(context)!;
    setState(() {
      _signingInAs = cashier.username;
      _errorMessage = null;
    });
    try {
      final result = await ref.read(authServiceProvider.notifier).signInAs(cashier.username);
      if (!mounted) return;
      switch (result) {
        case SignInResult.success:
          context.go('/');
        case SignInResult.notAuthorized:
          setState(() => _errorMessage = l10n.accessDeniedDescription);
        case SignInResult.failed:
          setState(() => _errorMessage = l10n.pinSignInFailed);
        case SignInResult.cancelled:
          // They closed Keycloak's page: nothing to say
          break;
      }
    } finally {
      if (mounted) setState(() => _signingInAs = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final roster = ref.watch(cashierRosterProvider).value ?? const <Cashier>[];
    final busy = _isLoading || _signingInAs != null;
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
                      business.isEmpty ? l10n.posName : business,
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
                        l10n.posName,
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

                  // Who is selling: the till staff by name, each a tap and a PIN away
                  if (roster.isNotEmpty) ...[
                    Center(
                      child: AppText(
                        l10n.whoIsSelling,
                        style: theme.typography.lg.copyWith(fontWeight: FontWeight.w600, color: theme.colors.foreground),
                      ),
                    ),
                    const SizedBox(height: 12),
                    LayoutBuilder(
                      builder: (context, constraints) {
                        const gap = 8.0;
                        final width = (constraints.maxWidth - gap) / 2;
                        return Wrap(
                          spacing: gap,
                          runSpacing: gap,
                          children: [
                            for (final cashier in roster)
                              SizedBox(
                                width: width,
                                child: ConstrainedBox(
                                  constraints: const BoxConstraints(minHeight: Sizes.controlLarge),
                                  child: FButton(
                                    variant: FButtonVariant.outline,
                                    onPress: busy ? null : () => _signInAs(cashier),
                                    child: _signingInAs == cashier.username
                                        ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                                        : Text(cashier.name, maxLines: 2, overflow: TextOverflow.ellipsis, textAlign: TextAlign.center),
                                  ),
                                ),
                              ),
                          ],
                        );
                      },
                    ),
                    const SizedBox(height: 24),
                    Center(
                      child: AppText(
                        l10n.orSignInWithPassword,
                        style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground),
                      ),
                    ),
                    const SizedBox(height: 12),
                  ],

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
                    height: Sizes.control,
                    child: FButton(
                      onPress: busy ? null : _signIn,
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

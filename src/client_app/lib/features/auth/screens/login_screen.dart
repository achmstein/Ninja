import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../../../core/theme/theme_provider.dart';
import '../../../core/ui/ui.dart';
import 'package:go_router/go_router.dart';
import '../../../core/auth/auth_service.dart';
import '../../../core/brand/brand_mark.dart';
import '../../../core/brand/brand_provider.dart';
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
        final why = authService.lastSocialError;
        setState(() {
          _error = why == null ? l10n.socialSignInFailed : '${l10n.socialSignInFailed} ($why)';
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
    // Only the providers the business has on; a brand that does not say keeps both
    final social = ref.watch(brandProvider).socialProviders;
    final businessName = ref.watch(brandProvider).displayName(Localizations.localeOf(context));
    final google = social == null || social.contains('google');
    final apple = social == null || social.contains('apple');
    final busy = _isLoading || _loadingProvider != null;
    final note = context.localeText(theme.typography.note.copyWith(color: colors.mutedForeground));
    final link = context.localeText(theme.typography.note.copyWith(color: colors.foreground, fontWeight: FontWeight.w700));

    // The way every sign-in page reads: the business's mark in the middle, the email form and
    // its button, then the other ways in (Google, Apple) side by side, and the links at the foot
    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: Ninja.pagePadding, vertical: 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: BrandWordmark(
                    height: 64,
                    maxWidth: 240,
                    nameStyle: context.localeText(theme.typography.title.copyWith(color: colors.foreground)),
                  ),
                ),
                const SizedBox(height: 40),
                if (_error != null) ...[
                  NinjaAlert(
                    variant: NinjaAlertVariant.destructive,
                    icon: const Icon(LucideIcons.circleAlert),
                    title: AppText(l10n.error),
                    subtitle: AppText(_error!),
                  ),
                  const SizedBox(height: 16),
                ],
                NinjaField.email(
                  controller: _emailController,
                  label: AppText(l10n.email),
                  hint: l10n.enterEmail,
                  textInputAction: TextInputAction.next,
                ),
                const SizedBox(height: 16),
                NinjaField.password(
                  controller: _passwordController,
                  label: AppText(l10n.password),
                  hint: l10n.enterPassword,
                  textInputAction: TextInputAction.done,
                  onSubmit: (_) => _handleSignIn(),
                ),
                const SizedBox(height: 24),
                NinjaButton(lifted: true, busy: _isLoading, onPress: busy ? null : _handleSignIn, child: AppText(l10n.signIn)),
                if (google || apple) ...[
                  const SizedBox(height: 28),
                  Row(
                    children: [
                      Expanded(child: Divider(color: colors.border, height: 1)),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        child: Text(l10n.orContinueWith, style: note),
                      ),
                      Expanded(child: Divider(color: colors.border, height: 1)),
                    ],
                  ),
                  const SizedBox(height: 20),
                  // The provider's name alone: the line above already says what they are for
                  Row(
                    children: [
                      if (google)
                        Expanded(
                          child: NinjaButton(
                            variant: NinjaButtonVariant.outline,
                            busy: _loadingProvider == SocialProvider.google,
                            onPress: busy ? null : () => _handleSocialSignIn(SocialProvider.google),
                            prefix: SvgPicture.asset('assets/images/google_g.svg', width: 18, height: 18),
                            child: AppText(l10n.google),
                          ),
                        ),
                      if (google && apple) const SizedBox(width: 12),
                      if (apple)
                        Expanded(
                          child: NinjaButton(
                            variant: NinjaButtonVariant.inverse,
                            busy: _loadingProvider == SocialProvider.apple,
                            onPress: busy ? null : () => _handleSocialSignIn(SocialProvider.apple),
                            prefix: const Icon(Icons.apple, size: 20),
                            child: AppText(l10n.apple),
                          ),
                        ),
                    ],
                  ),
                ],
                const SizedBox(height: 32),
                // The other ways to an account: a new one, or the one the counter made for them
                Wrap(
                  alignment: WrapAlignment.center,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Text(l10n.dontHaveAccount, style: note),
                    GestureDetector(
                      onTap: () => context.push('/register'),
                      child: Text(l10n.register, style: link),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                // Added at the counter by name and phone: the till's QR or
                // link turns that into an account they can sign in to
                Center(
                  child: GestureDetector(
                    onTap: () => context.push('/claim'),
                    child: Text(l10n.haveBusinessCode(businessName), textAlign: TextAlign.center, style: link),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

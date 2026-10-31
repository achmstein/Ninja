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
    // Only the providers the business has on; a brand that does not say keeps both
    final social = ref.watch(brandProvider).socialProviders;
    final businessName = ref.watch(brandProvider).displayName(Localizations.localeOf(context));
    final google = social == null || social.contains('google');
    final apple = social == null || social.contains('apple');
    final busy = _isLoading || _loadingProvider != null;
    final note = context.localeText(theme.typography.note.copyWith(color: colors.mutedForeground));
    final link = context.localeText(theme.typography.note.copyWith(color: colors.foreground, fontWeight: FontWeight.w700));

    // A page like every other: the large title, the business under it, then the blocks rising
    // in. Google and Apple first, as on the web, each a full-width pill; then the email form
    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        bottom: false,
        child: NinjaPage(
          title: l10n.signIn,
          subtitle: Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Align(
              alignment: AlignmentDirectional.centerStart,
              child: BrandWordmark(
                height: 36,
                maxWidth: 200,
                nameStyle: context.localeText(theme.typography.title.copyWith(color: colors.mutedForeground)),
              ),
            ),
          ),
          gap: 16,
          children: [
            if (_error != null)
              NinjaAlert(
                variant: NinjaAlertVariant.destructive,
                icon: const Icon(LucideIcons.circleAlert),
                title: AppText(l10n.error),
                subtitle: AppText(_error!),
              ),
            if (google || apple)
              Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (google)
                    NinjaButton(
                      variant: NinjaButtonVariant.outline,
                      busy: _loadingProvider == SocialProvider.google,
                      onPress: busy ? null : () => _handleSocialSignIn(SocialProvider.google),
                      prefix: SvgPicture.asset('assets/images/google_g.svg', width: 18, height: 18),
                      child: AppText(l10n.continueWithGoogle),
                    ),
                  if (google && apple) const SizedBox(height: 10),
                  if (apple)
                    NinjaButton(
                      variant: NinjaButtonVariant.inverse,
                      busy: _loadingProvider == SocialProvider.apple,
                      onPress: busy ? null : () => _handleSocialSignIn(SocialProvider.apple),
                      prefix: const Icon(Icons.apple, size: 20),
                      child: AppText(l10n.continueWithApple),
                    ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(child: Divider(color: colors.border, height: 1)),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        child: Text(l10n.orWithEmail, style: note),
                      ),
                      Expanded(child: Divider(color: colors.border, height: 1)),
                    ],
                  ),
                ],
              ),
            NinjaField.email(
              controller: _emailController,
              label: AppText(l10n.email),
              hint: l10n.enterEmail,
              textInputAction: TextInputAction.next,
            ),
            NinjaField.password(
              controller: _passwordController,
              label: AppText(l10n.password),
              hint: l10n.enterPassword,
              textInputAction: TextInputAction.done,
              onSubmit: (_) => _handleSignIn(),
            ),
            NinjaButton(lifted: true, busy: _isLoading, onPress: busy ? null : _handleSignIn, child: AppText(l10n.signIn)),
            // The other ways in: a new account, or the one the counter made for them
            Column(
              children: [
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
                GestureDetector(
                  onTap: () => context.push('/claim'),
                  child: Text(l10n.haveBusinessCode(businessName), textAlign: TextAlign.center, style: link),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

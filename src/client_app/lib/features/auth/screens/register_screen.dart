import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/ui/ui.dart';
import '../../../core/theme/theme_provider.dart';
import 'package:go_router/go_router.dart';
import '../../../core/auth/auth_service.dart';
import '../../../core/widgets/app_text.dart';
import '../../../l10n/app_localizations.dart';
import '../../../core/brand/brand_provider.dart';

/// Registration screen
class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  bool _isLoading = false;
  String? _error;
  String? _success;

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _handleRegister() async {
    final l10n = AppLocalizations.of(context)!;
    final firstName = _firstNameController.text.trim();
    final lastName = _lastNameController.text.trim();
    final email = _emailController.text.trim();
    final phone = _phoneController.text.trim();
    final password = _passwordController.text;
    final confirmPassword = _confirmPasswordController.text;

    // Validation
    if (firstName.isEmpty || lastName.isEmpty || email.isEmpty || phone.isEmpty || password.isEmpty) {
      setState(() {
        _error = l10n.fillAllFields;
      });
      return;
    }

    if (!ref.read(brandProvider).locale.isValidPhone(phone)) {
      setState(() {
        _error = l10n.invalidPhone;
      });
      return;
    }

    if (password != confirmPassword) {
      setState(() {
        _error = l10n.passwordsDontMatch;
      });
      return;
    }

    if (password.length < 6) {
      setState(() {
        _error = l10n.passwordTooShort;
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _error = null;
      _success = null;
    });

    try {
      final authService = ref.read(authServiceProvider.notifier);
      final success = await authService.register(firstName, lastName, email, phone, password);

      if (mounted) {
        if (success) {
          // Auto-login after successful registration
          final loginSuccess = await authService.signIn(email, password);
          if (mounted) {
            if (!loginSuccess) {
              // If auto-login fails, show message and redirect to login
              setState(() {
                _success = l10n.registrationSuccessful;
              });
              await Future.delayed(const Duration(seconds: 1));
              if (mounted) {
                context.go('/login');
              }
            }
            // If login succeeds, router will automatically redirect to home
          }
        } else {
          setState(() {
            _error = l10n.registrationFailed;
          });
        }
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

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final colors = theme.colors;
    final l10n = AppLocalizations.of(context)!;

    return NinjaPage(
      title: l10n.createAccount,
      back: true,
      backTo: '/login',
      gap: 16,
      children: [
        if (_success != null) NinjaAlert(icon: const Icon(LucideIcons.check), title: AppText(l10n.success), subtitle: AppText(_success!)),
        if (_error != null)
          NinjaAlert(variant: NinjaAlertVariant.destructive, icon: const Icon(LucideIcons.circleAlert), title: AppText(l10n.error), subtitle: AppText(_error!)),
        Panel(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // First and last name, side by side
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: NinjaField(
                      controller: _firstNameController,
                      label: AppText(l10n.firstName),
                      textInputAction: TextInputAction.next,
                      textCapitalization: TextCapitalization.words,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: NinjaField(
                      controller: _lastNameController,
                      label: AppText(l10n.lastName),
                      textInputAction: TextInputAction.next,
                      textCapitalization: TextCapitalization.words,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Email field
              NinjaField.email(controller: _emailController, label: AppText(l10n.email), hint: l10n.enterEmail, textInputAction: TextInputAction.next),
              const SizedBox(height: 16),

              // Phone field
              NinjaField(
                controller: _phoneController,
                label: AppText(l10n.phoneNumber),
                hint: l10n.enterPhoneNumber,
                textInputAction: TextInputAction.next,
                keyboardType: TextInputType.phone,
              ),
              const SizedBox(height: 16),

              // Password field
              NinjaField.password(
                controller: _passwordController,
                label: AppText(l10n.password),
                hint: l10n.createPassword,
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: 16),

              // Confirm password field
              NinjaField.password(
                controller: _confirmPasswordController,
                label: AppText(l10n.confirmPassword),
                hint: l10n.confirmYourPassword,
                textInputAction: TextInputAction.done,
                onSubmit: (_) => _handleRegister(),
              ),
              const SizedBox(height: 24),

              // Register button
              NinjaButton(
                lifted: true,
                onPress: _isLoading ? null : _handleRegister,
                child: _isLoading
                    ? SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: colors.primaryForeground))
                    : AppText(l10n.register),
              ),
            ],
          ),
        ),
        Wrap(
          alignment: WrapAlignment.center,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            Text(l10n.alreadyHaveAccount, style: context.localeText(theme.typography.note.copyWith(color: colors.mutedForeground))),
            const SizedBox(width: 4),
            GestureDetector(
              onTap: () => context.go('/login'),
              child: Text(
                l10n.signIn,
                style: context.localeText(theme.typography.note.copyWith(color: colors.foreground, fontWeight: FontWeight.w700)),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

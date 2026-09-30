import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/ui/ui.dart';
import 'package:go_router/go_router.dart';
import '../../../core/auth/auth_service.dart';
import '../../../core/brand/brand_mark.dart';
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
                // Brand
                const Center(child: BrandWordmark(height: 96)),
                const SizedBox(height: 24),

                // Title
                AppText(
                  l10n.createAccount,
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    color: colors.foreground,
                    fontSize: 24,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 24),

                // Success message
                if (_success != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: NinjaAlert(
                      icon: Icon(LucideIcons.check),
                      title: AppText(l10n.success),
                      subtitle: AppText(_success!),
                    ),
                  ),

                // Error message
                if (_error != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: NinjaAlert(
                      variant: NinjaAlertVariant.destructive,
                      icon: Icon(LucideIcons.circleAlert),
                      title: AppText(l10n.error),
                      subtitle: AppText(_error!),
                    ),
                  ),

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
                NinjaField.email(
                  controller: _emailController,
                  label: AppText(l10n.email),
                  hint: l10n.enterEmail,
                  textInputAction: TextInputAction.next,
                ),
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
                  onPress: _isLoading ? null : _handleRegister,
                  child: _isLoading
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : AppText(l10n.register),
                ),
                const SizedBox(height: 16),

                // Login link
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    AppText(
                      l10n.alreadyHaveAccount,
                      style: TextStyle(
                        color: colors.mutedForeground,
                        fontSize: 14,
                      ),
                    ),
                    GestureDetector(
                      onTap: () => context.go('/login'),
                      child: AppText(
                        l10n.signIn,
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

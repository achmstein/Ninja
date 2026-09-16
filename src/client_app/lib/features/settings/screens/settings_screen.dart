import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../l10n/app_localizations.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import '../../../core/auth/auth_service.dart';
import '../../../core/providers/locale_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/theme_provider.dart';
import '../../../core/widgets/app_text.dart';
import '../providers/settings_provider.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  @override
  Widget build(BuildContext context) {
    final settingsState = ref.watch(settingsProvider);
    final themeState = ref.watch(themeProvider);
    final authState = ref.watch(authServiceProvider);
    final locale = ref.watch(localeProvider);
    final l10n = AppLocalizations.of(context)!;

    return FScaffold(
      child: SafeArea(
        child: Column(
          children: [
            // Custom header with back button
            Container(
              padding: const EdgeInsetsDirectional.only(start: 8, end: 16, top: 8, bottom: 8),
              child: Row(
                children: [
                  GestureDetector(
                    onTap: () => context.pop(),
                    child: const Icon(FIcons.arrowLeft, size: 22),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: AppText(
                      l10n.settings,
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Notifications Section
                    _buildSectionHeader(l10n.notifications),
                    const SizedBox(height: 8),
                    FTileGroup(
                      children: [
                        FTile(
                          title: AppText(l10n.orderStatusUpdates),
                          suffix: FSwitch(
                            value: settingsState.preferences.orderStatusUpdates,
                            onChange: (value) {
                              ref.read(settingsProvider.notifier).updateNotificationPreference(
                                orderStatusUpdates: value,
                              );
                            },
                          ),
                        ),
                        FTile(
                          title: AppText(l10n.promotionsAndOffers),
                          suffix: FSwitch(
                            value: settingsState.preferences.promotionsAndOffers,
                            onChange: (value) {
                              ref.read(settingsProvider.notifier).updateNotificationPreference(
                                promotionsAndOffers: value,
                              );
                            },
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 24),

                    // Appearance Section
                    _buildSectionHeader(l10n.appearance),
                    const SizedBox(height: 8),
                    FTileGroup(
                      children: [
                        FTile(
                          prefix: const Icon(FIcons.palette),
                          title: AppText(l10n.theme),
                          subtitle: AppText(_getLocalizedThemeName(themeState.themeMode, l10n)),
                          suffix: const Icon(FIcons.chevronRight),
                          onPress: () => _showThemeSelector(context, ref),
                        ),
                        FTile(
                          prefix: const Icon(FIcons.globe),
                          title: AppText(l10n.language),
                          subtitle: AppText(locale.languageCode == 'ar' ? l10n.arabic : l10n.english),
                          suffix: const Icon(FIcons.chevronRight),
                          onPress: () => _showLanguageSelector(context, ref),
                        ),
                      ],
                    ),

                    if (authState.isAuthenticated) ...[
                      const SizedBox(height: 24),

                      // Account Section
                      _buildSectionHeader(l10n.account),
                      const SizedBox(height: 8),
                      FTileGroup(
                        children: [
                          FTile(
                            prefix: const Icon(FIcons.user),
                            title: AppText(l10n.updateProfile),
                            suffix: const Icon(FIcons.chevronRight),
                            onPress: () => _showUpdateProfileSheet(context, ref),
                          ),
                          if (!authState.isSocialLogin)
                            FTile(
                              prefix: const Icon(FIcons.lock),
                              title: AppText(l10n.changePassword),
                              suffix: const Icon(FIcons.chevronRight),
                              onPress: () => _showChangePasswordSheet(context, ref),
                            ),
                          FTile(
                            prefix: Icon(FIcons.trash2, color: context.theme.colors.destructive),
                            title: AppText(l10n.deleteAccount, style: TextStyle(color: context.theme.colors.destructive)),
                            suffix: Icon(FIcons.chevronRight, color: context.theme.colors.destructive),
                            onPress: () => _showDeleteAccountDialog(context, ref),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _getLocalizedThemeName(AppThemeMode mode, AppLocalizations l10n) {
    switch (mode) {
      case AppThemeMode.light:
        return l10n.light;
      case AppThemeMode.dark:
        return l10n.dark;
      case AppThemeMode.system:
        return l10n.systemDefault;
    }
  }

  Widget _buildSectionHeader(String title) {
    return AppText(
      title,
      style: TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.w600,
        color: context.theme.colors.mutedForeground,
      ),
    );
  }

  void _showThemeSelector(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useRootNavigator: true,
      backgroundColor: Colors.transparent,
      barrierColor: Colors.black.withValues(alpha: 0.5),
      builder: (sheetContext) => _ThemeSelectorSheet(
        onThemeSelected: (mode) {
          ref.read(themeProvider.notifier).setThemeMode(mode);
          Navigator.pop(sheetContext);
        },
        currentMode: ref.read(themeProvider).themeMode,
        l10n: l10n,
      ),
    );
  }

  void _showLanguageSelector(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final currentLocale = ref.read(localeProvider);

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useRootNavigator: true,
      backgroundColor: Colors.transparent,
      barrierColor: Colors.black.withValues(alpha: 0.5),
      builder: (sheetContext) => _LanguageSelectorSheet(
        onLanguageSelected: (locale) {
          ref.read(localeProvider.notifier).setLocale(locale);
          Navigator.pop(sheetContext);
        },
        currentLocale: currentLocale,
        l10n: l10n,
      ),
    );
  }

  void _showUpdateProfileSheet(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final authState = ref.read(authServiceProvider);

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useRootNavigator: true,
      backgroundColor: Colors.transparent,
      barrierColor: Colors.black.withValues(alpha: 0.5),
      builder: (sheetContext) => _UpdateProfileSheet(
        ref: ref,
        l10n: l10n,
        currentName: authState.name,
        onSuccess: () {
          Navigator.pop(sheetContext);
          showFToast(
            context: context,
            title: AppText(l10n.profileUpdatedSuccessfully),
            icon: Icon(FIcons.circleCheck, color: Colors.green.shade600),
          );
        },
      ),
    );
  }

  void _showChangePasswordSheet(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useRootNavigator: true,
      backgroundColor: Colors.transparent,
      barrierColor: Colors.black.withValues(alpha: 0.5),
      builder: (sheetContext) => _ChangePasswordSheet(
        ref: ref,
        l10n: l10n,
        onSuccess: () {
          Navigator.pop(sheetContext);
          showFToast(
            context: context,
            title: AppText(l10n.passwordChangedSuccessfully),
            icon: Icon(FIcons.circleCheck, color: Colors.green.shade600),
          );
        },
      ),
    );
  }

  void _showDeleteAccountDialog(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    showFDialog(
      context: context,
      builder: (dialogContext, style, animation) => FDialog(
        style: style,
        animation: animation,
        title: AppText(l10n.deleteAccountQuestion, style: TextStyle(fontWeight: FontWeight.bold)),
        body: AppText(l10n.cannotBeUndone),
        actions: [
          FButton(
            variant: FButtonVariant.outline,
            onPress: () => Navigator.pop(dialogContext),
            child: AppText(l10n.cancel),
          ),
          FButton(
            variant: FButtonVariant.destructive,
            onPress: () async {
              Navigator.pop(dialogContext);

              final success = await ref.read(settingsProvider.notifier).deleteAccount();

              if (success && context.mounted) {
                // Sign out after account deletion
                await ref.read(authServiceProvider.notifier).signOut();
                if (context.mounted) {
                  showFToast(
                    context: context,
                    title: AppText(l10n.accountDeletedSuccessfully),
                    icon: Icon(FIcons.check, color: AppTheme.successColor),
                  );
                }
              } else if (context.mounted) {
                showFToast(
                  context: context,
                  title: AppText(l10n.failedToDeleteAccount),
                  icon: Icon(FIcons.circleX, color: context.theme.colors.destructive),
                );
              }
            },
            child: AppText(l10n.delete),
          ),
        ],
      ),
    );
  }
}

/// Bottom sheet for selecting theme
class _ThemeSelectorSheet extends StatelessWidget {
  final Function(AppThemeMode) onThemeSelected;
  final AppThemeMode currentMode;
  final AppLocalizations l10n;

  const _ThemeSelectorSheet({
    required this.onThemeSelected,
    required this.currentMode,
    required this.l10n,
  });

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final colors = theme.colors;

    return Container(
      decoration: BoxDecoration(
        color: colors.background,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Handle
            Container(
              margin: const EdgeInsets.only(top: 12, bottom: 8),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: colors.mutedForeground,
                borderRadius: BorderRadius.circular(2),
              ),
            ),

            // Header
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children: [
                  Expanded(
                    child: AppText(
                      l10n.selectTheme,
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 20,
                        color: colors.foreground,
                      ),
                    ),
                  ),
                  GestureDetector(
                    onTap: () => Navigator.pop(context),
                    child: Icon(FIcons.x, size: 24, color: colors.mutedForeground),
                  ),
                ],
              ),
            ),

            Divider(height: 1, color: colors.border),

            // Theme options
            ...AppThemeMode.values.map((mode) {
              final isSelected = currentMode == mode;
              return GestureDetector(
                onTap: () => onThemeSelected(mode),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                  decoration: BoxDecoration(
                    color: isSelected ? colors.primary.withValues(alpha: 0.1) : Colors.transparent,
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: isSelected ? colors.primary.withValues(alpha: 0.15) : colors.muted,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Icon(
                          mode == AppThemeMode.light
                              ? FIcons.sun
                              : mode == AppThemeMode.dark
                                  ? FIcons.moon
                                  : FIcons.monitor,
                          size: 22,
                          color: isSelected ? colors.primary : colors.mutedForeground,
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            AppText(
                              _getThemeModeName(mode),
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                                color: colors.foreground,
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (isSelected)
                        Container(
                          width: 24,
                          height: 24,
                          decoration: BoxDecoration(
                            color: colors.primary,
                            shape: BoxShape.circle,
                          ),
                          child: Icon(FIcons.check, size: 14, color: colors.primaryForeground),
                        ),
                    ],
                  ),
                ),
              );
            }),

            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  String _getThemeModeName(AppThemeMode mode) {
    switch (mode) {
      case AppThemeMode.light:
        return l10n.light;
      case AppThemeMode.dark:
        return l10n.dark;
      case AppThemeMode.system:
        return l10n.systemDefault;
    }
  }

}

/// Bottom sheet for selecting language
class _LanguageSelectorSheet extends StatelessWidget {
  final Function(Locale) onLanguageSelected;
  final Locale currentLocale;
  final AppLocalizations l10n;

  const _LanguageSelectorSheet({
    required this.onLanguageSelected,
    required this.currentLocale,
    required this.l10n,
  });

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final colors = theme.colors;

    final languages = [
      (locale: const Locale('ar'), name: 'العربية', nativeName: 'Arabic'),
      (locale: const Locale('en'), name: 'English', nativeName: 'English'),
    ];

    return Container(
      decoration: BoxDecoration(
        color: colors.background,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Handle
            Container(
              margin: const EdgeInsets.only(top: 12, bottom: 8),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: colors.mutedForeground,
                borderRadius: BorderRadius.circular(2),
              ),
            ),

            // Header
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children: [
                  Expanded(
                    child: AppText(
                      l10n.selectLanguage,
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 20,
                        color: colors.foreground,
                      ),
                    ),
                  ),
                  GestureDetector(
                    onTap: () => Navigator.pop(context),
                    child: Icon(FIcons.x, size: 24, color: colors.mutedForeground),
                  ),
                ],
              ),
            ),

            Divider(height: 1, color: colors.border),

            // Language options
            ...languages.map((lang) {
              final isSelected = currentLocale.languageCode == lang.locale.languageCode;
              return GestureDetector(
                onTap: () => onLanguageSelected(lang.locale),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                  decoration: BoxDecoration(
                    color: isSelected ? colors.primary.withValues(alpha: 0.1) : Colors.transparent,
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: isSelected ? colors.primary.withValues(alpha: 0.15) : colors.muted,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Center(
                          child: AppText(
                            lang.locale.languageCode.toUpperCase(),
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                              color: isSelected ? colors.primary : colors.mutedForeground,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: AppText(
                          lang.name,
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                            color: colors.foreground,
                          ),
                        ),
                      ),
                      if (isSelected)
                        Container(
                          width: 24,
                          height: 24,
                          decoration: BoxDecoration(
                            color: colors.primary,
                            shape: BoxShape.circle,
                          ),
                          child: Icon(FIcons.check, size: 14, color: colors.primaryForeground),
                        ),
                    ],
                  ),
                ),
              );
            }),

            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }
}

/// Bottom sheet for updating profile (name + phone)
class _UpdateProfileSheet extends StatefulWidget {
  final WidgetRef ref;
  final AppLocalizations l10n;
  final String? currentName;
  final VoidCallback onSuccess;

  const _UpdateProfileSheet({
    required this.ref,
    required this.l10n,
    required this.currentName,
    required this.onSuccess,
  });

  @override
  State<_UpdateProfileSheet> createState() => _UpdateProfileSheetState();
}

class _UpdateProfileSheetState extends State<_UpdateProfileSheet> {
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  bool _isLoading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    if (widget.currentName != null) {
      _nameController.text = widget.currentName!;
    }
    _loadCurrentPhone();
  }

  Future<void> _loadCurrentPhone() async {
    final phone = await widget.ref.read(settingsProvider.notifier).getPhoneNumber();
    if (phone != null && mounted) {
      _phoneController.text = phone;
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _handleUpdate() async {
    final name = _nameController.text.trim();
    final phone = _phoneController.text.trim();

    if (name.isEmpty || phone.isEmpty) {
      setState(() => _error = widget.l10n.fillAllFields);
      return;
    }

    if (!RegExp(r'^01[0-9]{9}$').hasMatch(phone)) {
      setState(() => _error = widget.l10n.invalidPhone);
      return;
    }

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final success = await widget.ref.read(settingsProvider.notifier).updateProfile(name, phone);
      if (mounted) {
        if (success) {
          widget.onSuccess();
        } else {
          setState(() {
            _error = widget.l10n.failedToUpdateProfile;
            _isLoading = false;
          });
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = widget.l10n.anErrorOccurred(e.toString());
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final colors = theme.colors;

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        decoration: BoxDecoration(
          color: colors.background,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Handle
              Container(
                margin: const EdgeInsets.only(top: 12, bottom: 8),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: colors.mutedForeground,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),

              // Header
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: Row(
                  children: [
                    Expanded(
                      child: AppText(
                        widget.l10n.updateProfile,
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 20,
                          color: colors.foreground,
                        ),
                      ),
                    ),
                    GestureDetector(
                      onTap: () => Navigator.pop(context),
                      child: Icon(FIcons.x, size: 24, color: colors.mutedForeground),
                    ),
                  ],
                ),
              ),

              Divider(height: 1, color: colors.border),

              // Content
              Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (_error != null) ...[
                      FAlert(
                        variant: FAlertVariant.destructive,
                        icon: const Icon(FIcons.circleAlert),
                        title: AppText(widget.l10n.error),
                        subtitle: AppText(_error!),
                      ),
                      const SizedBox(height: 16),
                    ],

                    FTextField(
                      control: FTextFieldControl.managed(controller: _nameController),
                      label: AppText(widget.l10n.name),
                      hint: widget.l10n.yourDisplayName,
                      enabled: !_isLoading,
                    ),
                    const SizedBox(height: 16),

                    FTextField(
                      control: FTextFieldControl.managed(controller: _phoneController),
                      label: AppText(widget.l10n.phoneNumber),
                      hint: widget.l10n.enterPhoneNumber,
                      enabled: !_isLoading,
                      keyboardType: TextInputType.phone,
                    ),
                    const SizedBox(height: 24),

                    SizedBox(
                      width: double.infinity,
                      child: FButton(
                        onPress: _isLoading ? null : _handleUpdate,
                        child: _isLoading
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : AppText(widget.l10n.updateProfile),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Bottom sheet for changing password
class _ChangePasswordSheet extends StatefulWidget {
  final WidgetRef ref;
  final AppLocalizations l10n;
  final VoidCallback onSuccess;

  const _ChangePasswordSheet({
    required this.ref,
    required this.l10n,
    required this.onSuccess,
  });

  @override
  State<_ChangePasswordSheet> createState() => _ChangePasswordSheetState();
}

class _ChangePasswordSheetState extends State<_ChangePasswordSheet> {
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  bool _isLoading = false;
  String? _error;

  @override
  void dispose() {
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _handleChangePassword() async {
    final password = _newPasswordController.text;
    final confirm = _confirmPasswordController.text;

    if (password.isEmpty) {
      setState(() => _error = widget.l10n.enterNewPassword);
      return;
    }
    if (password.length < 8) {
      setState(() => _error = widget.l10n.passwordMustBe8Chars);
      return;
    }
    if (confirm.isEmpty) {
      setState(() => _error = widget.l10n.pleaseConfirmPassword);
      return;
    }
    if (password != confirm) {
      setState(() => _error = widget.l10n.passwordsDontMatch);
      return;
    }

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final success = await widget.ref.read(settingsProvider.notifier).changePassword(password);
      if (mounted) {
        if (success) {
          widget.onSuccess();
        } else {
          setState(() {
            _error = widget.l10n.failedToChangePassword;
            _isLoading = false;
          });
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = widget.l10n.anErrorOccurred(e.toString());
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final colors = theme.colors;

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        decoration: BoxDecoration(
          color: colors.background,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Handle
              Container(
                margin: const EdgeInsets.only(top: 12, bottom: 8),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: colors.mutedForeground,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),

              // Header
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: Row(
                  children: [
                    Expanded(
                      child: AppText(
                        widget.l10n.changePassword,
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 20,
                          color: colors.foreground,
                        ),
                      ),
                    ),
                    GestureDetector(
                      onTap: () => Navigator.pop(context),
                      child: Icon(FIcons.x, size: 24, color: colors.mutedForeground),
                    ),
                  ],
                ),
              ),

              Divider(height: 1, color: colors.border),

              // Content
              Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (_error != null) ...[
                      FAlert(
                        variant: FAlertVariant.destructive,
                        icon: const Icon(FIcons.circleAlert),
                        title: AppText(widget.l10n.error),
                        subtitle: AppText(_error!),
                      ),
                      const SizedBox(height: 16),
                    ],

                    FTextField.password(
                      control: FTextFieldControl.managed(controller: _newPasswordController),
                      label: AppText(widget.l10n.newPassword),
                      hint: widget.l10n.enterNewPassword,
                      enabled: !_isLoading,
                    ),
                    const SizedBox(height: 16),

                    FTextField.password(
                      control: FTextFieldControl.managed(controller: _confirmPasswordController),
                      label: AppText(widget.l10n.confirmPassword),
                      hint: widget.l10n.pleaseConfirmPassword,
                      enabled: !_isLoading,
                      onSubmit: (_) => _handleChangePassword(),
                    ),
                    const SizedBox(height: 24),

                    SizedBox(
                      width: double.infinity,
                      child: FButton(
                        onPress: _isLoading ? null : _handleChangePassword,
                        child: _isLoading
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : AppText(widget.l10n.changePassword),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

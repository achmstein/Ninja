import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../l10n/app_localizations.dart';
import '../../../core/ui/ui.dart';
import '../../../core/auth/auth_service.dart';
import '../../../core/providers/locale_provider.dart';
import '../../../core/theme/theme_provider.dart';
import '../../../core/widgets/app_text.dart';
import '../providers/settings_provider.dart';
import '../../../core/brand/brand_provider.dart';

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
    // A business that writes one language speaks it, with nothing to switch
    final oneLanguage = ref.watch(brandProvider.select((b) => b.locale.writesOneLanguage));
    final authState = ref.watch(authServiceProvider);
    final locale = ref.watch(localeProvider);
    final l10n = AppLocalizations.of(context)!;

    Widget section(String label, List<Widget> tiles) => Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [SectionLabel(label), TileGroup(children: tiles)],
        );

    return NinjaPage(
      title: l10n.settings,
      back: true,
      children: [
        section(l10n.notifications, [
          NinjaTile(
            icon: LucideIcons.bell,
            title: AppText(l10n.orderStatusUpdates),
            trailing: NinjaSwitch(
              value: settingsState.preferences.orderStatusUpdates,
              onChange: (value) => ref.read(settingsProvider.notifier).updateNotificationPreference(orderStatusUpdates: value),
            ),
          ),
          NinjaTile(
            icon: LucideIcons.tag,
            title: AppText(l10n.promotionsAndOffers),
            trailing: NinjaSwitch(
              value: settingsState.preferences.promotionsAndOffers,
              onChange: (value) => ref.read(settingsProvider.notifier).updateNotificationPreference(promotionsAndOffers: value),
            ),
          ),
        ]),
        section(l10n.appearance, [
          // The web's ThemeSwitch, inline: the chosen one on the liquid pill
          NinjaTile(
            icon: LucideIcons.palette,
            title: AppText(l10n.theme),
            trailing: _ThemeSegments(
              mode: themeState.themeMode,
              onChanged: (mode) => ref.read(themeProvider.notifier).setThemeMode(mode),
            ),
          ),
          // Two languages: the row states where it stands and flips on tap
          if (!oneLanguage)
            NinjaTile(
              icon: LucideIcons.globe,
              title: AppText(l10n.language),
              value: AppText(locale.languageCode == 'ar' ? l10n.arabic : l10n.english),
              onPress: () => ref.read(localeProvider.notifier).setLocale(Locale(locale.languageCode == 'ar' ? 'en' : 'ar')),
            ),
        ]),
        if (authState.isAuthenticated)
          section(l10n.account, [
            NinjaTile(icon: LucideIcons.user, title: AppText(l10n.updateProfile), onPress: () => _showUpdateProfileSheet(context, ref)),
            if (!authState.isSocialLogin)
              NinjaTile(icon: LucideIcons.lock, title: AppText(l10n.changePassword), onPress: () => _showChangePasswordSheet(context, ref)),
            NinjaTile(
              icon: LucideIcons.trash2,
              destructive: true,
              title: AppText(l10n.deleteAccount),
              onPress: () => _showDeleteAccountDialog(context, ref),
            ),
          ]),
      ],
    );
  }

  void _showUpdateProfileSheet(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final authState = ref.read(authServiceProvider);

    showNinjaSheet(
      context: context,
      padding: EdgeInsets.zero,
      builder: (sheetContext) => _UpdateProfileSheet(
        ref: ref,
        l10n: l10n,
        currentName: authState.nameParts,
        onSuccess: () {
          Navigator.pop(sheetContext);
          showIsland(
            context: context,
            title: AppText(l10n.profileUpdatedSuccessfully),
            icon: Icon(LucideIcons.circleCheck, color: Colors.green.shade600),
          );
        },
      ),
    );
  }

  void _showChangePasswordSheet(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;

    showNinjaSheet(
      context: context,
      padding: EdgeInsets.zero,
      builder: (sheetContext) => _ChangePasswordSheet(
        ref: ref,
        l10n: l10n,
        onSuccess: () {
          Navigator.pop(sheetContext);
          showIsland(
            context: context,
            title: AppText(l10n.passwordChangedSuccessfully),
            icon: Icon(LucideIcons.circleCheck, color: Colors.green.shade600),
          );
        },
      ),
    );
  }

  void _showDeleteAccountDialog(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    showNinjaSheet(
      context: context,
      builder: (dialogContext) => NinjaDialog(
        title: AppText(l10n.deleteAccountQuestion, style: TextStyle(fontWeight: FontWeight.bold)),
        body: AppText(l10n.cannotBeUndone),
        actions: [
          NinjaButton(
            variant: NinjaButtonVariant.secondary,
            onPress: () => Navigator.pop(dialogContext),
            child: AppText(l10n.cancel),
          ),
          NinjaButton(
            variant: NinjaButtonVariant.destructive,
            onPress: () async {
              Navigator.pop(dialogContext);

              final success = await ref.read(settingsProvider.notifier).deleteAccount();

              if (success && context.mounted) {
                // Sign out after account deletion
                await ref.read(authServiceProvider.notifier).signOut();
                if (context.mounted) {
                  showIsland(
                    context: context,
                    title: AppText(l10n.accountDeletedSuccessfully),
                    icon: Icon(LucideIcons.check, color: NinjaColors.success),
                  );
                }
              } else if (context.mounted) {
                showIsland(
                  context: context,
                  title: AppText(l10n.failedToDeleteAccount),
                  icon: Icon(LucideIcons.circleX, color: context.theme.colors.destructive),
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



/// Bottom sheet for updating profile (name + phone)
class _UpdateProfileSheet extends StatefulWidget {
  final WidgetRef ref;
  final AppLocalizations l10n;
  final (String, String) currentName;
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
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _phoneController = TextEditingController();
  bool _isLoading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _firstNameController.text = widget.currentName.$1;
    _lastNameController.text = widget.currentName.$2;
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
    _firstNameController.dispose();
    _lastNameController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _handleUpdate() async {
    final firstName = _firstNameController.text.trim();
    final lastName = _lastNameController.text.trim();
    final phone = _phoneController.text.trim();

    if (firstName.isEmpty || lastName.isEmpty || phone.isEmpty) {
      setState(() => _error = widget.l10n.fillAllFields);
      return;
    }

    if (!widget.ref.read(brandProvider).locale.isValidPhone(phone)) {
      setState(() => _error = widget.l10n.invalidPhone);
      return;
    }

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final success = await widget.ref.read(settingsProvider.notifier).updateProfile(firstName, lastName, phone);
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
      padding: EdgeInsets.zero,
      child: Container(
        decoration: BoxDecoration(
          // On the slab sheet, which draws the page and the corners
          color: Colors.transparent,
        ),
        child: SafeArea(
          top: false,
          bottom: false,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [

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
                      child: Icon(LucideIcons.x, size: 24, color: colors.mutedForeground),
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
                      NinjaAlert(
                        variant: NinjaAlertVariant.destructive,
                        icon: const Icon(LucideIcons.circleAlert),
                        title: AppText(widget.l10n.error),
                        subtitle: AppText(_error!),
                      ),
                      const SizedBox(height: 16),
                    ],

                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: NinjaField(
                            controller: _firstNameController,
                            label: AppText(widget.l10n.firstName),
                            enabled: !_isLoading,
                            textCapitalization: TextCapitalization.words,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: NinjaField(
                            controller: _lastNameController,
                            label: AppText(widget.l10n.lastName),
                            enabled: !_isLoading,
                            textCapitalization: TextCapitalization.words,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),

                    NinjaField(
                      controller: _phoneController,
                      label: AppText(widget.l10n.phoneNumber),
                      hint: widget.l10n.enterPhoneNumber,
                      enabled: !_isLoading,
                      keyboardType: TextInputType.phone,
                    ),
                    const SizedBox(height: 24),

                    SizedBox(
                      width: double.infinity,
                      child: NinjaButton(
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
      padding: EdgeInsets.zero,
      child: Container(
        decoration: BoxDecoration(
          // On the slab sheet, which draws the page and the corners
          color: Colors.transparent,
        ),
        child: SafeArea(
          top: false,
          bottom: false,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [

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
                      child: Icon(LucideIcons.x, size: 24, color: colors.mutedForeground),
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
                      NinjaAlert(
                        variant: NinjaAlertVariant.destructive,
                        icon: const Icon(LucideIcons.circleAlert),
                        title: AppText(widget.l10n.error),
                        subtitle: AppText(_error!),
                      ),
                      const SizedBox(height: 16),
                    ],

                    NinjaField.password(
                      controller: _newPasswordController,
                      label: AppText(widget.l10n.newPassword),
                      hint: widget.l10n.enterNewPassword,
                      enabled: !_isLoading,
                    ),
                    const SizedBox(height: 16),

                    NinjaField.password(
                      controller: _confirmPasswordController,
                      label: AppText(widget.l10n.confirmPassword),
                      hint: widget.l10n.pleaseConfirmPassword,
                      enabled: !_isLoading,
                      onSubmit: (_) => _handleChangePassword(),
                    ),
                    const SizedBox(height: 24),

                    SizedBox(
                      width: double.infinity,
                      child: NinjaButton(
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

/// Light / dark / system as three icons, the current one filled: the web's
/// ThemeSwitch, inline on the row instead of behind a sheet
class _ThemeSegments extends StatelessWidget {
  final AppThemeMode mode;
  final ValueChanged<AppThemeMode> onChanged;

  const _ThemeSegments({required this.mode, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    // The small segment that sits at the end of a tile, the chosen one on the liquid pill
    return SizedBox(
      width: 132,
      child: Segment<AppThemeMode>(
        compact: true,
        value: mode,
        onChange: onChanged,
        options: const [
          (value: AppThemeMode.light, label: Icon(LucideIcons.sun)),
          (value: AppThemeMode.dark, label: Icon(LucideIcons.moon)),
          (value: AppThemeMode.system, label: Icon(LucideIcons.monitor)),
        ],
      ),
    );
  }
}

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import '../../../core/auth/sign_out.dart';
import '../../../core/config/app_config.dart';
import '../../../core/providers/locale_provider.dart';
import '../../../core/services/push_service.dart';
import '../../../core/services/update_service.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/text_styles.dart';
import '../../../core/widgets/connection_row.dart';
import '../../../core/widgets/settings_list.dart';
import '../../../l10n/app_localizations.dart';

/// The rider's settings: the app's language and look, whether the phone
/// rings for new deliveries, the business it is connected to, the app's
/// version, and signing out.
class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final locale = ref.watch(localeProvider);
    final themeState = ref.watch(themeProvider);
    final isDark = themeState.resolveBrightness(context) == Brightness.dark;
    final permission = ref.watch(pushPermissionProvider);
    final muted = theme.colors.mutedForeground;
    final notifications = !pushAvailable
        ? l10n.notificationsUnavailable
        : permission == AuthorizationStatus.denied
            ? l10n.notificationsOff
            : l10n.notificationsOn;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              SizedBox.square(
                dimension: 48,
                child: FButton.icon(
                  variant: FButtonVariant.ghost,
                  onPress: () => context.go('/'),
                  child: const Icon(FIcons.arrowLeft, size: 24),
                ),
              ),
              const SizedBox(width: 8),
              Text(l10n.settings, style: theme.typography.xl.copyWith(fontWeight: FontWeight.w700)),
            ],
          ),
          const SizedBox(height: 16),
          SettingsSection(
            title: l10n.thisDevice,
            children: [
              SettingsRow(
                title: l10n.language,
                subtitle: locale.languageCode == 'ar' ? 'العربية' : 'English',
                onPress: ref.read(localeProvider.notifier).toggleLocale,
                trailing: Icon(FIcons.languages, size: 20, color: muted),
              ),
              SettingsRow(
                title: l10n.theme,
                subtitle: isDark ? l10n.themeDark : l10n.themeLight,
                onPress: () => ref.read(themeProvider.notifier).setThemeMode(isDark ? AppThemeMode.light : AppThemeMode.dark),
                trailing: Icon(isDark ? FIcons.moon : FIcons.sun, size: 20, color: muted),
              ),
              SettingsRow(
                title: l10n.notifications,
                subtitle: notifications,
                subtitleColor: pushAvailable && permission != AuthorizationStatus.denied ? AppColors.emerald(theme.colors.brightness) : null,
                onPress: pushAvailable ? () => ref.read(pushServiceProvider).register() : null,
                trailing: Icon(FIcons.bell, size: 20, color: muted),
              ),
              if (!AppConfig.isPinned && AppConfig.connection != null) const ConnectionRow(),
              const _UpdateRow(),
            ],
          ),
          const SizedBox(height: 24),
          SizedBox(
            height: 52,
            child: FButton(
              variant: FButtonVariant.outline,
              onPress: () => signOutRider(ref),
              prefix: Icon(FIcons.logOut, size: 20, color: theme.colors.destructive),
              child: Text(l10n.signOut, style: theme.typography.base.copyWith(color: theme.colors.destructive)),
            ),
          ),
        ],
      ),
    );
  }
}

/// The build on this phone and the newest one on the platform's download page
class _UpdateRow extends ConsumerWidget {
  const _UpdateRow();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final update = ref.watch(updateProvider);
    final notifier = ref.read(updateProvider.notifier);
    final installed = update.installedVersion;
    final status = switch (update.phase) {
      UpdatePhase.checking => l10n.updateChecking,
      UpdatePhase.downloading => l10n.updateDownloading((update.progress * 100).round()),
      UpdatePhase.ready => l10n.updateReady(update.available?.version ?? ''),
      UpdatePhase.installing => l10n.updateInstalling,
      UpdatePhase.needsPermission => l10n.updateNeedsPermission,
      UpdatePhase.failed => l10n.updateFailed,
      UpdatePhase.upToDate || UpdatePhase.idle => l10n.updateUpToDate,
    };
    final canInstall = update.phase == UpdatePhase.ready || update.phase == UpdatePhase.needsPermission;
    final busy = update.phase == UpdatePhase.checking || update.phase == UpdatePhase.downloading || update.phase == UpdatePhase.installing;

    return SettingsRow(
      title: l10n.appVersion,
      hint: l10n.appVersionHint,
      subtitle: [if (installed != null) l10n.appVersionInstalled(installed, update.installedBuild ?? 0), status].join(' · '),
      subtitleColor: update.phase == UpdatePhase.failed ? theme.colors.destructive : null,
      trailing: SizedBox(
        height: 44,
        child: FButton(
          variant: canInstall ? null : FButtonVariant.outline,
          mainAxisSize: MainAxisSize.min,
          onPress: busy ? null : (canInstall ? notifier.install : notifier.check),
          prefix: Icon(canInstall ? FIcons.download : FIcons.refreshCw, size: 18),
          child: Text(canInstall ? l10n.installUpdate : l10n.checkForUpdates, style: theme.typography.base.forButton),
        ),
      ),
    );
  }
}

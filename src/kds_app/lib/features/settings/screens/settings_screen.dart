import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import '../../../core/config/app_config.dart';
import '../../../core/services/kiosk_service.dart';
import '../../../core/services/update_service.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/text_styles.dart';
import '../../../core/widgets/connection_row.dart';
import '../../../core/widgets/settings_list.dart';
import '../../kitchen/printing/kitchen_printing.dart';
import '../../../l10n/app_localizations.dart';

/// Per-tablet settings, laid out like the till's: this device (the café,
/// kiosk mode, the app's version). Language and theme live in the header
/// menu.
class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  KioskStatus? _kiosk;

  @override
  void initState() {
    super.initState();
    _loadKiosk();
  }

  Future<void> _loadKiosk() async {
    final status = await ref.read(kioskServiceProvider).status();
    if (mounted) setState(() => _kiosk = status);
  }

  Future<void> _setKiosk(bool enabled) async {
    await ref.read(kioskServiceProvider).setEnabled(enabled);
    await _loadKiosk();
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final kiosk = _kiosk;

    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 768),
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
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
                      child: Icon(FIcons.arrowLeft, size: 24),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(l10n.settings, style: theme.typography.xl.copyWith(fontWeight: FontWeight.w700)),
                ],
              ),
              const SizedBox(height: 24),
              SettingsSection(
                title: l10n.thisDevice,
                children: [
                  if (!AppConfig.isPinned && AppConfig.connection != null) const ConnectionRow(),
                  // The tablet as a kitchen display and nothing else; the whole row flips it
                  SettingsRow(
                    title: l10n.kiosk,
                    hint: l10n.kioskHint,
                    subtitle: kiosk == null
                        ? null
                        : '${kiosk.isPinned ? l10n.kioskPinned : l10n.kioskNotPinned} · '
                            '${kiosk.isDeviceOwner ? l10n.kioskDeviceOwner : l10n.kioskNotDeviceOwner}',
                    subtitleColor: kiosk?.isPinned == true ? AppColors.emerald(theme.colors.brightness) : null,
                    onPress: kiosk == null ? null : () => _setKiosk(!kiosk.enabled),
                    trailing: FSwitch(value: kiosk?.enabled ?? false, onChange: kiosk == null ? null : _setKiosk),
                  ),
                  // A shop whose till runs in a browser prints the kitchen's tickets from here
                  SettingsRow(
                    title: l10n.kitchenPrinting,
                    hint: l10n.kitchenPrintingHint,
                    onPress: () => ref.read(kitchenPrintingProvider.notifier).set(!ref.read(kitchenPrintingProvider)),
                    trailing: FSwitch(
                      value: ref.watch(kitchenPrintingProvider),
                      onChange: (on) => ref.read(kitchenPrintingProvider.notifier).set(on),
                    ),
                  ),
                  const _UpdateRow(),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The build on this tablet and the newest one on the platform's download page
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

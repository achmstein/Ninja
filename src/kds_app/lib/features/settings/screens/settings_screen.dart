import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import '../../../core/services/kiosk_service.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/text_styles.dart';
import '../../../core/widgets/info_tip.dart';
import '../../../l10n/app_localizations.dart';

/// Per-tablet settings: kiosk mode (language and theme live in the header
/// menu).
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

    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 640),
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
              const SizedBox(height: 16),
              // The tablet as a kitchen display and nothing else
              FCard(
                title: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [Text(l10n.kiosk), const SizedBox(width: 4), InfoTip(text: l10n.kioskHint)],
                ),
                child: Padding(
                  padding: const EdgeInsets.only(top: 16),
                  child: Builder(builder: (context) {
                    final kiosk = _kiosk;
                    if (kiosk == null) return const SizedBox(height: 48);
                    final emerald = AppColors.emerald(theme.colors.brightness);
                    return Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Container(
                                    width: 8,
                                    height: 8,
                                    decoration: BoxDecoration(color: kiosk.isPinned ? AppColors.emerald500 : AppColors.gray400, shape: BoxShape.circle),
                                  ),
                                  const SizedBox(width: 8),
                                  Text(kiosk.isPinned ? l10n.kioskPinned : l10n.kioskNotPinned,
                                      style: theme.typography.base.copyWith(fontWeight: FontWeight.w500)),
                                ],
                              ),
                              Text(
                                kiosk.isDeviceOwner ? l10n.kioskDeviceOwner : l10n.kioskNotDeviceOwner,
                                style: theme.typography.sm.copyWith(color: kiosk.isDeviceOwner ? emerald : theme.colors.mutedForeground),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 12),
                        SizedBox(
                          height: 48,
                          child: FButton(
                            variant: kiosk.enabled ? FButtonVariant.outline : null,
                            mainAxisSize: MainAxisSize.min,
                            onPress: () => _setKiosk(!kiosk.enabled),
                            prefix: Icon(kiosk.enabled ? FIcons.lockOpen : FIcons.lock, size: 20),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 4),
                              child: Text(kiosk.enabled ? l10n.stopKiosk : l10n.startKiosk, style: theme.typography.base.forButton),
                            ),
                          ),
                        ),
                      ],
                    );
                  }),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

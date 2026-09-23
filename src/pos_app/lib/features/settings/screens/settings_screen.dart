import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import '../../../core/config/app_config.dart';
import '../../../core/models/dates.dart';
import '../../../core/models/money.dart';
import '../../../core/network/network_status.dart';
import '../../../core/offline/offline_queue.dart';
import '../../../core/offline/offline_sale.dart';
import '../../../core/printing/kitchen_printing.dart';
import '../../../core/printing/print_service.dart';
import '../../../core/printing/printer_settings.dart';
import '../../../core/services/kiosk_service.dart';
import '../../../core/services/update_service.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/text_styles.dart';
import '../../../core/widgets/connection_row.dart';
import '../../../core/widgets/pos_toast.dart';
import '../../../core/widgets/settings_list.dart';
import '../../../l10n/app_localizations.dart';

/// Per-till settings, as the till lists everything else: this device (the
/// café, kiosk mode, the app's version), the receipt printer, and the sales
/// waiting to sync. Language and theme live in the header menu.
class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  late final TextEditingController _host;
  late final TextEditingController _port;
  bool _busy = false;
  KioskStatus? _kiosk;

  @override
  void initState() {
    super.initState();
    final settings = ref.read(printerSettingsProvider);
    _host = TextEditingController(text: settings.host);
    _port = TextEditingController(text: '${settings.port}');
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
  void dispose() {
    _host.dispose();
    _port.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final l10n = AppLocalizations.of(context)!;
    final port = int.tryParse(_port.text.trim()) ?? PrinterSettings.defaultPort;
    await ref.read(printerSettingsProvider.notifier).save(PrinterSettings(host: _host.text.trim(), port: port));
    if (!mounted) return;
    _port.text = '$port';
    showPosToast(context, PosToastType.success, l10n.printerSaved);
  }

  Future<void> _run(Future<void> Function(PrintService service) job, String success) async {
    final l10n = AppLocalizations.of(context)!;
    // What is typed is what gets tested — save first so the test matches
    await _save();
    if (!mounted) return;
    setState(() => _busy = true);
    try {
      await job(ref.read(printServiceProvider));
      if (mounted) showPosToast(context, PosToastType.success, success);
    } catch (e) {
      if (mounted) showPosToast(context, PosToastType.error, describePrintError(e, l10n));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final locale = Localizations.localeOf(context);
    final kiosk = _kiosk;

    Widget button(String label, VoidCallback? onPress, {IconData? icon, bool primary = false}) => SizedBox(
          height: 44,
          child: FButton(
            variant: primary ? null : FButtonVariant.outline,
            mainAxisSize: MainAxisSize.min,
            onPress: onPress,
            prefix: icon == null ? null : Icon(icon, size: 18),
            child: Text(label, style: theme.typography.base.forButton),
          ),
        );

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
                  // The tablet as a till and nothing else; the whole row flips it
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
                  const _UpdateRow(),
                ],
              ),
              const SizedBox(height: 24),
              SettingsSection(
                title: l10n.printer,
                children: [
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Expanded(
                          flex: 3,
                          child: FTextField(
                            control: FTextFieldControl.managed(controller: _host),
                            label: Text(l10n.printerHost),
                            hint: '192.168.1.50',
                            keyboardType: TextInputType.url,
                            maxLines: 1,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: FTextField(
                            control: FTextFieldControl.managed(controller: _port),
                            label: Text(l10n.printerPort),
                            keyboardType: TextInputType.number,
                            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                            maxLines: 1,
                          ),
                        ),
                        const SizedBox(width: 12),
                        button(l10n.save, _busy ? null : _save, primary: true),
                      ],
                    ),
                  ),
                  SettingsRow(
                    title: l10n.kitchenPrinting,
                    hint: l10n.kitchenPrintingHint,
                    onPress: () => ref.read(kitchenPrintingProvider.notifier).set(!ref.read(kitchenPrintingProvider)),
                    trailing: FSwitch(
                      value: ref.watch(kitchenPrintingProvider),
                      onChange: (on) => ref.read(kitchenPrintingProvider.notifier).set(on),
                    ),
                  ),
                  SettingsRow(
                    title: l10n.printerTest,
                    hint: l10n.printerHint,
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        button(l10n.testPrint, _busy ? null : () => _run((s) => s.testPrint(l10n: l10n, locale: locale), l10n.printed),
                            icon: FIcons.printer),
                        const SizedBox(width: 8),
                        button(l10n.kickDrawer, _busy ? null : () => _run((s) => s.kickDrawer(), l10n.printed), icon: FIcons.banknote),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              const _OfflineSales(),
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

/// What was sold while the network was down, and what became of it
class _OfflineSales extends ConsumerWidget {
  const _OfflineSales();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final sales = ref.watch(offlineQueueProvider);
    final online = ref.watch(onlineProvider);
    final queued = sales.where((s) => s.status == OfflineSaleStatus.queued).length;
    const tabular = [FontFeature.tabularFigures()];

    Widget button(String label, VoidCallback onPress, {bool primary = false, Color? color}) => SizedBox(
          height: 40,
          child: FButton(
            variant: primary ? null : FButtonVariant.outline,
            mainAxisSize: MainAxisSize.min,
            onPress: onPress,
            child: Text(label, style: theme.typography.sm.forButton.copyWith(color: color)),
          ),
        );

    return SettingsSection(
      title: l10n.offlineSales,
      children: [
        if (sales.isEmpty)
          SettingsRow(title: l10n.nothingQueued, hint: l10n.offlineSalesHint)
        else ...[
          for (final sale in sales)
            SettingsRow(
              title: '${sale.provisionalReceiptNumber} · ${money(context, sale.total)}',
              subtitle: sale.status == OfflineSaleStatus.failed
                  ? sale.error ?? l10n.somethingWentWrong
                  : formatDateTimeShort(context, sale.placedAt),
              subtitleColor: sale.status == OfflineSaleStatus.failed ? theme.colors.destructive : null,
              trailing: sale.status == OfflineSaleStatus.failed
                  ? Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        button(l10n.retrySync, () => ref.read(offlineQueueProvider.notifier).retry(sale.id)),
                        const SizedBox(width: 8),
                        button(l10n.discardSale, () => ref.read(offlineQueueProvider.notifier).discard(sale.id), color: theme.colors.destructive),
                      ],
                    )
                  : Text(online ? l10n.syncingSales(1) : l10n.offlineQueued(1),
                      style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground, fontFeatures: tabular)),
            ),
          if (queued > 0 && online)
            Padding(
              padding: const EdgeInsets.all(12),
              child: Align(
                alignment: AlignmentDirectional.centerEnd,
                child: button(l10n.retrySync, () => ref.read(offlineQueueProvider.notifier).drain(), primary: true),
              ),
            ),
        ],
      ],
    );
  }
}

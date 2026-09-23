import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import '../../../core/models/dates.dart';
import '../../../core/models/money.dart';
import '../../../core/widgets/info_tip.dart';
import '../../../core/network/network_status.dart';
import '../../../core/offline/offline_queue.dart';
import '../../../core/offline/offline_sale.dart';
import '../../../core/printing/print_service.dart';
import '../../../core/printing/printer_settings.dart';
import '../../../core/services/kiosk_service.dart';
import '../../../core/services/update_service.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/text_styles.dart';
import '../../../core/widgets/connection_card.dart';
import '../../../core/widgets/pos_toast.dart';
import '../../../l10n/app_localizations.dart';

/// Per-till settings: kiosk mode and the receipt printer (language and
/// theme live in the header menu).
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
              const ConnectionCard(),
              const SizedBox(height: 16),
              _OfflineSalesCard(),
              const SizedBox(height: 16),
              // The tablet as a till and nothing else
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
              const SizedBox(height: 16),
              const _UpdateCard(),
              const SizedBox(height: 16),
              FCard(
                title: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [Text(l10n.printer), const SizedBox(width: 4), InfoTip(text: l10n.printerHint)],
                ),
                child: Padding(
                  padding: const EdgeInsets.only(top: 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
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
                        ],
                      ),
                      const SizedBox(height: 16),
                      Row(
                        children: [
                          SizedBox(
                            height: 48,
                            child: FButton(
                              mainAxisSize: MainAxisSize.min,
                              onPress: _busy ? null : _save,
                              child: Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 8),
                                child: Text(l10n.save, style: theme.typography.base.forButton),
                              ),
                            ),
                          ),
                          const Spacer(),
                          SizedBox(
                            height: 48,
                            child: FButton(
                              variant: FButtonVariant.outline,
                              mainAxisSize: MainAxisSize.min,
                              onPress: _busy
                                  ? null
                                  : () => _run((s) => s.testPrint(l10n: l10n, locale: locale), l10n.printed),
                              prefix: const Icon(FIcons.printer, size: 20),
                              child: Text(l10n.testPrint, style: theme.typography.base.forButton),
                            ),
                          ),
                          const SizedBox(width: 8),
                          SizedBox(
                            height: 48,
                            child: FButton(
                              variant: FButtonVariant.outline,
                              mainAxisSize: MainAxisSize.min,
                              onPress: _busy ? null : () => _run((s) => s.kickDrawer(), l10n.printed),
                              prefix: const Icon(FIcons.banknote, size: 20),
                              child: Text(l10n.kickDrawer, style: theme.typography.base.forButton),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The build on this tablet and the newest one on the platform's download page
class _UpdateCard extends ConsumerWidget {
  const _UpdateCard();

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

    return FCard(
      title: Row(
        mainAxisSize: MainAxisSize.min,
        children: [Text(l10n.appVersion), const SizedBox(width: 4), InfoTip(text: l10n.appVersionHint)],
      ),
      child: Padding(
        padding: const EdgeInsets.only(top: 16),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (installed != null)
                    Text(l10n.appVersionInstalled(installed, update.installedBuild ?? 0),
                        style: theme.typography.base.copyWith(fontWeight: FontWeight.w500)),
                  Text(status, style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground)),
                ],
              ),
            ),
            const SizedBox(width: 12),
            SizedBox(
              height: 48,
              child: FButton(
                variant: canInstall ? null : FButtonVariant.outline,
                mainAxisSize: MainAxisSize.min,
                onPress: busy ? null : (canInstall ? notifier.install : notifier.check),
                prefix: Icon(canInstall ? FIcons.download : FIcons.refreshCw, size: 20),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  child: Text(canInstall ? l10n.installUpdate : l10n.checkForUpdates, style: theme.typography.base.forButton),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// What was sold while the network was down, and what became of it
class _OfflineSalesCard extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final sales = ref.watch(offlineQueueProvider);
    final online = ref.watch(onlineProvider);
    final queued = sales.where((s) => s.status == OfflineSaleStatus.queued).length;
    final muted = theme.typography.sm.copyWith(color: theme.colors.mutedForeground);
    const tabular = [FontFeature.tabularFigures()];

    return FCard(
      title: Row(
        mainAxisSize: MainAxisSize.min,
        children: [Text(l10n.offlineSales), const SizedBox(width: 4), InfoTip(text: l10n.offlineSalesHint)],
      ),
      child: Padding(
        padding: const EdgeInsets.only(top: 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (sales.isEmpty)
              Text(l10n.nothingQueued, style: muted)
            else ...[
              for (final (index, sale) in sales.indexed) ...[
                if (index > 0) Container(height: 1, color: theme.colors.border),
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('${sale.provisionalReceiptNumber} · ${money(context, sale.total)}',
                                style: theme.typography.base.copyWith(fontWeight: FontWeight.w500, fontFeatures: tabular)),
                            Text(formatDateTimeShort(context, sale.placedAt), style: muted.copyWith(fontFeatures: tabular)),
                            if (sale.status == OfflineSaleStatus.failed)
                              Text(sale.error ?? l10n.somethingWentWrong,
                                  style: theme.typography.sm.copyWith(color: theme.colors.destructive)),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      if (sale.status == OfflineSaleStatus.failed) ...[
                        SizedBox(
                          height: 40,
                          child: FButton(
                            variant: FButtonVariant.outline,
                            mainAxisSize: MainAxisSize.min,
                            onPress: () => ref.read(offlineQueueProvider.notifier).retry(sale.id),
                            child: Text(l10n.retrySync, style: theme.typography.sm.forButton),
                          ),
                        ),
                        const SizedBox(width: 8),
                        SizedBox(
                          height: 40,
                          child: FButton(
                            variant: FButtonVariant.outline,
                            mainAxisSize: MainAxisSize.min,
                            onPress: () => ref.read(offlineQueueProvider.notifier).discard(sale.id),
                            child: Text(l10n.discardSale, style: theme.typography.sm.forButton.copyWith(color: theme.colors.destructive)),
                          ),
                        ),
                      ] else
                        Text(online ? l10n.syncingSales(1) : l10n.offlineQueued(1), style: muted),
                    ],
                  ),
                ),
              ],
              if (queued > 0 && online) ...[
                const SizedBox(height: 8),
                Align(
                  alignment: AlignmentDirectional.centerEnd,
                  child: SizedBox(
                    height: 44,
                    child: FButton(
                      mainAxisSize: MainAxisSize.min,
                      onPress: () => ref.read(offlineQueueProvider.notifier).drain(),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 8),
                        child: Text(l10n.retrySync, style: theme.typography.base.forButton),
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import '../auth/auth_service.dart';
import '../brand/brand_provider.dart';
import '../config/app_config.dart';
import '../config/tenant_connection.dart';
import '../providers/branch_provider.dart';
import '../theme/text_styles.dart';
import '../../l10n/app_localizations.dart';
import 'confirm_dialog.dart';
import 'settings_list.dart';

/// Which café this tablet is connected to, as a settings row, and the way out: a tablet that
/// moves to another café (or was pointed at the wrong one) is signed out,
/// forgets what it cached, and starts over at the connect screen. A build
/// pinned to one stack has nothing to change and shows nothing.
class ConnectionRow extends ConsumerWidget {
  const ConnectionRow({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final connection = AppConfig.connection;
    if (AppConfig.isPinned || connection == null) return const SizedBox.shrink();
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;

    Future<void> change() async {
      final ok = await showConfirmDialog(
        context,
        title: l10n.changeCafe,
        description: l10n.changeCafeConfirm,
        cancelLabel: l10n.cancel,
        actionLabel: l10n.changeCafe,
        destructive: true,
      );
      if (!ok) return;
      await ref.read(authServiceProvider.notifier).signOut();
      await forgetBranch();
      await forgetBrand();
      // The gate tears the app down and shows the connect screen
      await TenantConnection.clear();
    }

    return SettingsRow(
      title: connection.cafeName.isEmpty ? l10n.connectedTo : connection.cafeName,
      subtitle: connection.host,
      trailing: SizedBox(
        height: 44,
        child: FButton(
          variant: FButtonVariant.outline,
          mainAxisSize: MainAxisSize.min,
          onPress: change,
          child: Text(l10n.changeCafe, style: theme.typography.base.forButton),
        ),
      ),
    );
  }
}

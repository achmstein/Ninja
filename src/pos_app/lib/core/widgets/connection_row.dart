import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import '../auth/auth_service.dart';
import '../brand/brand_provider.dart';
import '../config/app_config.dart';
import 'package:ninja_app_core/tenant_connection.dart';
import 'package:ninja_app_core/providers/branch_provider.dart';
import 'package:ninja_app_core/theme/text_styles.dart';
import '../../l10n/app_localizations.dart';
import 'package:ninja_app_core/widgets/confirm_dialog.dart';
import 'package:ninja_app_core/widgets/settings_list.dart';

/// Which business this tablet is connected to, as a settings row, and the way out: a tablet that
/// moves to another business (or was pointed at the wrong one) is signed out,
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
        title: l10n.changeBusiness,
        description: l10n.changeBusinessConfirm,
        cancelLabel: l10n.cancel,
        actionLabel: l10n.changeBusiness,
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
      title: connection.businessName.isEmpty ? l10n.connectedTo : connection.businessName,
      subtitle: connection.host,
      trailing: SizedBox(
        height: 44,
        child: FButton(
          variant: FButtonVariant.outline,
          mainAxisSize: MainAxisSize.min,
          onPress: change,
          child: Text(l10n.changeBusiness, style: theme.typography.base.forButton),
        ),
      ),
    );
  }
}

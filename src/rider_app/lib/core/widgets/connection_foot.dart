import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import '../auth/auth_service.dart';
import 'package:ninja_app_core/brand/brand_provider.dart';
import '../config/app_config.dart';
import 'package:ninja_app_core/tenant_connection.dart';
import 'package:ninja_app_core/providers/branch_provider.dart';
import '../../l10n/app_localizations.dart';

/// Under the sign-in form: which business this phone is connected to, and a
/// way to change it before anyone signs in (a phone pointed at the wrong
/// business cannot reach settings). Nothing on a build pinned to one stack.
class ConnectionFoot extends ConsumerWidget {
  const ConnectionFoot({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final connection = AppConfig.connection;
    if (AppConfig.isPinned || connection == null) return const SizedBox.shrink();
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final muted = theme.typography.xs.copyWith(color: theme.colors.mutedForeground);

    Future<void> change() async {
      await ref.read(authServiceProvider.notifier).signOut();
      await forgetBranch();
      await forgetBrand();
      await TenantConnection.clear();
    }

    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Wrap(
        alignment: WrapAlignment.center,
        crossAxisAlignment: WrapCrossAlignment.center,
        spacing: 4,
        children: [
          Text(connection.host, style: muted, textDirection: TextDirection.ltr),
          Text('·', style: muted),
          FButton(
            variant: FButtonVariant.ghost,
            mainAxisSize: MainAxisSize.min,
            onPress: change,
            child: Text(l10n.changeBusiness, style: muted.copyWith(color: theme.colors.foreground)),
          ),
        ],
      ),
    );
  }
}

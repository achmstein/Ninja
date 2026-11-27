import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import '../../l10n/app_localizations.dart';
import '../auth/auth_service.dart';
import 'package:ninja_app_core/providers/branch_provider.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import '../theme/type_roles.dart';
import 'pos_dialog.dart';

/// Shown instead of the screens when the signed-in account is assigned to no
/// branch: membership travels in the token (the `branches` claim), and an
/// account without it may operate nothing until the owner assigns one. A
/// refresh picks up a fresh assignment; sign-out is the way out.
class NoBranchScreen extends ConsumerWidget {
  const NoBranchScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final muted = theme.colors.mutedForeground;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 480),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(FIcons.store, size: Sizes.iconHero, color: muted),
              const SizedBox(height: 16),
              Text(l10n.noBranchTitle, style: theme.type.title, textAlign: TextAlign.center),
              const SizedBox(height: 8),
              Text(l10n.noBranchDescription, style: theme.type.body.copyWith(color: muted), textAlign: TextAlign.center),
              const SizedBox(height: 24),
              // Side by side at one width; a phone has no room for both, so one over the other
              DialogActions(
                alignment: Alignment.center,
                children: [
                  SizedBox(
                    height: Sizes.control,
                    child: FButton(
                      variant: FButtonVariant.ghost,
                      mainAxisSize: MainAxisSize.min,
                      onPress: ref.read(authServiceProvider.notifier).signOut,
                      prefix: const Icon(FIcons.logOut, size: Sizes.icon),
                      child: Text(l10n.signOut, style: theme.type.button),
                    ),
                  ),
                  SizedBox(
                    height: Sizes.control,
                    child: FButton(
                      variant: FButtonVariant.outline,
                      mainAxisSize: MainAxisSize.min,
                      onPress: () async {
                        // A new assignment reaches the token on refresh
                        await ref.read(authServiceProvider.notifier).refreshToken();
                        await ref.read(branchProvider.notifier).refresh();
                      },
                      prefix: const Icon(FIcons.refreshCw, size: Sizes.icon),
                      child: Text(l10n.retry, style: theme.type.button),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

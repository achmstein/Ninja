import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import '../auth/auth_service.dart';
import 'package:ninja_app_core/providers/branch_provider.dart';
import 'no_branch_screen.dart';
import 'rider_header.dart';
import 'rider_nav_bar.dart';

/// The app frame, laid out for a phone: the business and branch at the top,
/// the screen, and the tabs at the foot. An account with no branch to work
/// in sees the no-branch screen instead; the tabs stay, so settings and
/// sign-out are reachable.
class RiderShell extends ConsumerWidget {
  final Widget child;

  /// The path on screen, for the tab bar
  final String location;

  const RiderShell({super.key, required this.child, this.location = '/'});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = context.theme;
    final blocked = ref.watch(branchProvider.select((s) => s.noBranch)) && !ref.watch(isOwnerProvider);
    return Scaffold(
      backgroundColor: theme.colors.background,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            const RiderHeader(),
            Expanded(child: blocked && location != '/settings' ? const NoBranchScreen() : child),
          ],
        ),
      ),
      bottomNavigationBar: RiderNavBar(location: location),
    );
  }
}

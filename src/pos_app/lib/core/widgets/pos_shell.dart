import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import '../auth/auth_service.dart';
import '../providers/branch_provider.dart';
import 'kitchen_printer_banner.dart';
import 'no_branch_screen.dart';
import 'pos_header.dart';

/// The app frame: one 64 dp header row and the screen beneath it. No
/// bottom navigation — pos_web's screens are reached from the floor. An
/// account with no branch to work in sees the no-branch screen instead;
/// the header stays, so settings and sign-out remain reachable.
class PosShell extends ConsumerWidget {
  final Widget child;

  const PosShell({super.key, required this.child});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = context.theme;
    final blocked = ref.watch(branchProvider.select((s) => s.noBranch)) && !ref.watch(isOwnerProvider);
    return Scaffold(
      backgroundColor: theme.colors.background,
      body: Column(
        children: [
          const PosHeader(),
          if (!blocked) const KitchenPrinterBanner(),
          Expanded(child: blocked ? const NoBranchScreen() : child),
        ],
      ),
    );
  }
}

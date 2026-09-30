import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../features/places/screens/qr_scan_screen.dart';
import '../../l10n/app_localizations.dart';
import '../brand/brand_mark.dart';
import '../brand/brand_provider.dart';
import '../motion/motion.dart';
import '../ui/ui.dart';
import '../widgets/branch_switcher.dart';

/// The top bar's height and the wordmark's in it, per the business's header
/// size seed (client_web's HEADER_SIZES and --bar-h): never shorter than the
/// island in it needs, so a tall logo keeps room above and below it
({double bar, double wordmark}) topBarSize(String? headerSize) {
  final (header, wordmark) = switch (headerSize) {
    'md' => (72.0, 44.0),
    'lg' => (88.0, 60.0),
    _ => (56.0, 28.0),
  };
  return (bar: header < 64 ? 64 : header, wordmark: wordmark);
}

/// The top bar in the Ninja style (client_web's top-bar.tsx): slim, the
/// brand at the start and, at the end, the switch of branch and the way to
/// scan a table's or a room's code. It is the top of the page it is on and
/// scrolls away with it. While the island is up in its corner the chips
/// step aside.
class NinjaTopBar extends ConsumerWidget {
  const NinjaTopBar({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final size = topBarSize(ref.watch(brandProvider.select((b) => b.theme.headerSize)));
    final l10n = AppLocalizations.of(context)!;
    return SizedBox(
      height: size.bar,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Row(
          children: [
            Flexible(
              child: GestureDetector(
                onTap: () => context.go('/menu'),
                child: ConstrainedBox(
                  constraints: BoxConstraints(maxHeight: size.bar - 20, maxWidth: MediaQuery.sizeOf(context).width / 2),
                  child: BrandWordmark(height: size.wordmark),
                ),
              ),
            ),
            const Spacer(),
            ValueListenableBuilder<bool>(
              valueListenable: island.busy,
              builder: (context, busy, child) => IgnorePointer(
                ignoring: busy,
                child: AnimatedOpacity(
                  opacity: busy ? 0 : 1,
                  duration: Motion.base,
                  child: AnimatedScale(scale: busy ? 0.9 : 1, duration: Motion.base, curve: Motion.enter, child: child),
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const BranchSwitcher(),
                  const SizedBox(width: 8),
                  NinjaIconButton(
                    size: 36,
                    semanticLabel: l10n.claimScan,
                    onPress: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const QrScanScreen())),
                    child: const Icon(LucideIcons.scanLine),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

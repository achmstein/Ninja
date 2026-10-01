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
import 'tuck.dart';

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
            // The wordmark at the start, and all the room between it and the chips at the end: a
            // Flexible beside a Spacer would split that room in two and push the chips to the middle
            Expanded(
              child: Align(
                alignment: AlignmentDirectional.centerStart,
                child: GestureDetector(
                  onTap: () => context.go('/menu'),
                  child: ConstrainedBox(
                    constraints: BoxConstraints(maxHeight: size.bar - 20, maxWidth: MediaQuery.sizeOf(context).width / 2),
                    child: BrandWordmark(height: size.wordmark),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),
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

/// Whether the top bar has gone up after a scroll to [y], given where the
/// last turn began: down past the bar's own height it goes, back up it
/// comes, and at the top it is always there (client_web's bar is the top of
/// the page it is on). A finger's jitter ([tuckSlack]) moves nothing.
({bool hidden, double from}) topBarAt(double y, double bar, double from, bool hidden) {
  if (y <= bar) return (hidden: false, from: y);
  // The anchor follows the scroll in the way the bar already agrees with
  if (hidden ? y > from : y < from) return (hidden: hidden, from: y);
  if ((y - from).abs() < tuckSlack) return (hidden: hidden, from: from);
  return (hidden: !hidden, from: y);
}

/// The top bar gone up while the customer reads on. One flag for the app,
/// so a page that knows better (the deck past its first card) can set it.
class TopBarHidden extends Notifier<bool> {
  @override
  bool build() => false;

  void set(bool hidden) {
    if (state != hidden) state = hidden;
  }
}

final topBarHiddenProvider = NotifierProvider<TopBarHidden, bool>(TopBarHidden.new);

/// Sends the top bar up as the page under it scrolls down and brings it
/// back on the way up, from the page's own scroll notifications, so every
/// tab gets it without doing anything. On the deck (a card a page) it goes
/// up past the first card and comes back on it, as the web's does.
/// [enabled] off leaves it where it is (an open order).
class TopBarOnScroll extends ConsumerStatefulWidget {
  final Widget child;
  final bool enabled;

  const TopBarOnScroll({super.key, required this.child, this.enabled = true});

  @override
  ConsumerState<TopBarOnScroll> createState() => _TopBarOnScrollState();
}

class _TopBarOnScrollState extends ConsumerState<TopBarOnScroll> {
  double _from = 0;
  DateTime _quietUntil = DateTime.fromMillisecondsSinceEpoch(0);

  bool _onScroll(ScrollNotification n) {
    if (!widget.enabled || n.metrics.axis != Axis.vertical || n is! ScrollUpdateNotification) return false;
    final y = n.metrics.pixels;
    final hidden = ref.read(topBarHiddenProvider);
    // The bar going or coming moves the page under it; that scroll is not the customer's
    if (DateTime.now().isBefore(_quietUntil)) {
      _from = y;
      return false;
    }
    final metrics = n.metrics;
    final next = metrics is PageMetrics
        // A card a page: up past the first one, back on it
        ? (hidden: (metrics.page ?? 0) > 0.5, from: y)
        : topBarAt(y, topBarSize(ref.read(brandProvider).theme.headerSize).bar, _from, hidden);
    _from = next.from;
    if (next.hidden != hidden) {
      _quietUntil = DateTime.now().add(tuckSettle);
      ref.read(topBarHiddenProvider.notifier).set(next.hidden);
    }
    return false;
  }

  @override
  Widget build(BuildContext context) => NotificationListener<ScrollNotification>(onNotification: _onScroll, child: widget.child);
}

/// The top bar in its place over the page: going up, it takes the page's top
/// edge with it, so the page reads on into the room it leaves
class TopBarSlot extends ConsumerWidget {
  const TopBarSlot({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final hidden = ref.watch(topBarHiddenProvider);
    return ClipRect(
      child: AnimatedAlign(
        alignment: Alignment.bottomCenter,
        heightFactor: hidden ? 0 : 1,
        duration: reduceMotion(context) ? Duration.zero : tuckSettle,
        curve: Curves.easeOut,
        child: IgnorePointer(ignoring: hidden, child: const NinjaTopBar()),
      ),
    );
  }
}

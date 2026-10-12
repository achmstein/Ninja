import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme_provider.dart';
import '../../../core/ui/ui.dart';
import '../../../l10n/app_localizations.dart';

/// Two bills or more, one at a time (client_web's open-bills.tsx `Swipe`):
/// a finger swipes between them, and a line over them says how many there
/// are and which is in view (Bill 1 of 2), with steps to the one before and
/// the next. The bill in view takes the whole width; the others stay out of
/// sight. The row is as tall as the bill in view, not the tallest one, and
/// eases to the next one's height as it comes in.
class BillSwipe extends StatefulWidget {
  final List<Widget> children;

  const BillSwipe({super.key, required this.children});

  @override
  State<BillSwipe> createState() => _BillSwipeState();
}

class _BillSwipeState extends State<BillSwipe> {
  int _index = 0;

  /// Which way the last step went, for the side the next bill comes in from
  int _step = 1;

  void _go(int to) {
    if (to < 0 || to >= widget.children.length || to == _index) return;
    setState(() {
      _step = to > _index ? 1 : -1;
      _index = to;
    });
  }

  @override
  Widget build(BuildContext context) {
    final cards = widget.children;
    if (cards.length < 2) return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: cards);
    final index = _index.clamp(0, cards.length - 1);
    final theme = context.theme;
    final c = theme.colors;
    final l10n = AppLocalizations.of(context)!;
    final rtl = Directionality.of(context) == TextDirection.rtl;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // How many bills, which one is in view, and the steps between them: over the bill, so it is seen
        // before a long receipt pushes anything under it out of sight
        Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Row(
            children: [
              for (var i = 0; i < cards.length; i++)
                GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () => _go(i),
                  child: Padding(
                    padding: const EdgeInsetsDirectional.only(end: 6, top: 6, bottom: 6),
                    child: AnimatedContainer(
                      duration: Motion.base,
                      width: i == index ? 16 : 6,
                      height: 6,
                      decoration: BoxDecoration(
                        color: c.foreground.withValues(alpha: i == index ? 1 : 0.25),
                        borderRadius: BorderRadius.circular(3),
                      ),
                    ),
                  ),
                ),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  l10n.billOfCount(index + 1, cards.length),
                  style: context.localeText(theme.typography.caption.copyWith(fontWeight: FontWeight.w600, color: c.mutedForeground)),
                ),
              ),
              _StepButton(icon: LucideIcons.chevronLeft, label: l10n.billPrev, onTap: index > 0 ? () => _go(index - 1) : null),
              const SizedBox(width: 6),
              _StepButton(icon: LucideIcons.chevronRight, label: l10n.billNext, onTap: index < cards.length - 1 ? () => _go(index + 1) : null),
            ],
          ),
        ),
        GestureDetector(
          // A swipe towards the start brings the next bill in, as a scroll would
          onHorizontalDragEnd: (details) {
            final v = details.primaryVelocity ?? 0;
            if (v.abs() < 200) return;
            final forward = rtl ? v > 0 : v < 0;
            _go(index + (forward ? 1 : -1));
          },
          child: ClipRect(
            child: AnimatedSize(
              duration: Motion.slow,
              curve: Motion.enter,
              alignment: Alignment.topCenter,
              child: AnimatedSwitcher(
                duration: Motion.slow,
                switchInCurve: Motion.enter,
                switchOutCurve: Motion.exit,
                layoutBuilder: (current, previous) => Stack(alignment: Alignment.topCenter, children: [...previous, ?current]),
                transitionBuilder: (child, animation) {
                  final incoming = child.key == ValueKey(index);
                  final dx = (incoming ? 1.0 : -1.0) * _step * (rtl ? -1 : 1);
                  return FadeTransition(
                    opacity: animation,
                    child: SlideTransition(
                      position: Tween(begin: Offset(dx * 0.3, 0), end: Offset.zero).animate(animation),
                      child: child,
                    ),
                  );
                },
                child: KeyedSubtree(key: ValueKey(index), child: cards[index]),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// A step to the bill before or the next, faded where there is none that way. The chevrons turn with the
/// reading direction
class _StepButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  const _StepButton({required this.icon, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = context.theme.colors;
    return Semantics(
      button: true,
      enabled: onTap != null,
      label: label,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: AnimatedOpacity(
          duration: Motion.base,
          opacity: onTap == null ? 0.3 : 1,
          child: Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(color: c.foreground.withValues(alpha: 0.08), shape: BoxShape.circle),
            child: Directionality.of(context) == TextDirection.rtl
                ? Transform.flip(flipX: true, child: Icon(icon, size: 16, color: c.foreground))
                : Icon(icon, size: 16, color: c.foreground),
          ),
        ),
      ),
    );
  }
}

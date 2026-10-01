import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../l10n/app_localizations.dart';
import '../brand/brand_style.dart';
import '../motion/motion.dart';
import '../theme/ninja_theme.dart';
import '../theme/theme_provider.dart';
import 'ninja_button.dart';

/// How far the page scrolls before its large title has faded away
const _titleFold = 44.0;

/// A page in the Ninja style (client_web's components/ninja/page/page.tsx):
/// a large title, which shrinks and fades as the page scrolls, then its
/// blocks, which rise into place one after another as the page opens. A
/// tab's page sits under the app's top bar; a page pushed over a tab
/// ([back]) has a slim bar of its own with the way back. [onRefresh] pulls
/// the page down to load it again.
class NinjaPage extends StatefulWidget {
  final String title;
  final Widget? subtitle;

  /// Beside the large title, at its end
  final Widget? action;

  /// Pushed over a tab: a way back, to where it came from (or [backTo] when opened fresh)
  final bool back;
  final String backTo;
  final RefreshCallback? onRefresh;
  final List<Widget> children;

  /// The gap between the blocks
  final double gap;

  /// The page's scroll, for a page that moves it itself (back to the top)
  final ScrollController? controller;

  const NinjaPage({
    super.key,
    required this.title,
    this.subtitle,
    this.action,
    this.back = false,
    this.backTo = '/profile',
    this.onRefresh,
    this.gap = Ninja.sectionGap,
    this.controller,
    required this.children,
  });

  @override
  State<NinjaPage> createState() => _NinjaPageState();
}

class _NinjaPageState extends State<NinjaPage> {
  final _own = ScrollController();
  ScrollController get _scroll => widget.controller ?? _own;

  @override
  void dispose() {
    _own.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.theme.colors;
    final bottom = MediaQuery.paddingOf(context).bottom;
    Widget list = ListView(
      controller: _scroll,
      physics: const AlwaysScrollableScrollPhysics(),
      // The page's room at its end: the dock over it on a tab, the phone's own edge on a pushed page
      padding: EdgeInsets.fromLTRB(Ninja.pagePadding, 12, Ninja.pagePadding, 24 + bottom),
      children: [
        PageTitle(title: widget.title, subtitle: widget.subtitle, action: widget.action, scroll: _scroll),
        SizedBox(height: widget.gap),
        RiseGroup(gap: widget.gap, children: widget.children),
      ],
    );
    if (widget.onRefresh != null) {
      list = RefreshIndicator(color: c.foreground, backgroundColor: c.background, onRefresh: widget.onRefresh!, child: list);
    }
    if (!widget.back) return list;

    // Pushed: a slim bar with the way back, where a tab has the app's top bar
    final l10n = AppLocalizations.of(context)!;
    final rtl = Directionality.of(context) == TextDirection.rtl;
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            SizedBox(
              height: 64,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: NinjaIconButton(
                    semanticLabel: l10n.back,
                    onPress: () => context.canPop() ? context.pop() : context.go(widget.backTo),
                    child: Icon(rtl ? LucideIcons.arrowRight : LucideIcons.arrowLeft),
                  ),
                ),
              ),
            ),
            Expanded(
              child: MediaQuery(
                data: MediaQuery.of(context).copyWith(padding: MediaQuery.paddingOf(context).copyWith(bottom: MediaQuery.viewPaddingOf(context).bottom)),
                child: list,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A page's large title (and the line under it): it shrinks and fades as
/// [scroll] runs past it; a new title swaps in with a short blur
class PageTitle extends StatelessWidget {
  final String title;
  final Widget? subtitle;
  final Widget? action;
  final ScrollController? scroll;

  const PageTitle({super.key, required this.title, this.subtitle, this.action, this.scroll});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final c = theme.colors;
    final rtl = Directionality.of(context) == TextDirection.rtl;
    final head = Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              BlurSwap(
                child: BrandHeading(title, key: ValueKey(title), style: theme.typography.title.copyWith(color: c.foreground)),
              ),
              if (subtitle != null)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: DefaultTextStyle.merge(
                    style: context.localeText(theme.typography.body.copyWith(color: c.mutedForeground)),
                    child: subtitle!,
                  ),
                ),
            ],
          ),
        ),
        if (action != null) ...[const SizedBox(width: 12), action!],
      ],
    );
    if (scroll == null) return head;
    return AnimatedBuilder(
      animation: scroll!,
      child: head,
      builder: (context, child) {
        final y = scroll!.hasClients ? scroll!.offset.clamp(0.0, _titleFold) : 0.0;
        final t = y / _titleFold;
        return Opacity(
          opacity: 1 - t,
          child: Transform.scale(
            scale: 1 - 0.08 * t,
            alignment: rtl ? Alignment.centerRight : Alignment.centerLeft,
            child: child,
          ),
        );
      },
    );
  }
}

/// Blocks that rise into place one after another when the page opens
/// (the web's Rise / RiseItem): each from 14 px down, 45 ms after the one before
class RiseGroup extends StatefulWidget {
  final List<Widget> children;
  final double gap;

  const RiseGroup({super.key, required this.children, this.gap = Ninja.sectionGap});

  @override
  State<RiseGroup> createState() => _RiseGroupState();
}

class _RiseGroupState extends State<RiseGroup> with SingleTickerProviderStateMixin {
  static const _stagger = 45;
  static const _each = 350;
  late final AnimationController _c;

  @override
  void initState() {
    super.initState();
    final total = _each + _stagger * (widget.children.length.clamp(1, 12) - 1);
    _c = AnimationController(vsync: this, duration: Duration(milliseconds: total));
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (reduceMotion(context)) {
      _c.value = 1;
    } else if (_c.value == 0 && !_c.isAnimating) {
      _c.forward();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final total = _c.duration!.inMilliseconds;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final (i, child) in widget.children.indexed) ...[
          if (i > 0) SizedBox(height: widget.gap),
          AnimatedBuilder(
            animation: _c,
            child: child,
            builder: (context, child) {
              final start = (i.clamp(0, 11) * _stagger) / total;
              final end = (i.clamp(0, 11) * _stagger + _each) / total;
              final t = Motion.enter.transform(((_c.value - start) / (end - start)).clamp(0.0, 1.0));
              return Opacity(opacity: t, child: Transform.translate(offset: Offset(0, 14 * (1 - t)), child: child));
            },
          ),
        ],
      ],
    );
  }
}

/// Points as a ring (client_web's points-ring.tsx): the balance in the
/// middle, rolling, and the ring drawn round as far as the member has come
/// towards the next tier. The ring draws once, when it arrives.
class PointsRing extends StatefulWidget {
  final int points;

  /// 0 to 1
  final double progress;
  final String label;
  final double size;

  const PointsRing({super.key, required this.points, required this.progress, required this.label, this.size = 104});

  @override
  State<PointsRing> createState() => _PointsRingState();
}

class _PointsRingState extends State<PointsRing> with SingleTickerProviderStateMixin {
  // A slow, soft spring, after a beat
  static final _draw = SpringCurve(const SpringDescription(mass: 1, stiffness: 60, damping: 18));
  late final AnimationController _c = AnimationController(vsync: this, duration: _draw.duration);
  double _from = 0;

  @override
  void initState() {
    super.initState();
    Future<void>.delayed(const Duration(milliseconds: 150), () {
      if (mounted) _c.forward();
    });
  }

  @override
  void didUpdateWidget(PointsRing old) {
    super.didUpdateWidget(old);
    if (old.progress != widget.progress) {
      _from = _shown;
      _c.forward(from: 0);
    }
  }

  double get _target => widget.progress.clamp(0.02, 1.0);
  double get _shown => reduceMotion(context) ? _target : _from + (_target - _from) * _draw.transform(_c.value);

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ink = DefaultTextStyle.of(context).style.color ?? context.theme.colors.foreground;
    final theme = context.theme;
    return SizedBox.square(
      dimension: widget.size,
      child: AnimatedBuilder(
        animation: _c,
        builder: (context, child) => CustomPaint(painter: _RingPainter(progress: _shown, track: ink.withValues(alpha: 0.14)), child: child),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              RollingNumber(
                '${widget.points}',
                value: widget.points.toDouble(),
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: ink, height: 1),
              ),
              const SizedBox(height: 4),
              Text(
                widget.label,
                style: context.localeText(theme.typography.micro.copyWith(fontWeight: FontWeight.w600, color: ink.withValues(alpha: 0.6), height: 1)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The amber of points: the ring, the tier chip
const pointsAmber = NinjaColors.warning;

class _RingPainter extends CustomPainter {
  final double progress;
  final Color track;

  _RingPainter({required this.progress, required this.track});

  @override
  void paint(Canvas canvas, Size size) {
    const stroke = 8.0;
    final rect = Rect.fromCircle(center: size.center(Offset.zero), radius: (size.width - stroke) / 2);
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round;
    canvas.drawArc(rect, 0, 6.2832, false, paint..color = track);
    canvas.drawArc(rect, -1.5708, 6.2832 * progress, false, paint..color = pointsAmber);
  }

  @override
  bool shouldRepaint(_RingPainter old) => old.progress != progress || old.track != track;
}

import 'package:flutter/material.dart';
import 'package:flutter/physics.dart';
import '../motion/motion.dart';
import '../theme/ninja_theme.dart';
import '../theme/theme_provider.dart';

/// Chips that scroll sideways, the active one sitting in a pill whose two
/// edges move on different springs (client_web's LiquidTabs): the menu's
/// categories, in the thumb's reach above the dock. The active chip is
/// scrolled into the middle, and while more chips wait past the end the row
/// fades out before [trailing] rather than running under it.
class LiquidChips extends StatefulWidget {
  final List<String> labels;
  final int active;
  final ValueChanged<int> onSelect;

  /// A round button after the row
  final Widget? trailing;

  const LiquidChips({super.key, required this.labels, required this.active, required this.onSelect, this.trailing});

  @override
  State<LiquidChips> createState() => _LiquidChipsState();
}

class _LiquidChipsState extends State<LiquidChips> with TickerProviderStateMixin {
  static const _pillHeight = 36.0;

  final _scroll = ScrollController();
  final _row = GlobalKey();
  List<GlobalKey> _chips = [];

  // The pill's edges, in pixels from the row's left
  late final AnimationController _left = AnimationController.unbounded(vsync: this);
  late final AnimationController _right = AnimationController.unbounded(vsync: this);
  bool _placed = false;
  bool _more = false;

  @override
  void initState() {
    super.initState();
    _syncKeys();
    _scroll.addListener(_measureMore);
    WidgetsBinding.instance.addPostFrameCallback((_) => _follow(jump: true));
  }

  @override
  void didUpdateWidget(LiquidChips old) {
    super.didUpdateWidget(old);
    if (old.labels.length != widget.labels.length) {
      _syncKeys();
      _placed = false;
    }
    if (old.active != widget.active || !_placed || old.labels.length != widget.labels.length) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _follow(jump: !_placed));
    }
  }

  void _syncKeys() => _chips = [for (final _ in widget.labels) GlobalKey()];

  @override
  void dispose() {
    _scroll.dispose();
    _left.dispose();
    _right.dispose();
    super.dispose();
  }

  void _measureMore() {
    if (!_scroll.hasClients) return;
    final p = _scroll.position;
    final more = p.pixels < p.maxScrollExtent - 2;
    if (more != _more) setState(() => _more = more);
  }

  /// The pill to the active chip, and the chip into view
  void _follow({required bool jump}) {
    if (!mounted || widget.active < 0 || widget.active >= _chips.length) return;
    final chip = _chips[widget.active].currentContext?.findRenderObject() as RenderBox?;
    final row = _row.currentContext?.findRenderObject() as RenderBox?;
    if (chip == null || row == null || !chip.hasSize) return;
    final left = chip.localToGlobal(Offset.zero, ancestor: row).dx;
    final right = left + chip.size.width;
    _measureMore();
    if (jump || reduceMotion(context)) {
      _left.value = left;
      _right.value = right;
      _placed = true;
    } else {
      // Moving right, the right edge leads; moving left, the left one
      final rightward = left > _left.value;
      _spring(_left, left, rightward ? Motion.pillTrail : Motion.pillLead);
      _spring(_right, right, rightward ? Motion.pillLead : Motion.pillTrail);
    }
    Scrollable.ensureVisible(
      _chips[widget.active].currentContext!,
      alignment: 0.5,
      duration: jump || reduceMotion(context) ? Duration.zero : Motion.slow,
      curve: Motion.move,
    );
  }

  void _spring(AnimationController edge, double to, SpringDescription spring) =>
      edge.animateWith(SpringSimulation(spring, edge.value, to, edge.velocity, tolerance: Motion.pixelTolerance));

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final c = theme.colors;
    final rtl = Directionality.of(context) == TextDirection.rtl;

    final row = SingleChildScrollView(
      controller: _scroll,
      scrollDirection: Axis.horizontal,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Stack(
          key: _row,
          children: [
            if (_placed)
              AnimatedBuilder(
                animation: Listenable.merge([_left, _right]),
                builder: (context, _) => Positioned(
                  left: _left.value,
                  width: (_right.value - _left.value).clamp(0.0, double.infinity),
                  top: 0,
                  height: _pillHeight,
                  child: DecoratedBox(
                    decoration: ShapeDecoration(color: c.primary, shape: const StadiumBorder()),
                  ),
                ),
              ),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                for (final (i, label) in widget.labels.indexed)
                  Semantics(
                    key: _chips[i],
                    selected: i == widget.active,
                    button: true,
                    child: GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: () => widget.onSelect(i),
                      child: Container(
                        height: _pillHeight,
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        alignment: Alignment.center,
                        child: AnimatedDefaultTextStyle(
                          duration: const Duration(milliseconds: 200),
                          style: context.localeText(
                            theme.typography.note.copyWith(
                              fontWeight: FontWeight.w600,
                              color: i == widget.active && _placed ? c.primaryForeground : c.mutedForeground,
                            ),
                          ),
                          child: Text(label, maxLines: 1),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );

    return Row(
      children: [
        const SizedBox(width: 8),
        Expanded(
          // The fade at the end while there are more chips past it. Always the same mask, faded or not:
          // moved in and out of it, the row was built afresh and lost its scroll (back to the first chips
          // whenever it reached its end, as following the last categories does)
          child: ShaderMask(
            blendMode: BlendMode.dstIn,
            shaderCallback: (bounds) => LinearGradient(
              begin: rtl ? Alignment.centerRight : Alignment.centerLeft,
              end: rtl ? Alignment.centerLeft : Alignment.centerRight,
              colors: [Colors.black, Colors.black, _more ? Colors.transparent : Colors.black],
              stops: [0, 1 - 28 / bounds.width.clamp(28, double.infinity), 1],
            ).createShader(bounds),
            child: row,
          ),
        ),
        if (widget.trailing != null) ...[const SizedBox(width: 4), widget.trailing!, const SizedBox(width: 4)],
      ],
    );
  }
}

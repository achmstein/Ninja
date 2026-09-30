import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../motion/motion.dart';
import '../theme/ninja_theme.dart';
import '../theme/theme_provider.dart';
import 'liquid_pill.dart';
import 'pressable.dart';

// The page's building blocks, as client_web draws them
// (components/ninja/page/parts.tsx, tile-row.tsx, notice.tsx, ui/*).

/// The dark slab the dock is made of, for the one thing a page is about
/// (the bill running now, who you are). Set in the slab's own inks.
class SlabCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;

  const SlabCard({super.key, required this.child, this.padding = const EdgeInsets.all(20)});

  @override
  Widget build(BuildContext context) {
    final c = context.theme.colors;
    return Container(
      padding: padding,
      decoration: BoxDecoration(color: c.slab, borderRadius: BorderRadius.circular(Ninja.cardRadius), boxShadow: Ninja.slabShadow),
      child: SlabInk(child: child),
    );
  }
}

/// [child] in the slab's inks: its text the slab's ink, muted text and
/// fills re-tinted from it, as the web's `slab` utility swaps the page's two
/// inks for the slab's
class SlabInk extends StatelessWidget {
  final Widget child;

  const SlabInk({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final c = theme.colors;
    final ink = c.slabInk;
    final colors = c.copyWith(
      background: c.slab,
      foreground: ink,
      card: c.slab,
      muted: Color.lerp(c.slab, ink, 0.10),
      mutedForeground: Color.lerp(c.slab, ink, 0.60),
      border: Color.lerp(c.slab, ink, 0.16),
    );
    final material = Theme.of(context);
    return Theme(
      data: material.copyWith(extensions: [...material.extensions.values.where((e) => e is! NinjaTheme), theme.copyWith(colors: colors)]),
      child: DefaultTextStyle.merge(style: TextStyle(color: ink), child: IconTheme.merge(data: IconThemeData(color: ink), child: child)),
    );
  }
}

/// A filled card at the slab's corners, for everything else: flat, muted
class Panel extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;

  const Panel({super.key, required this.child, this.padding = const EdgeInsets.all(16)});

  @override
  Widget build(BuildContext context) => Container(
        padding: padding,
        decoration: BoxDecoration(color: context.theme.colors.muted, borderRadius: BorderRadius.circular(Ninja.panelRadius)),
        child: child,
      );
}

/// A small label over a group of panels or tiles
class SectionLabel extends StatelessWidget {
  final String text;

  const SectionLabel(this.text, {super.key});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    return Padding(
      padding: const EdgeInsetsDirectional.only(start: 4, bottom: 8),
      child: Text(
        text,
        style: context.localeText(theme.typography.caption.copyWith(color: theme.colors.mutedForeground, fontWeight: FontWeight.w600)),
      ),
    );
  }
}

/// Two or three choices in one track, the chosen one lifted by the liquid pill
class Segment<T> extends StatelessWidget {
  final List<({T value, Widget label})> options;
  final T value;
  final ValueChanged<T> onChange;

  /// The small one that sits at the end of a tile
  final bool compact;

  const Segment({super.key, required this.options, required this.value, required this.onChange, this.compact = false});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final c = theme.colors;
    final active = options.indexWhere((o) => o.value == value).clamp(0, options.length - 1);
    return Container(
      height: compact ? 36 : 44,
      padding: const EdgeInsets.all(4),
      decoration: ShapeDecoration(color: c.muted, shape: const StadiumBorder()),
      child: LiquidSlots(
        count: options.length,
        active: active,
        pillHeight: compact ? 28 : 36,
        pill: ShapeDecoration(
          color: c.background,
          shape: const StadiumBorder(),
          shadows: const [BoxShadow(color: Color(0x1F000000), offset: Offset(0, 1), blurRadius: 3)],
        ),
        builder: (context, i, on) => Pressable(
          onTap: () => onChange(options[i].value),
          scale: 0.96,
          child: Center(
            child: AnimatedDefaultTextStyle(
              duration: Motion.base,
              style: context.localeText((compact ? theme.typography.caption : theme.typography.note)
                  .copyWith(fontWeight: FontWeight.w600, color: on ? c.foreground : c.mutedForeground)),
              child: IconTheme.merge(
                data: IconThemeData(size: 16, color: on ? c.foreground : c.mutedForeground),
                child: Padding(padding: EdgeInsets.symmetric(horizontal: compact ? 10 : 12), child: options[i].label),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// A page split in two or three, switched by a [Segment] over it
class NinjaTabs extends StatefulWidget {
  final List<({Widget label, Widget child})> tabs;
  final int initial;
  final EdgeInsetsGeometry padding;

  const NinjaTabs({super.key, required this.tabs, this.initial = 0, this.padding = const EdgeInsets.fromLTRB(16, 4, 16, 12)});

  @override
  State<NinjaTabs> createState() => _NinjaTabsState();
}

class _NinjaTabsState extends State<NinjaTabs> {
  late int _index = widget.initial;

  @override
  Widget build(BuildContext context) => Column(
        children: [
          Padding(
            padding: widget.padding,
            child: Segment<int>(
              options: [for (final (i, tab) in widget.tabs.indexed) (value: i, label: tab.label)],
              value: _index,
              onChange: (i) => setState(() => _index = i),
            ),
          ),
          Expanded(child: IndexedStack(index: _index, children: [for (final tab in widget.tabs) tab.child])),
        ],
      );
}

/// Rows straight on the page: no fill and no shadow, a hairline between
/// them from the label, not under the icon
class TileGroup extends StatelessWidget {
  final List<Widget> children;

  const TileGroup({super.key, required this.children});

  @override
  Widget build(BuildContext context) {
    final line = context.theme.colors.border.withValues(alpha: 0.6);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final (i, child) in children.indexed)
          if (i == 0)
            child
          else
            DecoratedBox(
              position: DecorationPosition.foreground,
              decoration: _Hairline(line),
              child: child,
            ),
      ],
    );
  }
}

class _Hairline extends Decoration {
  final Color color;

  const _Hairline(this.color);

  @override
  BoxPainter createBoxPainter([VoidCallback? onChanged]) => _HairlinePainter(color);
}

class _HairlinePainter extends BoxPainter {
  final Color color;

  _HairlinePainter(this.color);

  @override
  void paint(Canvas canvas, Offset offset, ImageConfiguration configuration) {
    final size = configuration.size!;
    final rtl = configuration.textDirection == TextDirection.rtl;
    // From the label (past the 36 px icon and its gap), to 8 px short of the end
    const start = 56.0, end = 8.0;
    final left = offset.dx + (rtl ? end : start);
    final right = offset.dx + size.width - (rtl ? start : end);
    canvas.drawLine(Offset(left, offset.dy), Offset(right, offset.dy), Paint()..color = color..strokeWidth = 1);
  }
}

/// One row of a [TileGroup]: an icon in a soft round, a label (and a line
/// under it), the row's current setting and a chevron, or a [trailing]
/// control in its place. A press shades the row; nothing jumps.
class NinjaTile extends StatefulWidget {
  final IconData? icon;
  final Widget title;
  final Widget? subtitle;

  /// The row's current setting, before the chevron
  final Widget? value;

  /// In place of the chevron: a switch, a segment. Null draws the chevron on a
  /// row that opens something, nothing on one that does not
  final Widget? trailing;
  final VoidCallback? onPress;
  final bool destructive;

  const NinjaTile({
    super.key,
    this.icon,
    required this.title,
    this.subtitle,
    this.value,
    this.trailing,
    this.onPress,
    this.destructive = false,
  });

  @override
  State<NinjaTile> createState() => _NinjaTileState();
}

class _NinjaTileState extends State<NinjaTile> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final c = theme.colors;
    final ink = widget.destructive ? c.destructive : c.foreground;
    final chevron = Icon(
      Directionality.of(context) == TextDirection.rtl ? LucideIcons.chevronLeft : LucideIcons.chevronRight,
      size: 16,
      color: widget.destructive ? c.destructive : c.mutedForeground,
    );
    final row = AnimatedContainer(
      duration: Motion.fast,
      constraints: const BoxConstraints(minHeight: 64),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
      decoration: BoxDecoration(
        color: _down ? c.foreground.withValues(alpha: 0.06) : Colors.transparent,
        borderRadius: BorderRadius.circular(Ninja.tileRadius),
      ),
      child: Row(
        children: [
          if (widget.icon != null) ...[
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: widget.destructive ? c.destructive.withValues(alpha: 0.1) : c.muted,
                shape: BoxShape.circle,
              ),
              child: Icon(widget.icon, size: 18, color: ink),
            ),
            const SizedBox(width: 12),
          ],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                DefaultTextStyle.merge(
                  style: context.localeText(theme.typography.body.copyWith(fontWeight: FontWeight.w600, color: ink)),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  child: widget.title,
                ),
                if (widget.subtitle != null)
                  DefaultTextStyle.merge(
                    style: context.localeText(theme.typography.caption.copyWith(color: c.mutedForeground)),
                    child: widget.subtitle!,
                  ),
              ],
            ),
          ),
          if (widget.value != null) ...[
            const SizedBox(width: 8),
            DefaultTextStyle.merge(
              style: context.localeText(theme.typography.caption.copyWith(color: c.mutedForeground)),
              child: widget.value!,
            ),
          ],
          if (widget.trailing != null) ...[
            const SizedBox(width: 8),
            widget.trailing!,
          ] else if (widget.onPress != null) ...[
            const SizedBox(width: 8),
            chevron,
          ],
        ],
      ),
    );
    if (widget.onPress == null) return row;
    return Semantics(
      button: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: widget.onPress,
        onTapDown: (_) => setState(() => _down = true),
        onTapUp: (_) => setState(() => _down = false),
        onTapCancel: () => setState(() => _down = false),
        child: row,
      ),
    );
  }
}

/// primary: the brand's fill; secondary: the accent's; outline: a hairline;
/// destructive: red
enum NinjaBadgeVariant { primary, secondary, outline, destructive }

/// A small label on a thing: its state, a tag
class NinjaBadge extends StatelessWidget {
  final Widget child;
  final NinjaBadgeVariant variant;

  const NinjaBadge({super.key, required this.child, this.variant = NinjaBadgeVariant.primary});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final c = theme.colors;
    final (fill, ink, line) = switch (variant) {
      NinjaBadgeVariant.primary => (c.primary, c.primaryForeground, null),
      NinjaBadgeVariant.secondary => (c.secondary, c.secondaryForeground, null),
      NinjaBadgeVariant.outline => (Colors.transparent, c.foreground, c.border),
      NinjaBadgeVariant.destructive => (c.destructive, c.destructiveForeground, null),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: ShapeDecoration(
        color: fill,
        shape: StadiumBorder(side: line == null ? BorderSide.none : BorderSide(color: line)),
      ),
      child: DefaultTextStyle.merge(
        style: context.localeText(theme.typography.caption.copyWith(color: ink, fontWeight: FontWeight.w500)),
        maxLines: 1,
        child: IconTheme.merge(data: IconThemeData(size: 12, color: ink), child: child),
      ),
    );
  }
}

/// A word to the customer: an icon in a soft round, a title and a line
/// under it. destructive says something went wrong; plain says it went well
enum NinjaAlertVariant { plain, destructive }

class NinjaAlert extends StatelessWidget {
  final Widget? icon;
  final Widget title;
  final Widget? subtitle;
  final NinjaAlertVariant variant;

  const NinjaAlert({super.key, this.icon, required this.title, this.subtitle, this.variant = NinjaAlertVariant.plain});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final c = theme.colors;
    final bad = variant == NinjaAlertVariant.destructive;
    final tint = bad ? c.destructive : c.primary;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: tint.withValues(alpha: 0.10), borderRadius: BorderRadius.circular(Ninja.panelRadius)),
      child: Row(
        children: [
          if (icon != null) ...[
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(color: tint.withValues(alpha: 0.16), shape: BoxShape.circle),
              child: IconTheme.merge(data: IconThemeData(size: 20, color: tint), child: icon!),
            ),
            const SizedBox(width: 12),
          ],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                DefaultTextStyle.merge(
                  style: context.localeText(theme.typography.body.copyWith(fontWeight: FontWeight.w600, color: bad ? c.destructive : c.foreground)),
                  child: title,
                ),
                if (subtitle != null)
                  DefaultTextStyle.merge(
                    style: context.localeText(theme.typography.caption.copyWith(color: c.foreground.withValues(alpha: 0.75))),
                    child: subtitle!,
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// On or off: the brand's fill when on, the input's when off
class NinjaSwitch extends StatelessWidget {
  final bool value;
  final ValueChanged<bool>? onChange;

  const NinjaSwitch({super.key, required this.value, this.onChange});

  @override
  Widget build(BuildContext context) {
    final c = context.theme.colors;
    final on = value;
    return Semantics(
      toggled: on,
      enabled: onChange != null,
      child: GestureDetector(
        onTap: onChange == null ? null : () => onChange!(!on),
        child: AnimatedOpacity(
          opacity: onChange == null ? 0.5 : 1,
          duration: Motion.fast,
          child: AnimatedContainer(
            duration: Motion.base,
            curve: Motion.enter,
            width: 44,
            height: 26,
            padding: const EdgeInsets.all(3),
            decoration: ShapeDecoration(color: on ? c.primary : c.input, shape: const StadiumBorder()),
            child: AnimatedAlign(
              duration: Motion.base,
              curve: Motion.enter,
              alignment: on ? AlignmentDirectional.centerEnd : AlignmentDirectional.centerStart,
              child: Container(
                width: 20,
                height: 20,
                decoration: BoxDecoration(
                  color: on ? c.primaryForeground : (c.brightness == Brightness.dark ? c.foreground : c.background),
                  shape: BoxShape.circle,
                  boxShadow: const [BoxShadow(color: Color(0x26000000), blurRadius: 2, offset: Offset(0, 1))],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// A person's initial in a round
class NinjaAvatar extends StatelessWidget {
  final double size;
  final Widget child;

  const NinjaAvatar({super.key, this.size = 40, required this.child});

  @override
  Widget build(BuildContext context) {
    final c = context.theme.colors;
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(color: c.muted, shape: BoxShape.circle),
      child: DefaultTextStyle.merge(style: TextStyle(color: c.foreground, fontWeight: FontWeight.w700), child: child),
    );
  }
}

/// Nothing here yet: a glyph that floats a little in its tile, what is
/// missing in a line, and the way on
class EmptyState extends StatefulWidget {
  final IconData icon;
  final String title;
  final String? note;
  final Widget? action;

  const EmptyState({super.key, required this.icon, required this.title, this.note, this.action});

  @override
  State<EmptyState> createState() => _EmptyStateState();
}

class _EmptyStateState extends State<EmptyState> with SingleTickerProviderStateMixin {
  late final AnimationController _float = AnimationController(vsync: this, duration: const Duration(milliseconds: 3200));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (reduceMotion(context)) {
      _float.stop();
    } else if (!_float.isAnimating) {
      _float.repeat();
    }
  }

  @override
  void dispose() {
    _float.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final c = theme.colors;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 48),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          AnimatedBuilder(
            animation: _float,
            builder: (context, child) => Transform.translate(
              offset: Offset(0, -5 * Curves.easeInOut.transform(1 - (2 * _float.value - 1).abs())),
              child: child,
            ),
            child: Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(color: c.muted, borderRadius: BorderRadius.circular(Ninja.cardRadius)),
              child: Icon(widget.icon, size: 36, color: c.mutedForeground),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            widget.title,
            textAlign: TextAlign.center,
            style: context.localeText(theme.typography.headline.copyWith(fontWeight: FontWeight.w800, color: c.foreground)),
          ),
          if (widget.note != null) ...[
            const SizedBox(height: 4),
            Text(
              widget.note!,
              textAlign: TextAlign.center,
              style: context.localeText(theme.typography.body.copyWith(color: c.mutedForeground)),
            ),
          ],
          if (widget.action != null) ...[const SizedBox(height: 16), widget.action!],
        ],
      ),
    );
  }
}

import 'dart:async';
import 'dart:math' as math;
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/gestures.dart' show PointerDeviceKind, kLongPressTimeout;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/brand/brand_style.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme_provider.dart';
import '../../../core/ui/ui.dart';
import '../../../core/utils/money.dart';
import '../../../l10n/app_localizations.dart';
import '../models/menu_item.dart';
import '../paired_items.dart';
import 'dish.dart';
import 'dish_view.dart';
import 'zoom_flight.dart';

/// The colour a card without a photo is painted in, round and round the categories
enum PosterTone { primary, secondary, deep }

PosterTone posterTone(int index) => PosterTone.values[index % PosterTone.values.length];

/// One column of the deck: the customer's usuals, or a category
class DeckColumn {
  final String id;
  final String label;
  final bool usuals;
  final PosterTone tone;
  final List<MenuItem> items;

  const DeckColumn({required this.id, required this.label, required this.usuals, required this.tone, required this.items});
}

/// The deck's columns (client_web's deck-model.ts buildDeck): a returning
/// customer's usuals lead as a column of their own, then each category
List<DeckColumn> buildDeck({required String usualsLabel, required List<MenuItem> usuals, required List<({String label, List<MenuItem> items})> categories}) {
  final available = usuals.where((i) => i.isAvailable).toList();
  return [
    if (available.isNotEmpty) DeckColumn(id: 'usuals', label: usualsLabel, usuals: true, tone: PosterTone.primary, items: available),
    for (final (i, c) in categories.indexed) DeckColumn(id: 'c$i', label: c.label, usuals: false, tone: posterTone(i), items: c.items),
  ];
}

(Color, Color) _toneColors(NinjaColors c, PosterTone tone) => switch (tone) {
  PosterTone.primary => (c.primary, c.primaryForeground),
  PosterTone.secondary => (c.secondary, c.secondaryForeground),
  PosterTone.deep => (c.slab, c.slabInk),
};

/// A card's corner in the deck
const cardRadius = 28.0;

/// How much of the next card shows under the one in view
const _peek = 44.0;

/// The gap over each card, and the room at the top of a column
const _gap = 12.0;

/// How long the deck rests on the "up next" card before it moves on
const _advanceAfter = Duration(milliseconds: 60);

/// The deck (client_web's deck/deck.tsx): one column of big cards per
/// category, side by side; up and down within a category, sideways between
/// them, each a snap. In Arabic the columns run right to left. Resting on a
/// column's last card, "up next", carries on into the next category, and
/// the column left behind goes back to its last dish.
class Deck extends StatefulWidget {
  final List<DeckColumn> columns;
  final int column;
  final ValueChanged<int> onColumnChange;

  /// The card each column opens on (a column not in it, its first); read as a column comes into view
  final Map<int, int> rows;

  /// A column came to rest on a card (the "up next" counts as its last dish)
  final void Function(int column, int row)? onRowChange;

  /// The card that carries the one-time "hold to add" cue, if any
  final int? holdHintId;

  /// A card held until it went into the tray
  final ValueChanged<MenuItem>? onQuickAdd;

  const Deck({
    super.key,
    required this.columns,
    required this.column,
    required this.onColumnChange,
    this.rows = const {},
    this.onRowChange,
    this.holdHintId,
    this.onQuickAdd,
  });

  @override
  State<Deck> createState() => _DeckState();
}

class _DeckState extends State<Deck> {
  late final PageController _pager = PageController(initialPage: widget.column);
  late final Map<int, int> _rowAt = {...widget.rows};
  final Map<int, _DeckColumnState> _shown = {};
  bool _steering = false;
  Timer? _advance;
  Timer? _rewind;

  @override
  void didUpdateWidget(Deck old) {
    super.didUpdateWidget(old);
    // A chip picked: glide there, and ignore the page changes that makes
    if (widget.column != old.column && _pager.hasClients && (_pager.page?.round() ?? widget.column) != widget.column) {
      _steering = true;
      final far = ((_pager.page ?? 0) - widget.column).abs() > 1;
      final go = far || reduceMotion(context)
          ? Future<void>.sync(() => _pager.jumpToPage(widget.column))
          : _pager.animateToPage(widget.column, duration: Motion.slow, curve: Motion.move);
      go.whenComplete(() => _steering = false);
    }
  }

  @override
  void dispose() {
    _advance?.cancel();
    _rewind?.cancel();
    _pager.dispose();
    super.dispose();
  }

  /// A column came to rest on a card: told on, and on its "up next", on to the next category
  void _onRow(int column, int row) {
    _advance?.cancel();
    final col = widget.columns[column];
    final dish = math.min(row, col.items.length - 1);
    _rowAt[column] = dish;
    widget.onRowChange?.call(column, dish);
    if (row < col.items.length || column + 1 >= widget.columns.length) return;
    _advance = Timer(_advanceAfter, () {
      widget.onColumnChange(column + 1);
      _rewind = Timer(const Duration(milliseconds: 700), () {
        _rowAt[column] = col.items.length - 1;
        _shown[column]?.jumpTo(col.items.length - 1);
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    // The cards go with a mouse's drag too, as a finger's: a deck is swiped, in a browser as on a phone
    return ScrollConfiguration(
      behavior: ScrollConfiguration.of(context).copyWith(dragDevices: PointerDeviceKind.values.toSet()),
      child: LayoutBuilder(
        builder: (context, box) {
          final height = box.maxHeight;
          final card = height - _gap - _peek;
          return PageView.builder(
            controller: _pager,
            itemCount: widget.columns.length,
            onPageChanged: (page) {
              if (!_steering) widget.onColumnChange(page);
            },
            itemBuilder: (context, c) {
              final col = widget.columns[c];
              final next = c + 1 < widget.columns.length ? widget.columns[c + 1] : null;
              return _DeckColumn(
                key: ValueKey('deck-${col.id}'),
                deck: this,
                index: c,
                height: height,
                count: col.items.length + (next != null ? 1 : 0),
                itemBuilder: (context, row) => Padding(
                  padding: const EdgeInsets.fromLTRB(16, _gap, 16, 0),
                  child: Align(
                    alignment: Alignment.topCenter,
                    child: row < col.items.length
                        ? SizedBox(
                            height: card,
                            child: DeckCard(
                              item: col.items[row],
                              usual: col.usuals && row == 0,
                              hint: col.items[row].id == widget.holdHintId,
                              onQuickAdd: widget.onQuickAdd,
                            ),
                          )
                        : SizedBox(
                            height: card * 0.5,
                            child: _UpNext(column: next!, onGo: () => widget.onColumnChange(c + 1)),
                          ),
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}

/// One column of the deck, snapping card by card with the next one peeking
/// under. Its pages are a share of its height, so a new height (the chrome
/// coming or going) makes them afresh, on the card it was on.
class _DeckColumn extends StatefulWidget {
  final _DeckState deck;
  final int index;
  final double height;
  final int count;
  final IndexedWidgetBuilder itemBuilder;

  const _DeckColumn({super.key, required this.deck, required this.index, required this.height, required this.count, required this.itemBuilder});

  @override
  State<_DeckColumn> createState() => _DeckColumnState();
}

class _DeckColumnState extends State<_DeckColumn> {
  late PageController _rows = _controller(widget.deck._rowAt[widget.index] ?? 0);

  PageController _controller(int row) =>
      PageController(initialPage: row, keepPage: false, viewportFraction: ((widget.height - _peek) / widget.height).clamp(0.5, 1.0));

  @override
  void initState() {
    super.initState();
    widget.deck._shown[widget.index] = this;
  }

  @override
  void didUpdateWidget(_DeckColumn old) {
    super.didUpdateWidget(old);
    if (old.index != widget.index) {
      if (old.deck._shown[old.index] == this) old.deck._shown.remove(old.index);
      widget.deck._shown[widget.index] = this;
    }
    if (old.height != widget.height) {
      final was = _rows;
      final row = was.hasClients ? (was.page ?? 0).round() : widget.deck._rowAt[widget.index] ?? 0;
      _rows = _controller(row);
      WidgetsBinding.instance.addPostFrameCallback((_) => was.dispose());
    }
  }

  @override
  void dispose() {
    if (widget.deck._shown[widget.index] == this) widget.deck._shown.remove(widget.index);
    _rows.dispose();
    super.dispose();
  }

  void jumpTo(int row) {
    if (_rows.hasClients) _rows.jumpToPage(row);
  }

  @override
  Widget build(BuildContext context) => PageView.builder(
    controller: _rows,
    scrollDirection: Axis.vertical,
    padEnds: false,
    itemCount: widget.count,
    onPageChanged: (row) => widget.deck._onRow(widget.index, row),
    itemBuilder: widget.itemBuilder,
  );
}

/// One dish's card: the photo under a scrim with its name, or without a
/// photo the name set big on the business's colour. A tap opens it grown out
/// of the card; holding one that needs no choosing fills a ring round a
/// plus, and at the full ring it is in the tray. Its photo is what flies to
/// its tile when the deck zooms out ([ZoomPhotoAnchor]).
class DeckCard extends ConsumerStatefulWidget {
  final MenuItem item;
  final bool usual;

  /// The one-time "hold to add" cue: the ring shown, with its words
  final bool hint;

  /// Held until it went into the tray
  final ValueChanged<MenuItem>? onQuickAdd;

  const DeckCard({super.key, required this.item, this.usual = false, this.hint = false, this.onQuickAdd});

  @override
  ConsumerState<DeckCard> createState() => _DeckCardState();
}

class _DeckCardState extends ConsumerState<DeckCard> with SingleTickerProviderStateMixin {
  late final AnimationController _ring;
  bool _pressing = false;

  @override
  void initState() {
    super.initState();
    _ring = AnimationController(vsync: this, duration: kLongPressTimeout);
  }

  @override
  void dispose() {
    _ring.dispose();
    super.dispose();
  }

  void _down() {
    setState(() => _pressing = true);
    if (canQuickAdd(widget.item)) _ring.forward(from: 0);
  }

  void _up() {
    if (!mounted) return;
    setState(() => _pressing = false);
    _ring.reset();
  }

  @override
  Widget build(BuildContext context) {
    final item = widget.item;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => _down(),
      onTapCancel: _up,
      onTapUp: (_) => _up(),
      onTap: () => openDish(context, item),
      onLongPressStart: (_) => _down(),
      onLongPress: () {
        _up();
        quickAdd(context, ref, item);
        if (canQuickAdd(item)) widget.onQuickAdd?.call(item);
      },
      onLongPressCancel: _up,
      child: AnimatedScale(
        scale: _pressing && !reduceMotion(context) ? 0.97 : 1,
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOut,
        child: ZoomPhotoAnchor(
          view: ZoomView.deck,
          item: item,
          radius: cardRadius,
          child: DishPhotoAnchor(
            id: item.id,
            radius: cardRadius,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(cardRadius),
              child: Stack(
                fit: StackFit.expand,
                children: [
                  CardFace(item: item, usual: widget.usual),
                  if (canQuickAdd(item))
                    PositionedDirectional(
                      top: 16,
                      end: 16,
                      child: AnimatedOpacity(
                        opacity: _pressing || widget.hint ? 1 : 0,
                        duration: const Duration(milliseconds: 200),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (widget.hint) ...[const _HoldWords(), const SizedBox(width: 8)],
                            _PressRing(progress: _ring),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The words of the one-time "hold to add" cue, beside the ring on the card
class _HoldWords extends StatelessWidget {
  const _HoldWords();

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: const ShapeDecoration(color: Ninja.sheetScrim, shape: StadiumBorder()),
      child: Text(
        AppLocalizations.of(context)!.ninjaHintHoldAdd,
        style: context.localeText(theme.typography.caption.copyWith(fontWeight: FontWeight.w600, color: Colors.white)),
      ),
    );
  }
}

/// A ring that fills round a plus while a press is held, full as the long press lands
class _PressRing extends StatelessWidget {
  static const size = 44.0;

  final Animation<double> progress;

  const _PressRing({required this.progress});

  @override
  Widget build(BuildContext context) => Container(
    width: size,
    height: size,
    decoration: const BoxDecoration(color: Color(0x73000000), shape: BoxShape.circle),
    child: AnimatedBuilder(
      animation: progress,
      builder: (context, _) => CustomPaint(
        painter: _RingPainter(progress.value),
        child: Icon(LucideIcons.plus, size: size * 0.45, color: Colors.white),
      ),
    ),
  );
}

class _RingPainter extends CustomPainter {
  final double t;

  _RingPainter(this.t);

  @override
  void paint(Canvas canvas, Size size) {
    if (t <= 0) return;
    final rect = Rect.fromCircle(center: size.center(Offset.zero), radius: size.width / 2 - 4);
    canvas.drawArc(
      rect,
      -math.pi / 2,
      2 * math.pi * t,
      false,
      Paint()
        ..color = Colors.white
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3
        ..strokeCap = StrokeCap.round,
    );
  }

  @override
  bool shouldRepaint(_RingPainter old) => old.t != t;
}

/// What a card shows
class CardFace extends ConsumerWidget {
  final MenuItem item;
  final bool usual;

  const CardFace({super.key, required this.item, this.usual = false});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final theme = context.theme;
    final c = theme.colors;
    final money = ref.watch(moneyProvider);
    final locale = Localizations.localeOf(context);
    final style = BrandStyle.of(context);
    final offer = item.isOnOffer && item.offerPrice != null && item.offerPrice! < item.price;
    final soldOut = !item.isAvailable;
    final description = item.description.getText(locale);

    Widget chip(String text, Color fill, Color ink, {IconData? icon}) => Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: ShapeDecoration(color: fill, shape: const StadiumBorder()),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[Icon(icon, size: 14, color: ink), const SizedBox(width: 6)],
          Text(
            text,
            style: context.localeText(theme.typography.caption.copyWith(color: ink, fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
    final badges = PositionedDirectional(
      top: 16,
      start: 16,
      end: 16,
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          if (usual) chip(l10n.yourUsuals, Colors.white.withValues(alpha: 0.9), Colors.black, icon: LucideIcons.repeat2),
          if (soldOut) chip(l10n.unavailable, Colors.black.withValues(alpha: 0.7), Colors.white),
        ],
      ),
    );

    Widget price(Color ink) => Row(
      crossAxisAlignment: CrossAxisAlignment.baseline,
      textBaseline: TextBaseline.alphabetic,
      children: [
        Text(
          money(offer ? item.offerPrice! : item.price),
          style: context.localeText(TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: ink, fontFeatures: NinjaTypography.tabular)),
        ),
        if (offer) ...[
          const SizedBox(width: 8),
          Text(
            money(item.price),
            style: context.localeText(
              theme.typography.note.copyWith(
                color: ink.withValues(alpha: 0.6),
                decoration: TextDecoration.lineThrough,
                decorationColor: ink.withValues(alpha: 0.6),
              ),
            ),
          ),
        ],
      ],
    );

    Widget grey(Widget child) => soldOut
        ? ColorFiltered(
            colorFilter: const ColorFilter.matrix([0.2126, 0.7152, 0.0722, 0, 0, 0.2126, 0.7152, 0.0722, 0, 0, 0.2126, 0.7152, 0.0722, 0, 0, 0, 0, 0, 1, 0]),
            child: child,
          )
        : child;

    // Without a photo: the name set big on the business's colour
    if (item.pictureUri == null) {
      final ink = c.primaryForeground;
      return grey(
        ColoredBox(
          color: c.primary,
          child: Stack(
            children: [
              badges,
              Positioned.fill(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.end,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(item.name.getText(locale), style: style.heading(context, TextStyle(fontSize: 44, height: 0.95, color: ink))),
                      if (description.isNotEmpty) ...[
                        const SizedBox(height: 12),
                        Text(
                          description,
                          maxLines: 3,
                          overflow: TextOverflow.ellipsis,
                          style: context.localeText(theme.typography.note.copyWith(color: ink.withValues(alpha: 0.8))),
                        ),
                      ],
                      const SizedBox(height: 16),
                      price(ink),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }

    return Stack(
      fit: StackFit.expand,
      children: [
        grey(
          CachedNetworkImage(
            imageUrl: item.pictureUri!,
            fit: BoxFit.cover,
            placeholder: (_, _) => ColoredBox(color: c.muted),
            errorWidget: (_, _, _) => ColoredBox(color: c.primary),
          ),
        ),
        const DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.bottomCenter,
              end: Alignment.topCenter,
              colors: [Color(0xCC000000), Color(0x26000000), Color(0x00000000)],
            ),
          ),
        ),
        badges,
        Positioned(
          left: 0,
          right: 0,
          bottom: 0,
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.name.getText(locale),
                  style: style.heading(
                    context,
                    const TextStyle(
                      fontSize: 32,
                      height: 1.05,
                      color: Colors.white,
                      shadows: [Shadow(color: Color(0x59000000), blurRadius: 8, offset: Offset(0, 1))],
                    ),
                  ),
                ),
                if (description.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(
                    description,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: context.localeText(theme.typography.note.copyWith(color: Colors.white.withValues(alpha: 0.8))),
                  ),
                ],
                const SizedBox(height: 12),
                price(Colors.white),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

/// The card after a category's last dish: the next category's name on its
/// colour and a few of its dishes. Resting on it, or tapping it, carries on
/// into that category.
class _UpNext extends StatelessWidget {
  final DeckColumn column;
  final VoidCallback onGo;

  const _UpNext({required this.column, required this.onGo});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final theme = context.theme;
    final (fill, ink) = _toneColors(theme.colors, column.tone);
    final faces = column.items.where((i) => i.pictureUri != null).take(3).toList();
    final rtl = Directionality.of(context) == TextDirection.rtl;
    return Pressable(
      onTap: onGo,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(color: fill, borderRadius: BorderRadius.circular(cardRadius)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              l10n.ninjaUpNext,
              style: context.localeText(theme.typography.note.copyWith(fontWeight: FontWeight.w600, color: ink.withValues(alpha: 0.7))),
            ),
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: Text(column.label, style: BrandStyle.of(context).heading(context, TextStyle(fontSize: 36, height: 1, color: ink))),
                ),
                const SizedBox(width: 16),
                Container(
                  width: 48,
                  height: 48,
                  decoration: const BoxDecoration(color: Color(0x26000000), shape: BoxShape.circle),
                  child: Icon(rtl ? LucideIcons.arrowLeft : LucideIcons.arrowRight, color: ink),
                ),
              ],
            ),
            if (faces.isNotEmpty)
              SizedBox(
                height: 48,
                child: Stack(
                  children: [
                    for (var i = faces.length - 1; i >= 0; i--)
                      PositionedDirectional(
                        start: i * 36.0,
                        // The ring, then the photo clipped to the circle inside it
                        child: Container(
                          width: 48,
                          height: 48,
                          padding: const EdgeInsets.all(2),
                          decoration: BoxDecoration(shape: BoxShape.circle, color: ink.withValues(alpha: 0.2)),
                          child: ClipOval(
                            child: CachedNetworkImage(imageUrl: faces[i].pictureUri!, fit: BoxFit.cover, width: 44, height: 44),
                          ),
                        ),
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

/// A dish on the whole menu: a small photo tile, the name and price under it.
/// Its photo is what a card's flies to as the deck zooms out ([ZoomPhotoAnchor]).
class ZoomTile extends ConsumerWidget {
  final MenuItem item;

  const ZoomTile({super.key, required this.item});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = context.theme;
    final c = theme.colors;
    final money = ref.watch(moneyProvider);
    final locale = Localizations.localeOf(context);
    final offer = item.isOnOffer && item.offerPrice != null && item.offerPrice! < item.price;
    final name = item.name.getText(locale);
    return Pressable(
      scale: 0.95,
      onTap: () => openDish(context, item),
      onLongPress: () => quickAdd(context, ref, item),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Opacity(
            opacity: item.isAvailable ? 1 : 0.5,
            child: AspectRatio(
              aspectRatio: 4 / 5,
              // What a card's photo flies to as the deck zooms out, and back from as it zooms in
              child: ZoomPhotoAnchor(
                view: ZoomView.grid,
                item: item,
                radius: 18,
                child: item.pictureUri == null
                    ? DishPhotoAnchor(
                        id: item.id,
                        radius: 18,
                        child: Container(
                          padding: const EdgeInsets.all(10),
                          alignment: AlignmentDirectional.bottomStart,
                          decoration: BoxDecoration(color: c.primary, borderRadius: BorderRadius.circular(18)),
                          child: Text(
                            name,
                            maxLines: 3,
                            overflow: TextOverflow.ellipsis,
                            style: BrandStyle.of(context).heading(context, TextStyle(fontSize: 16, height: 1.05, color: c.primaryForeground)),
                          ),
                        ),
                      )
                    : DishPhotoBox(item: item, radius: 18),
              ),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            name,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: context.localeText(theme.typography.caption.copyWith(fontWeight: FontWeight.w600, color: c.foreground)),
          ),
          Text(
            money(offer ? item.offerPrice! : item.price),
            style: context.localeText(theme.typography.caption.copyWith(color: c.mutedForeground, fontFeatures: NinjaTypography.tabular)),
          ),
        ],
      ),
    );
  }
}

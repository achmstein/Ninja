import 'dart:ui' show lerpDouble;
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import '../../../core/motion/motion.dart';
import '../../../core/ui/ui.dart';
import '../models/menu_item.dart';

/// The one spring a zoom's photos fly on and the two views cross-fade on:
/// the one a dish opens on (client_web's FLIGHT_SPRING, springOpen settled tight)
final zoomSpring = SpringCurve(Motion.springOpen);

/// The deck's two views: its big cards, and the whole menu as small tiles
enum ZoomView { deck, grid }

/// A dish's photo on its way between a card and its tile, in the stage's
/// coordinates: the two frames and their corners
class ZoomFlight {
  final MenuItem item;
  final Rect from;
  final Rect to;
  final double fromRadius;
  final double toRadius;

  const ZoomFlight({required this.item, required this.from, required this.to, required this.fromRadius, required this.toRadius});

  /// The frame at [p] of the way (0 [from], 1 [to])
  Rect rectAt(double p) => Rect.lerp(from, to, p.clamp(0.0, 1.0))!;

  double radiusAt(double p) => lerpDouble(fromRadius, toRadius, p.clamp(0.0, 1.0))!;

  /// The copy hands over to the photo it lands on over its last fifth
  static double opacityAt(double p) => p < 0.8 ? 1 : ((1 - p) / 0.2).clamp(0.0, 1.0);
}

/// Where the cards' and the tiles' photos are, so a zoom can fly each card
/// in view to its tile (client_web's `data-photo` and planFlight)
abstract final class ZoomPhotos {
  static final _anchors = <_ZoomPhotoAnchorState>{};

  static Rect? _rectIn(_ZoomPhotoAnchorState anchor, RenderBox room) {
    if (!anchor.mounted) return null;
    final box = anchor.context.findRenderObject() as RenderBox?;
    if (box == null || !box.attached || !box.hasSize || box.size.width < 1 || box.size.height < 1) return null;
    return MatrixUtils.transformRect(box.getTransformTo(room), Offset.zero & box.size);
  }

  /// The flights of a zoom away from [from], measured where both views are
  /// now inside [room]: each card in view with its tile, from the card when
  /// leaving the deck and from the tile when coming back to it. None for a
  /// card whose dish has no tile laid out.
  static List<ZoomFlight> plan(ZoomView from, RenderBox room) {
    if (!room.attached || !room.hasSize) return const [];
    final box = Offset.zero & room.size;
    final flights = <ZoomFlight>[];
    for (final card in _anchors.where((a) => a.widget.view == ZoomView.deck)) {
      final cardRect = _rectIn(card, room);
      if (cardRect == null || !cardRect.overlaps(box)) continue;
      // The dish's tile, the one in view if more than one is laid out
      ({Rect rect, double radius})? tile;
      for (final t in _anchors.where((a) => a.widget.view == ZoomView.grid && a.widget.item.id == card.widget.item.id)) {
        final rect = _rectIn(t, room);
        if (rect == null) continue;
        if (tile == null || (rect.overlaps(box) && !tile.rect.overlaps(box))) tile = (rect: rect, radius: t.widget.radius);
      }
      if (tile == null) continue;
      final leavingDeck = from == ZoomView.deck;
      flights.add(
        ZoomFlight(
          item: card.widget.item,
          from: leavingDeck ? cardRect : tile.rect,
          to: leavingDeck ? tile.rect : cardRect,
          fromRadius: leavingDeck ? card.widget.radius : tile.radius,
          toRadius: leavingDeck ? tile.radius : card.widget.radius,
        ),
      );
    }
    return flights;
  }
}

/// A card's photo or a tile's, known to [ZoomPhotos] by its view and dish
class ZoomPhotoAnchor extends StatefulWidget {
  final ZoomView view;
  final MenuItem item;
  final double radius;
  final Widget child;

  const ZoomPhotoAnchor({super.key, required this.view, required this.item, required this.radius, required this.child});

  @override
  State<ZoomPhotoAnchor> createState() => _ZoomPhotoAnchorState();
}

class _ZoomPhotoAnchorState extends State<ZoomPhotoAnchor> {
  @override
  void initState() {
    super.initState();
    ZoomPhotos._anchors.add(this);
  }

  @override
  void dispose() {
    ZoomPhotos._anchors.remove(this);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}

/// The photos of a zoom in flight over the stage, following [progress]. Each
/// is a copy: what it leaves and what it lands on stay where they are, so
/// over its last fifth it fades, handing over to the one it has landed on.
class ZoomFlights extends StatelessWidget {
  final List<ZoomFlight> flights;
  final Animation<double> progress;

  const ZoomFlights({super.key, required this.flights, required this.progress});

  @override
  Widget build(BuildContext context) => IgnorePointer(
    child: AnimatedBuilder(
      animation: progress,
      builder: (context, _) {
        final p = progress.value;
        return Stack(
          fit: StackFit.expand,
          children: [
            for (final f in flights)
              Positioned.fromRect(
                rect: f.rectAt(p),
                child: Opacity(
                  opacity: ZoomFlight.opacityAt(p),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(f.radiusAt(p)),
                    child: _Photo(item: f.item),
                  ),
                ),
              ),
          ],
        );
      },
    ),
  );
}

/// A dish's photo filling its frame ("cover", so it never stretches), or the business's colour without one
class _Photo extends StatelessWidget {
  final MenuItem item;

  const _Photo({required this.item});

  @override
  Widget build(BuildContext context) {
    final c = context.theme.colors;
    final plate = ColoredBox(color: c.primary);
    Widget photo = item.pictureUri == null
        ? plate
        : CachedNetworkImage(
            imageUrl: item.pictureUri!,
            fit: BoxFit.cover,
            fadeInDuration: Duration.zero,
            placeholder: (_, _) => ColoredBox(color: c.muted),
            errorWidget: (_, _, _) => plate,
          );
    if (!item.isAvailable) {
      photo = ColorFiltered(
        colorFilter: const ColorFilter.matrix([0.2126, 0.7152, 0.0722, 0, 0, 0.2126, 0.7152, 0.0722, 0, 0, 0.2126, 0.7152, 0.0722, 0, 0, 0, 0, 0, 1, 0]),
        child: photo,
      );
    }
    return SizedBox.expand(child: photo);
  }
}

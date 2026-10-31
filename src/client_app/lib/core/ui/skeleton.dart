import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';
import '../motion/motion.dart';
import '../theme/ninja_theme.dart';

/// What is coming, drawn in its own shape while it loads, a light sweeping
/// over it (client_web's components/ui/skeleton.tsx). One [Skeleton] round a
/// whole placeholder, so its bones shine as one; build them from [Bone] and
/// [BoneLine] the size of what they stand in for, so nothing moves when the
/// real thing lands. The sweep runs with the reading direction, and stands
/// still for anyone who asked for less motion.
class Skeleton extends StatelessWidget {
  final Widget child;

  const Skeleton({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    final c = context.theme.colors;
    // A shade lighter than the bones on a light page and on a dark one alike
    final highlight = Color.lerp(c.muted, c.foreground, 0.07)!;
    return ExcludeSemantics(
      child: Shimmer.fromColors(
        baseColor: c.muted,
        highlightColor: highlight,
        period: const Duration(milliseconds: 1600),
        direction: Directionality.of(context) == TextDirection.rtl ? ShimmerDirection.rtl : ShimmerDirection.ltr,
        enabled: !reduceMotion(context),
        child: child,
      ),
    );
  }
}

/// A box of what is coming: a photo, a card, a button. Its colour is the
/// sweep's to set; only its shape counts.
class Bone extends StatelessWidget {
  final double? width;
  final double? height;
  final double radius;
  final bool circle;

  const Bone({super.key, this.width, this.height, this.radius = 8, this.circle = false});

  /// A box as wide as it is given, at [aspectRatio], as a photo is laid
  static Widget ratio(double aspectRatio, {double radius = Ninja.cardRadius}) =>
      AspectRatio(aspectRatio: aspectRatio, child: Bone(radius: radius));

  @override
  Widget build(BuildContext context) => Container(
    width: width,
    height: height,
    decoration: BoxDecoration(
      color: context.theme.colors.muted,
      shape: circle ? BoxShape.circle : BoxShape.rectangle,
      borderRadius: circle ? null : BorderRadius.circular(radius),
    ),
  );
}

/// A line of words to come: the height of its text, [widthFactor] of its row,
/// from the start of the line
class BoneLine extends StatelessWidget {
  final double widthFactor;
  final double height;

  const BoneLine({super.key, this.widthFactor = 1, this.height = 12});

  @override
  Widget build(BuildContext context) => SizedBox(
    height: height,
    child: FractionallySizedBox(
      alignment: AlignmentDirectional.centerStart,
      widthFactor: widthFactor,
      child: Bone(radius: height / 2),
    ),
  );
}

/// A list of rows still to come, for the pages that list things: a round
/// mark or a square photo, two lines, and an amount at the end
class SkeletonList extends StatelessWidget {
  final int rows;
  final bool photo;
  final bool trailing;
  final EdgeInsetsGeometry padding;

  const SkeletonList({super.key, this.rows = 6, this.photo = false, this.trailing = true, this.padding = EdgeInsets.zero});

  @override
  Widget build(BuildContext context) => Skeleton(
    child: Padding(
      padding: padding,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var i = 0; i < rows; i++) ...[
            if (i > 0) const SizedBox(height: 20),
            Row(
              children: [
                photo ? const Bone(width: 56, height: 56, radius: Ninja.tileRadius - 6) : const Bone(width: 40, height: 40, circle: true),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Not every row's words are as long: the lines vary, as a real list does
                      BoneLine(widthFactor: const [0.7, 0.5, 0.62][i % 3], height: 14),
                      const SizedBox(height: 8),
                      BoneLine(widthFactor: const [0.4, 0.55, 0.32][i % 3], height: 10),
                    ],
                  ),
                ),
                if (trailing) ...[const SizedBox(width: 12), const Bone(width: 56, height: 14, radius: 7)],
              ],
            ),
          ],
        ],
      ),
    ),
  );
}

/// A card still to come: its fill a shade under its bones, a heading and a
/// line at the top, an amount and a button at the bottom. The bills', the
/// places', the stays' and the loyalty card's shape while they load.
class SkeletonCard extends StatelessWidget {
  final double height;
  final double radius;

  /// The button at its bottom end; off for a card with only words
  final bool action;

  const SkeletonCard({super.key, required this.height, this.radius = Ninja.cardRadius, this.action = true});

  @override
  Widget build(BuildContext context) => Container(
    height: height,
    padding: const EdgeInsets.all(20),
    decoration: BoxDecoration(color: context.theme.colors.muted.withValues(alpha: 0.45), borderRadius: BorderRadius.circular(radius)),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const BoneLine(widthFactor: 0.45, height: 20),
        const SizedBox(height: 10),
        const BoneLine(widthFactor: 0.3, height: 12),
        const Spacer(),
        Row(children: [const Bone(width: 88, height: 16, radius: 8), const Spacer(), if (action) const Bone(width: 96, height: 40, radius: 20)]),
      ],
    ),
  );
}

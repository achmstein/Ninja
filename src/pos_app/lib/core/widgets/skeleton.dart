import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import 'package:shimmer/shimmer.dart';

/// Wraps a placeholder tree in the till's standard shimmer: the muted colour
/// as the base, the background as the sweep. Build the placeholder from
/// [skeletonBar] / [skeletonBox] shaped like the real content, so the load
/// reads as "this is coming" rather than a grey block.
class Skeleton extends StatelessWidget {
  final Widget child;
  const Skeleton({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    return Shimmer.fromColors(
      baseColor: theme.colors.muted,
      highlightColor: theme.colors.background,
      child: child,
    );
  }
}

/// One line of text as a muted rounded bar. Give a [widthFactor] to make it
/// shorter than its row.
Widget skeletonBar(BuildContext context, {double widthFactor = 1, double height = 12, double radius = 4}) {
  final theme = context.theme;
  return SizedBox(
    height: height,
    child: FractionallySizedBox(
      alignment: AlignmentDirectional.centerStart,
      widthFactor: widthFactor,
      child: DecoratedBox(
        decoration: BoxDecoration(color: theme.colors.muted, borderRadius: BorderRadius.circular(radius)),
      ),
    ),
  );
}

/// A muted rounded box — a picture, an avatar, an icon slot.
Widget skeletonBox(BuildContext context, {double? width, double? height, double radius = 8, bool circle = false}) {
  final theme = context.theme;
  return Container(
    width: width,
    height: height,
    decoration: BoxDecoration(
      color: theme.colors.muted,
      shape: circle ? BoxShape.circle : BoxShape.rectangle,
      borderRadius: circle ? null : BorderRadius.circular(radius),
    ),
  );
}

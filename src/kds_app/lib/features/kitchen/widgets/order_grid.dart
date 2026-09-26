import 'package:flutter/material.dart';
import 'package:flutter_staggered_grid_view/flutter_staggered_grid_view.dart';

/// The kitchen's card grid, as kds_web's CSS columns: as many columns as
/// fit at [minCardWidth], each card as tall as its own order, and every
/// next card dropped into the shortest column — no holes under the short
/// ones, which a row-aligned grid would leave.
///
/// Children are found by key, not position, and painted without repaint
/// boundaries of their own, so a card that moves when another leaves keeps
/// its state and can glide to its new place (see ReflowItem).
class OrderGrid extends StatelessWidget {
  final List<Widget> children;
  final double minCardWidth;
  final double gap;
  final EdgeInsets padding;

  const OrderGrid({
    super.key,
    required this.children,
    this.minCardWidth = 256,
    this.gap = 12,
    this.padding = const EdgeInsets.all(12),
  });

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth - padding.horizontal;
        final columns = ((width + gap) / (minCardWidth + gap)).floor().clamp(1, 12);
        final indexOf = {
          for (final (index, child) in children.indexed)
            if (child.key != null) child.key!: index,
        };
        return MasonryGridView.custom(
          padding: padding,
          gridDelegate: SliverSimpleGridDelegateWithFixedCrossAxisCount(crossAxisCount: columns),
          mainAxisSpacing: gap,
          crossAxisSpacing: gap,
          childrenDelegate: SliverChildBuilderDelegate(
            (context, index) => children[index],
            childCount: children.length,
            findChildIndexCallback: (key) => indexOf[key],
            addRepaintBoundaries: false,
          ),
        );
      },
    );
  }
}

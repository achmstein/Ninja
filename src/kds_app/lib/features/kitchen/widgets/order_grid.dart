import 'package:flutter/material.dart';
import 'package:flutter_staggered_grid_view/flutter_staggered_grid_view.dart';

/// The kitchen's card grid, as kds_web's CSS columns: as many columns as
/// fit at [minCardWidth], each card as tall as its own order, and every
/// next card dropped into the shortest column — no holes under the short
/// ones, which a row-aligned grid would leave.
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
        return MasonryGridView.count(
          padding: padding,
          crossAxisCount: columns,
          mainAxisSpacing: gap,
          crossAxisSpacing: gap,
          itemCount: children.length,
          itemBuilder: (context, index) => children[index],
        );
      },
    );
  }
}

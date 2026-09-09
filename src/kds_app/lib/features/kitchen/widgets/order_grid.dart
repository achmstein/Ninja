import 'package:flutter/material.dart';

/// The kitchen's card grid, as kds_web's `repeat(auto-fill, minmax(16rem,
/// 1fr))`: as many columns as fit at [minCardWidth], cards top-aligned in
/// each row and as tall as their own content, the whole thing scrolling.
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
        final cardWidth = (width - gap * (columns - 1)) / columns;
        return SingleChildScrollView(
          padding: padding,
          child: Wrap(
            spacing: gap,
            runSpacing: gap,
            crossAxisAlignment: WrapCrossAlignment.start,
            children: [
              for (final child in children) SizedBox(width: cardWidth, child: child),
            ],
          ),
        );
      },
    );
  }
}

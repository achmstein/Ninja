import 'package:flutter/material.dart';
import '../../../core/brand/styles.dart';
import '../../../core/ui/skeleton.dart';

/// The places while they load, in the shape the business's places style
/// lays them out: the big cards, the flat rows with their dot, or two tiles
/// a row. One sweep over them all, at the page's own gap.
class PlacesSkeleton extends StatelessWidget {
  final PlacesLayout layout;

  const PlacesSkeleton({super.key, required this.layout});

  /// The page's gap between blocks (places_screen's NinjaPage)
  static const _gap = 16.0;

  @override
  Widget build(BuildContext context) => Skeleton(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: _gap,
      children: switch (layout) {
        PlacesLayout.cards => [for (var i = 0; i < 3; i++) const SkeletonCard(height: 176)],
        PlacesLayout.list => [for (var i = 0; i < 6; i++) _Row(index: i)],
        PlacesLayout.grid => [
          for (var i = 0; i < 2; i++)
            const Row(
              spacing: 12,
              children: [Expanded(child: Bone(height: 124, radius: 24)), Expanded(child: Bone(height: 124, radius: 24))],
            ),
        ],
      },
    ),
  );
}

/// A flat row: the free or taken dot, the name, what it is
class _Row extends StatelessWidget {
  final int index;

  const _Row({required this.index});

  @override
  Widget build(BuildContext context) => Row(
    children: [
      const Bone(width: 8, height: 8, circle: true),
      const SizedBox(width: 12),
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          spacing: 6,
          children: [
            BoneLine(widthFactor: const [0.4, 0.55, 0.33][index % 3], height: 14),
            BoneLine(widthFactor: const [0.25, 0.3, 0.2][index % 3], height: 10),
          ],
        ),
      ),
    ],
  );
}

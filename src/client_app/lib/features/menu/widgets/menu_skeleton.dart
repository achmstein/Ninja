import 'package:flutter/material.dart';
import '../../../core/brand/styles.dart';
import '../../../core/ui/skeleton.dart';
import '../../../core/ui/ui.dart';
import 'deck.dart' show cardRadius;

/// The menu while it loads, in the shape the business's menu style will
/// take: the deck's card, three small tiles a row, two photo tiles a row, the
/// classic rows, the compact lines or the wide magazine photos. Laid out with
/// the same padding, gaps and ratios as the real items (item.dart, the menu
/// screen's sections), so the menu lands where its placeholder stood.
class MenuSkeleton extends StatelessWidget {
  final MenuItemLayout layout;

  const MenuSkeleton({super.key, required this.layout});

  @override
  Widget build(BuildContext context) {
    // The deck: one big card, the next one peeking under it
    if (layout == MenuItemLayout.deck) {
      return const Skeleton(
        child: Padding(
          padding: EdgeInsets.fromLTRB(16, 12, 16, 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(child: Bone(radius: cardRadius)),
              SizedBox(height: 12),
              Padding(
                padding: EdgeInsets.symmetric(horizontal: 24),
                child: Bone(height: 20, radius: cardRadius),
              ),
            ],
          ),
        ),
      );
    }
    return Skeleton(
      child: SingleChildScrollView(
        physics: const NeverScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // The page's large title
            const Padding(padding: EdgeInsets.only(bottom: 20), child: BoneLine(widthFactor: 0.38, height: 30)),
            for (var s = 0; s < 2; s++) ...[
              // A category's heading
              BoneLine(widthFactor: s == 0 ? 0.3 : 0.42, height: 20),
              const SizedBox(height: 12),
              _items(layout),
              const SizedBox(height: 28),
            ],
          ],
        ),
      ),
    );
  }

  static Widget _items(MenuItemLayout layout) => switch (layout) {
    MenuItemLayout.tiles || MenuItemLayout.deck => const _Grid(columns: 3, rows: 2, gap: 10, child: _Tile()),
    MenuItemLayout.card => const _Grid(columns: 2, rows: 2, gap: 12, rowGap: 20, child: _PhotoTile()),
    MenuItemLayout.compact => const _Compact(),
    MenuItemLayout.hero => const Column(children: [_Hero(), SizedBox(height: 16), _Hero()]),
    MenuItemLayout.row => const _Rows(),
  };
}

/// [rows] rows of [columns] of the same placeholder
class _Grid extends StatelessWidget {
  final int columns;
  final int rows;
  final double gap;
  final double? rowGap;
  final Widget child;

  const _Grid({required this.columns, required this.rows, required this.gap, this.rowGap, required this.child});

  @override
  Widget build(BuildContext context) => Column(
    children: [
      for (var r = 0; r < rows; r++) ...[
        if (r > 0) SizedBox(height: rowGap ?? gap),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (var i = 0; i < columns; i++) ...[if (i > 0) SizedBox(width: gap), Expanded(child: child)],
          ],
        ),
      ],
    ],
  );
}

/// The small tile: a 4:5 photo, its name and price under it in captions
class _Tile extends StatelessWidget {
  const _Tile();

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Bone.ratio(4 / 5, radius: Ninja.tileRadius),
      const SizedBox(height: 6),
      const BoneLine(widthFactor: 0.8, height: 11),
      const SizedBox(height: 5),
      const BoneLine(widthFactor: 0.45, height: 10),
    ],
  );
}

/// The photo grid's tile: a big 4:5 photo, the name and the price's pill under it
class _PhotoTile extends StatelessWidget {
  const _PhotoTile();

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Bone.ratio(4 / 5, radius: 24),
      const SizedBox(height: 8),
      const Padding(
        padding: EdgeInsets.symmetric(horizontal: 4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [BoneLine(widthFactor: 0.75, height: 14), SizedBox(height: 8), Bone(width: 64, height: 22, radius: 11)],
        ),
      ),
    ],
  );
}

/// The classic rows: the square photo, the name, a line of what it is, the price's pill, the round button
class _Rows extends StatelessWidget {
  const _Rows();

  @override
  Widget build(BuildContext context) {
    final photo = MediaQuery.sizeOf(context).height < 740 ? 72.0 : 80.0;
    return Column(
      children: [
        for (var i = 0; i < 3; i++) ...[
          if (i > 0) const SizedBox(height: 16),
          Row(
            children: [
              Bone(width: photo, height: photo, radius: Ninja.tileRadius),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    BoneLine(widthFactor: const [0.62, 0.48, 0.7][i], height: 15),
                    const SizedBox(height: 6),
                    BoneLine(widthFactor: const [0.85, 0.7, 0.78][i], height: 10),
                    const SizedBox(height: 8),
                    const Bone(width: 64, height: 22, radius: 11),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              const Bone(width: 40, height: 40, circle: true),
            ],
          ),
        ],
      ],
    );
  }
}

/// The compact lines: the name and its price on one line, what it is under, the button; a rule between
class _Compact extends StatelessWidget {
  const _Compact();

  @override
  Widget build(BuildContext context) {
    final rule = context.theme.colors.border.withValues(alpha: 0.6);
    return Column(
      children: [
        for (var i = 0; i < 4; i++) ...[
          if (i > 0) Divider(height: 1, thickness: 1, color: rule),
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(child: BoneLine(widthFactor: const [0.6, 0.45, 0.7, 0.52][i], height: 14)),
                          const SizedBox(width: 12),
                          const Bone(width: 48, height: 14, radius: 7),
                        ],
                      ),
                      const SizedBox(height: 6),
                      BoneLine(widthFactor: const [0.75, 0.6, 0.5, 0.68][i], height: 10),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                const Bone(width: 44, height: 44, circle: true),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

/// The magazine's wide 16:11 photo, the name and price on its shade at the bottom
class _Hero extends StatelessWidget {
  const _Hero();

  @override
  Widget build(BuildContext context) => Bone.ratio(16 / 11);
}

/// The classic rows alone, for a list of items outside the menu (the favourites)
class MenuRowsSkeleton extends StatelessWidget {
  const MenuRowsSkeleton({super.key});

  @override
  Widget build(BuildContext context) => const Skeleton(child: _Rows());
}

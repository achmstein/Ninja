import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'brand_provider.dart';
import 'brand_theme.dart';

/// The tenant's mark, square: the logo when one is uploaded, otherwise a
/// rounded tile in the brand color with the name's first letter (the web
/// apps' BrandMark). [color] sets the tile where the theme's primary would
/// not read, such as a splash on a fixed background.
class BrandMark extends ConsumerWidget {
  final double size;
  final Color? color;

  const BrandMark({super.key, required this.size, this.color});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final brand = ref.watch(brandProvider);
    final logoUrl = brand.logoUrl;
    if (logoUrl != null) {
      return Image.network(
        logoUrl,
        width: size,
        height: size,
        fit: BoxFit.contain,
        errorBuilder: (_, _, _) => _tile(context, ref),
      );
    }
    return _tile(context, ref);
  }

  Widget _tile(BuildContext context, WidgetRef ref) {
    final colors = context.theme.colors;
    final fill = color ?? colors.primary;
    final ink = color != null ? onBrandColor(fill) : colors.primaryForeground;
    final initial = ref.watch(brandProvider).initial(Localizations.localeOf(context));
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(color: fill, borderRadius: BorderRadius.circular(size * 0.22)),
      child: Text(
        initial,
        style: TextStyle(color: ink, fontSize: size * 0.5, fontWeight: FontWeight.w600, height: 1),
      ),
    );
  }
}

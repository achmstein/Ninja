import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import '../widgets/app_text.dart';
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

/// The tenant's brand as a header shows it: the wide wordmark when one is
/// uploaded, in a box of its own aspect ratio no taller than [height] and
/// no wider than [maxWidth] (the room it has, when null). Without one, the
/// square [BrandMark] at [height], with the name under it in [nameStyle]
/// when that is given, or [fallback] when the caller has its own stand-in.
class BrandWordmark extends ConsumerWidget {
  final double height;
  final double? maxWidth;

  /// The tile's color, see [BrandMark.color]
  final Color? color;
  final TextStyle? nameStyle;
  final double gap;
  final Widget? fallback;

  const BrandWordmark({
    super.key,
    required this.height,
    this.maxWidth,
    this.color,
    this.nameStyle,
    this.gap = 12,
    this.fallback,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final wordmark = ref.watch(brandProvider.select((b) => b.wordmark));
    if (wordmark == null) return _standIn(context, ref);
    return ConstrainedBox(
      constraints: BoxConstraints(maxHeight: height, maxWidth: maxWidth ?? double.infinity),
      child: AspectRatio(
        aspectRatio: wordmark.aspectRatio,
        child: Image.network(
          wordmark.url,
          fit: BoxFit.contain,
          errorBuilder: (context, _, _) => _standIn(context, ref),
        ),
      ),
    );
  }

  Widget _standIn(BuildContext context, WidgetRef ref) {
    if (fallback case final fallback?) return fallback;
    final nameStyle = this.nameStyle;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        BrandMark(size: height, color: color),
        if (nameStyle != null) ...[
          SizedBox(height: gap),
          AppText(ref.watch(brandNameProvider), style: nameStyle, textAlign: TextAlign.center),
        ],
      ],
    );
  }
}

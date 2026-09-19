import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import '../widgets/app_text.dart';
import 'brand_provider.dart';
import 'brand_theme.dart';

/// The tenant's mark, square: the logo when one is uploaded (the dark one
/// on a dark page), otherwise a rounded tile in the brand color with the
/// name's first letter (the web apps' BrandMark). [color] sets the tile
/// where the theme's primary would not read, such as a splash on a fixed
/// background; [brightness] picks the logo where the page is not the
/// theme's, such as that same splash.
class BrandMark extends ConsumerWidget {
  final double size;
  final Color? color;
  final Brightness? brightness;

  const BrandMark({super.key, required this.size, this.color, this.brightness});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final brand = ref.watch(brandProvider);
    final logoUrl = brand.logoFor(brightness ?? Theme.of(context).brightness);
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

/// The tenant's brand as a header shows it: the wide wordmark for the
/// page's language and brightness when one is uploaded, in a box of its
/// own aspect ratio no taller than [height] and no wider than [maxWidth]
/// (the room it has, when null). Without one, the square [BrandMark] at
/// [height], with the name under it in [nameStyle] when that is given, or
/// [fallback] when the caller has its own stand-in.
class BrandWordmark extends ConsumerWidget {
  final double height;
  final double? maxWidth;

  /// The tile's color, see [BrandMark.color]
  final Color? color;

  /// The page's brightness where it is not the theme's, see [BrandMark.brightness]
  final Brightness? brightness;
  final TextStyle? nameStyle;
  final double gap;
  final Widget? fallback;

  const BrandWordmark({
    super.key,
    required this.height,
    this.maxWidth,
    this.color,
    this.brightness,
    this.nameStyle,
    this.gap = 12,
    this.fallback,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final page = brightness ?? Theme.of(context).brightness;
    final locale = Localizations.localeOf(context);
    final wordmark = ref.watch(brandProvider.select((b) => b.wordmarkFor(locale, page)));
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
        BrandMark(size: height, color: color, brightness: brightness),
        if (nameStyle != null) ...[
          SizedBox(height: gap),
          AppText(ref.watch(brandNameProvider), style: nameStyle, textAlign: TextAlign.center),
        ],
      ],
    );
  }
}

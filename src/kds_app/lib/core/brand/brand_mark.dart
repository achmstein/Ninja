import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import '../../l10n/app_localizations.dart';
import 'brand_provider.dart';

/// The platform, as the vendor line names it. Every staff surface carries
/// the café's own name and mark; the platform is a line at the foot of a
/// page (ninja-plan.md).
const String platformName = 'ninja';

/// The café's mark, square: its logo when one is uploaded, otherwise a
/// rounded tile in the theme's primary with the name's first letter. The
/// staff apps keep the neutral theme, so the tile is ink on paper. [color]
/// sets the tile where the theme's primary would not read, such as a splash
/// on a fixed background; [logo] false keeps to the tile (a splash before
/// the network is worth waiting for).
class BrandMark extends ConsumerWidget {
  final double size;
  final Color? color;
  final bool logo;

  const BrandMark({super.key, required this.size, this.color, this.logo = true});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final brand = ref.watch(brandProvider);
    final colors = context.theme.colors;
    final fill = color ?? colors.primary;
    final ink = color != null
        ? (ThemeData.estimateBrightnessForColor(fill) == Brightness.dark ? Colors.white : const Color(0xFF18181B))
        : colors.primaryForeground;
    final initial = brand.initial(Localizations.localeOf(context));

    Widget tile() => Container(
          width: size,
          height: size,
          alignment: Alignment.center,
          decoration: BoxDecoration(color: fill, borderRadius: BorderRadius.circular(size * 0.22)),
          child: Text(
            initial.isEmpty ? '·' : initial,
            style: TextStyle(color: ink, fontSize: size * 0.5, fontWeight: FontWeight.w700, height: 1),
          ),
        );

    final url = brand.logoUrl;
    if (!logo || url == null) return tile();
    return SizedBox(
      width: size,
      height: size,
      child: Image.network(
        url,
        fit: BoxFit.contain,
        // Until it lands, and if it never does, the tile
        loadingBuilder: (context, child, progress) => progress == null ? child : tile(),
        errorBuilder: (context, error, stack) => tile(),
      ),
    );
  }
}

/// The platform's wordmark in its display face, for the loading screen: the
/// one place the platform, not the café, is what there is to show, since
/// the café is not known until the app has read it.
class PlatformWordmark extends StatelessWidget {
  final double size;
  final Color color;

  const PlatformWordmark({super.key, required this.size, required this.color});

  @override
  Widget build(BuildContext context) => Text(
        platformName,
        textDirection: TextDirection.ltr,
        style: TextStyle(fontFamily: 'OriginalSurfer', fontSize: size, color: color, height: 1),
      );
}

/// The platform's lockup, as control_web's splash draws it: `ninja` in the
/// display face, a hairline, and which of its apps this is ([label], "POS"
/// or "KDS") in small letter-spaced caps. A Latin mark, so it keeps its own
/// direction on an Arabic screen.
class PlatformLockup extends StatelessWidget {
  final String label;
  final Color color;
  final Color labelColor;
  final Color lineColor;

  const PlatformLockup({
    super.key,
    required this.label,
    required this.color,
    required this.labelColor,
    required this.lineColor,
  });

  @override
  Widget build(BuildContext context) => Directionality(
        textDirection: TextDirection.ltr,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            PlatformWordmark(size: 48, color: color),
            const SizedBox(width: 16),
            Container(width: 1, height: 28, color: lineColor),
            const SizedBox(width: 16),
            Text(
              label,
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 14,
                fontWeight: FontWeight.w500,
                letterSpacing: 14 * 0.2,
                color: labelColor,
                height: 1,
              ),
            ),
          ],
        ),
      );
}

/// "Powered by ninja": quiet, at the foot of a staff page.
class PoweredBy extends StatelessWidget {
  const PoweredBy({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    return Directionality(
      textDirection: TextDirection.ltr,
      child: Text(
        '${l10n.poweredBy} $platformName',
        textAlign: TextAlign.center,
        style: theme.typography.xs.copyWith(color: theme.colors.mutedForeground),
      ),
    );
  }
}

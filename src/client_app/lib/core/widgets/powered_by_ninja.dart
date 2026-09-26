import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../l10n/app_localizations.dart';
import 'app_text.dart';

/// "Powered by ninja", for the About sheet: the platform's wordmark in its
/// own display face (Original Surfer), the one place a café's app carries
/// it. A Latin wordmark, so it keeps left-to-right on an Arabic screen.
class PoweredByNinja extends StatelessWidget {
  const PoweredByNinja({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.theme.colors;
    final l10n = AppLocalizations.of(context)!;
    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        AppText(
          l10n.poweredBy,
          style: TextStyle(fontSize: 12, color: colors.mutedForeground),
        ),
        const SizedBox(width: 6),
        Directionality(
          textDirection: TextDirection.ltr,
          child: Text(
            'ninja',
            style: GoogleFonts.originalSurfer(
              fontSize: 20,
              height: 1,
              color: colors.foreground,
            ),
          ),
        ),
      ],
    );
  }
}

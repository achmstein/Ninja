import 'package:flutter/material.dart';
import '../ui/ui.dart';
import 'app_text.dart';

/// The business not taking orders or bookings for now, one look on the Menu and
/// the Book tab (and the web app's): an icon in a soft round and a short
/// title, in a warm amber rather than an error's red, since
/// nothing went wrong and it comes back on its own.
class PausedNotice extends StatelessWidget {
  final String title;

  /// Its room on the page; a page that pads its content already passes less
  final EdgeInsetsGeometry margin;

  const PausedNotice({super.key, required this.title, this.margin = const EdgeInsets.fromLTRB(16, 8, 16, 8)});

  @override
  Widget build(BuildContext context) {
    final colors = context.theme.colors;
    // Read off the page itself, so it follows the business's scheme whichever the phone is in
    final dark = colors.background.computeLuminance() < 0.5;
    const amber = NinjaColors.warningSolid;
    final ink = dark ? NinjaColors.warningOnSlabPale : NinjaColors.warningInkDeep;
    final mark = dark ? NinjaColors.warningOnSlab : NinjaColors.warningInk;

    return Padding(
      padding: margin,
      child: Semantics(
        liveRegion: true,
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: amber.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(24),
          ),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(color: amber.withValues(alpha: 0.2), shape: BoxShape.circle),
                child: Icon(LucideIcons.circlePause, size: 20, color: mark),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: AppText(title, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: ink, height: 1.3)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

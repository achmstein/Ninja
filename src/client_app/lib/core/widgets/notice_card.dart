import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import 'app_text.dart';

/// The café not taking orders or bookings for now, one look on the Menu and
/// the Book tab (and the web app's): an icon in a soft round and a short
/// title, in a warm amber rather than an error's red, since
/// nothing went wrong and it comes back on its own.
class PausedNotice extends StatelessWidget {
  final String title;

  const PausedNotice({super.key, required this.title});

  @override
  Widget build(BuildContext context) {
    final colors = context.theme.colors;
    // Read off the page itself, so it follows the café's scheme whichever the phone is in
    final dark = colors.background.computeLuminance() < 0.5;
    const amber = Color(0xFFF59E0B);
    final ink = dark ? const Color(0xFFFEF3C7) : const Color(0xFF451A03);
    final mark = dark ? const Color(0xFFFCD34D) : const Color(0xFFB45309);

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
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
                child: Icon(FIcons.circlePause, size: 20, color: mark),
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

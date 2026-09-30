import 'package:flutter/material.dart';

/// Fixed colours a few screens still name directly. The theme itself is
/// NinjaTheme (ninja_theme.dart), read as `context.theme`
class AppTheme {
  // Forui zinc-based colors
  static const Color primaryColor = Color(0xFF18181B); // zinc-900
  static const Color secondaryColor = Color(0xFF3F3F46); // zinc-700
  static const Color accentColor = Color(0xFF71717A); // zinc-500
  static const Color backgroundColor = Color(0xFFFAFAFA); // zinc-50
  static const Color surfaceColor = Colors.white;
  static const Color errorColor = Color(0xFFDC2626); // red-600
  static const Color successColor = Color(0xFF16A34A); // green-600
  static const Color warningColor = Color(0xFFCA8A04); // yellow-600

  // Text colors (zinc-based)
  static const Color textPrimary = Color(0xFF18181B); // zinc-900
  static const Color textSecondary = Color(0xFF52525B); // zinc-600
  static const Color textMuted = Color(0xFFA1A1AA); // zinc-400
}

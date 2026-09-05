import 'package:flutter/material.dart';
import 'package:forui/forui.dart';

/// The small uppercase section label the floor uses ("OPEN PLACE",
/// "RESERVED"): xs, semibold, tracked, muted.
class Heading extends StatelessWidget {
  final String text;

  const Heading(this.text, {super.key});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    return Text(
      text.toUpperCase(),
      style: theme.typography.xs.copyWith(
        fontWeight: FontWeight.w600,
        letterSpacing: 0.6,
        color: theme.colors.mutedForeground,
      ),
    );
  }
}

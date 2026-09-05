import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import 'pos_header.dart';

/// The app frame: one 64 dp header row and the screen beneath it. No
/// bottom navigation — pos_web's screens are reached from the floor.
class PosShell extends StatelessWidget {
  final Widget child;

  const PosShell({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    return Scaffold(
      backgroundColor: theme.colors.background,
      body: Column(
        children: [
          const PosHeader(),
          Expanded(child: child),
        ],
      ),
    );
  }
}

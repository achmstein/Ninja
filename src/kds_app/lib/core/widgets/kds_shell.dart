import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import 'kds_header.dart';

/// The app frame: one 64 dp header row and the board beneath it. Nothing
/// else — kds_web has no navigation either.
class KdsShell extends StatelessWidget {
  final Widget child;

  const KdsShell({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    return Scaffold(
      backgroundColor: theme.colors.background,
      body: Column(
        children: [
          const KdsHeader(),
          Expanded(child: child),
        ],
      ),
    );
  }
}

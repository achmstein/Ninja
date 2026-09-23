import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import 'heading.dart';
import 'info_tip.dart';

/// A group of settings the way the rest of the till lists things: a small
/// uppercase label over one bordered list, rows split by hairlines.
class SettingsSection extends StatelessWidget {
  final String title;
  final List<Widget> children;

  const SettingsSection({super.key, required this.title, required this.children});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsetsDirectional.only(start: 4, bottom: 8),
          child: Heading(title),
        ),
        Container(
          decoration: BoxDecoration(
            color: theme.colors.background,
            border: Border.all(color: theme.colors.border),
            borderRadius: BorderRadius.circular(14),
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (final (index, child) in children.indexed) ...[
                if (index > 0) Container(height: 1, color: theme.colors.border),
                child,
              ],
            ],
          ),
        ),
      ],
    );
  }
}

/// One setting: what it is and where it stands on the start side, its
/// control on the end side. The same sizes as a list row anywhere else in
/// the till: the title at base weight 500, the detail small and muted.
class SettingsRow extends StatelessWidget {
  final String title;
  final String? hint;
  final String? subtitle;
  final Color? subtitleColor;
  final Widget? trailing;

  /// A tap anywhere on the row, for a row whose control is a switch
  final VoidCallback? onPress;

  const SettingsRow({super.key, required this.title, this.hint, this.subtitle, this.subtitleColor, this.trailing, this.onPress});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final row = Container(
      constraints: const BoxConstraints(minHeight: 64),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Flexible(child: Text(title, style: theme.typography.base.copyWith(fontWeight: FontWeight.w500))),
                    if (hint != null) ...[const SizedBox(width: 4), InfoTip(text: hint!)],
                  ],
                ),
                if (subtitle != null && subtitle!.isNotEmpty)
                  Text(subtitle!, style: theme.typography.sm.copyWith(color: subtitleColor ?? theme.colors.mutedForeground)),
              ],
            ),
          ),
          if (trailing != null) ...[const SizedBox(width: 12), trailing!],
        ],
      ),
    );
    return onPress == null ? row : FTappable(onPress: onPress, child: row);
  }
}

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../brand/brand_style.dart';
import '../theme/ninja_theme.dart';
import 'ninja_button.dart';

/// A page's head in the Ninja style: its name large and heavy at the start,
/// the page's own actions (round, muted) at the end, and on a page pushed
/// from a tab a round way back before the name
class PageHeader extends StatelessWidget {
  final String title;
  final List<Widget> actions;

  /// A page pushed over a tab: a way back before the name
  final bool back;
  final VoidCallback? onBack;

  const PageHeader({super.key, required this.title, this.actions = const [], this.back = false, this.onBack});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final rtl = Directionality.of(context) == TextDirection.rtl;
    return Padding(
      padding: const EdgeInsetsDirectional.fromSTEB(16, 12, 16, 8),
      child: Row(
        children: [
          if (back) ...[
            NinjaIconButton(
              onPress: onBack ?? () => context.canPop() ? context.pop() : context.go('/menu'),
              semanticLabel: MaterialLocalizations.of(context).backButtonTooltip,
              child: Icon(rtl ? LucideIcons.arrowRight : LucideIcons.arrowLeft),
            ),
            const SizedBox(width: 12),
          ],
          Expanded(
            child: BrandHeading(
              title,
              style: theme.typography.title.copyWith(color: theme.colors.foreground),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          for (final (i, action) in actions.indexed) ...[if (i > 0) const SizedBox(width: 8), action],
        ],
      ),
    );
  }
}

/// One of a page head's actions: an icon in a round, muted button
class HeaderAction extends StatelessWidget {
  final Widget icon;
  final VoidCallback? onPress;
  final String? semanticLabel;

  const HeaderAction({super.key, required this.icon, this.onPress, this.semanticLabel});

  @override
  Widget build(BuildContext context) => NinjaIconButton(onPress: onPress, semanticLabel: semanticLabel, child: icon);
}

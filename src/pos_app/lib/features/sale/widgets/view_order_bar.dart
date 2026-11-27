import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import '../../../core/models/money.dart';
import '../../../core/theme/type_roles.dart';
import '../../../l10n/app_localizations.dart';

/// The phone's way to the order: always on screen under the menu, reading
/// how many items are new in it and what it comes to
class ViewOrderBar extends StatelessWidget {
  final int count;
  final double total;
  final VoidCallback onPress;

  const ViewOrderBar({super.key, required this.count, required this.total, required this.onPress});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    return Container(
      padding: EdgeInsets.fromLTRB(8, 8, 8, 8 + MediaQuery.paddingOf(context).bottom),
      decoration: BoxDecoration(border: Border(top: BorderSide(color: theme.colors.border))),
      child: SizedBox(
        height: Sizes.controlLarge,
        child: FButton(
          onPress: onPress,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          suffix: Text(money(context, total),
              style: theme.type.mainAction.copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (count > 0) ...[
                Container(
                  constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: theme.colors.primaryForeground,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Text(
                    '$count',
                    style: theme.type.detail.copyWith(
                      color: theme.colors.primary,
                      fontWeight: FontWeight.w600,
                      fontFeatures: const [FontFeature.tabularFigures()],
                    ),
                  ),
                ),
                const SizedBox(width: 8),
              ],
              Text(l10n.viewOrder, style: theme.type.button.copyWith(fontWeight: FontWeight.w600)),
            ],
          ),
        ),
      ),
    );
  }
}

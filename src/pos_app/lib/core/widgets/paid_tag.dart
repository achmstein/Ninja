import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/theme/app_theme.dart';
import '../../l10n/app_localizations.dart';
import '../theme/type_roles.dart';

/// Paid for by a part payment while the bill is open: said beside the line,
/// wherever a bill's lines are listed (the order, the bill, the payment page)
class PaidTag extends StatelessWidget {
  const PaidTag({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final emerald = AppColors.emerald(theme.colors.brightness);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 1),
      decoration: BoxDecoration(
        color: emerald.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(AppLocalizations.of(context)!.paidTag,
          style: theme.type.caption.copyWith(fontWeight: FontWeight.w600, color: emerald)),
    );
  }
}

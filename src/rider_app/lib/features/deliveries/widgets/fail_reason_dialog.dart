import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/theme/text_styles.dart';
import '../../../l10n/app_localizations.dart';

/// Why a delivery could not be handed over, as the server keeps it: a stable
/// code the till shows in its own language, never the rider's words
enum FailReason {
  noAnswer('NoAnswer'),
  refused('Refused'),
  wrongAddress('WrongAddress'),
  other('Other');

  final String code;

  const FailReason(this.code);

  String label(AppLocalizations l10n) => switch (this) {
        noAnswer => l10n.failReasonNoAnswer,
        refused => l10n.failReasonRefused,
        wrongAddress => l10n.failReasonWrongAddress,
        other => l10n.failReasonOther,
      };
}

/// The rider could not hand it over: one big button per reason, and a way
/// out. Resolves to the reason, or null when the rider thought better of it.
Future<FailReason?> showFailReasonDialog(BuildContext context) {
  final l10n = AppLocalizations.of(context)!;
  return showFDialog<FailReason>(
    context: context,
    useRootNavigator: true,
    builder: (context, style, animation) => FDialog.raw(
      style: style,
      animation: animation,
      constraints: const BoxConstraints(maxWidth: 448),
      builder: (context, _) {
        final theme = context.theme;
        return Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(l10n.couldNotDeliverTitle, style: theme.typography.xl.copyWith(fontWeight: FontWeight.w600)),
              const SizedBox(height: 6),
              Text(l10n.couldNotDeliverHint, style: theme.typography.base.copyWith(color: theme.colors.mutedForeground)),
              const SizedBox(height: 16),
              for (final reason in FailReason.values) ...[
                SizedBox(
                  height: 52,
                  child: FButton(
                    variant: FButtonVariant.outline,
                    onPress: () => Navigator.of(context, rootNavigator: true).pop(reason),
                    child: Text(reason.label(l10n), style: theme.typography.base.forButton),
                  ),
                ),
                const SizedBox(height: 8),
              ],
              SizedBox(
                height: 48,
                child: FButton(
                  variant: FButtonVariant.ghost,
                  onPress: () => Navigator.of(context, rootNavigator: true).pop(),
                  child: Text(l10n.cancel, style: theme.typography.base.forButton),
                ),
              ),
            ],
          ),
        );
      },
    ),
  );
}

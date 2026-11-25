import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import '../../../core/widgets/rider_sheet.dart';
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

/// The rider could not hand it over: one big button per reason, from the
/// foot of the screen, and a way out. Resolves to the reason, or null when
/// the rider thought better of it.
Future<FailReason?> showFailReasonDialog(BuildContext context) {
  final l10n = AppLocalizations.of(context)!;
  return showRiderSheet<FailReason>(
    context,
    title: l10n.couldNotDeliverTitle,
    description: l10n.couldNotDeliverHint,
    actions: (context) => [
      for (final reason in FailReason.values)
        SheetButton(
          label: reason.label(l10n),
          variant: FButtonVariant.outline,
          onPress: () => Navigator.of(context, rootNavigator: true).pop(reason),
        ),
      SheetButton(
        label: l10n.cancel,
        variant: FButtonVariant.ghost,
        onPress: () => Navigator.of(context, rootNavigator: true).pop(),
      ),
    ],
  );
}

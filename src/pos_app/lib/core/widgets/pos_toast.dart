import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import '../../l10n/app_localizations.dart';
import '../theme/app_theme.dart';

enum PosToastType { success, error, info, warning }

/// Toasts as pos_web shows them: a short status title on the pill, the
/// specific message beneath it, top centre so nothing on the floor or the
/// settle dialog is covered.
void showPosToast(
  BuildContext context,
  PosToastType type,
  String message, {
  String? description,
}) {
  final l10n = AppLocalizations.of(context)!;
  final theme = context.theme;

  final (title, icon, color) = switch (type) {
    PosToastType.success => (l10n.toastSuccess, FIcons.circleCheck, AppColors.emerald600),
    PosToastType.error => (l10n.toastError, FIcons.circleX, theme.colors.destructive),
    PosToastType.info => (l10n.toastInfo, FIcons.bell, theme.colors.foreground),
    PosToastType.warning => (l10n.toastWarning, FIcons.clock, AppColors.amber600),
  };

  final hasDescription = description != null;
  showFToast(
    context: context,
    alignment: FToastAlignment.topCenter,
    icon: Icon(icon, size: 20, color: color),
    title: Text(hasDescription ? message : title),
    description: Text(hasDescription ? description : message),
  );
}

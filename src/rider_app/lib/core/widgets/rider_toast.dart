import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import '../../l10n/app_localizations.dart';
import 'package:ninja_app_core/theme/app_theme.dart';

enum RiderToastType { success, error, info, warning }

/// Toasts as kds_web shows them: a short status title on the pill, the
/// specific message beneath it, top centre so no lane is covered.
void showRiderToast(
  BuildContext context,
  RiderToastType type,
  String message, {
  String? description,
}) {
  final l10n = AppLocalizations.of(context)!;
  final theme = context.theme;

  final (title, icon, color) = switch (type) {
    RiderToastType.success => (l10n.toastSuccess, FIcons.circleCheck, AppColors.emerald600),
    RiderToastType.error => (l10n.toastError, FIcons.circleX, theme.colors.destructive),
    RiderToastType.info => (l10n.toastInfo, FIcons.bell, theme.colors.foreground),
    RiderToastType.warning => (l10n.toastWarning, FIcons.clock, AppColors.amber600),
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

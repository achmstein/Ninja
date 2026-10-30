import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import 'package:ninja_app_core/widgets/app_text.dart';

void showSuccessToast(BuildContext context, String message) {
  showFToast(
    context: context,
    icon: const Icon(Icons.check_circle, color: Color(0xFF22C55E), size: Sizes.icon),
    title: AppText(message),
  );
}

void showErrorToast(BuildContext context, String message) {
  showFToast(
    context: context,
    icon: const Icon(Icons.cancel, color: Color(0xFFEF4444), size: Sizes.icon),
    title: AppText(message),
  );
}

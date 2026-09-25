import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../../../core/brand/brand_provider.dart';
import '../../../core/config/app_config.dart';
import '../../../core/models/dates.dart';
import '../../../core/theme/text_styles.dart';
import '../../../core/utils/whatsapp.dart';
import '../../../core/widgets/pos_dialog.dart';
import '../../../core/widgets/toast_helpers.dart';
import '../../../l10n/app_localizations.dart';
import '../services/customer_search_service.dart';

/// Where customers open the menu: the brand's customer host, else the
/// café's API host when provisioning has not said (the till has no page
/// origin of its own to fall back on, as pos_web does).
String customerOrigin(WidgetRef ref) {
  final url = ref.read(brandProvider).customerUrl;
  if (url != null) return url;
  final api = Uri.parse(AppConfig.bffBaseUrl);
  return api.origin;
}

/// Issues a one-time link for a counter customer and shows it: a QR the
/// customer scans at the counter, or a WhatsApp message to their number.
/// The link lets them set an email and a password on this same account,
/// once, within half an hour.
Future<void> sendAppLink(BuildContext context, WidgetRef ref, {required String id, required String name, String? phone}) async {
  final l10n = AppLocalizations.of(context)!;
  final ClaimLink link;
  try {
    link = await ref.read(counterCustomerServiceProvider).claimLink(id);
  } on ClaimLinkException catch (e) {
    if (context.mounted) {
      showErrorToast(context, switch (e.reason) {
        ClaimLinkRefusal.alreadyHasAccount => l10n.alreadyHasAccount,
        ClaimLinkRefusal.tooMany => l10n.tooManyLinks,
        ClaimLinkRefusal.failed => l10n.somethingWentWrong,
      });
    }
    return;
  }
  if (!context.mounted) return;
  final url = link.url(customerOrigin(ref)).toString();
  await showPosDialog<void>(
    context,
    builder: (context) => _AppLinkDialog(name: name, phone: phone, url: url, expiresAt: link.expiresAt),
  );
}

class _AppLinkDialog extends ConsumerWidget {
  final String name;
  final String? phone;
  final String url;
  final DateTime expiresAt;
  const _AppLinkDialog({required this.name, required this.phone, required this.url, required this.expiresAt});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final muted = theme.typography.sm.copyWith(color: theme.colors.mutedForeground);
    final brand = ref.watch(brandProvider);
    final cafe = brand.displayName(Localizations.localeOf(context));
    final message = l10n.appLinkMessage(name, cafe, url);

    return DialogScroll(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(l10n.appLinkTitle(name), style: theme.typography.xl.copyWith(fontWeight: FontWeight.w600)),
          const SizedBox(height: 4),
          Text(l10n.appLinkHint, style: muted),
          const SizedBox(height: 16),
          Center(
            // White behind the code whatever the theme: phone cameras read dark on light
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
              child: QrImageView(data: url, size: 220, backgroundColor: Colors.white),
            ),
          ),
          const SizedBox(height: 8),
          Text(l10n.appLinkUntil(formatTime(context, expiresAt)), textAlign: TextAlign.center, style: muted),
          const SizedBox(height: 16),
          if (phone case final number? when number.isNotEmpty) ...[
            SizedBox(
              height: 48,
              child: FButton(
                onPress: () => openWhatsApp(number, country: brand.locale.country, text: message),
                prefix: const Icon(FIcons.messageCircle, size: 18),
                child: Text(l10n.sendOnWhatsApp, style: theme.typography.base.forButton),
              ),
            ),
            const SizedBox(height: 8),
          ],
          SizedBox(
            height: 48,
            child: FButton(
              variant: FButtonVariant.outline,
              onPress: () async {
                await Clipboard.setData(ClipboardData(text: url));
                if (context.mounted) showSuccessToast(context, l10n.linkCopied);
              },
              prefix: const Icon(FIcons.copy, size: 18),
              child: Text(l10n.copyLink, style: theme.typography.base.forButton),
            ),
          ),
          const SizedBox(height: 8),
          SizedBox(
            height: 48,
            child: FButton(
              variant: FButtonVariant.ghost,
              onPress: () => Navigator.of(context, rootNavigator: true).pop(),
              child: Text(l10n.done, style: theme.typography.base.forButton),
            ),
          ),
        ],
      ),
    );
  }
}

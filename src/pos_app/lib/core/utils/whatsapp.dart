import 'package:url_launcher/url_launcher.dart';

/// A WhatsApp link for a phone as customers type it here: an Egyptian
/// mobile (01xxxxxxxxx) gets its country code, an international one keeps
/// its own. wa.me opens the chat in the WhatsApp app, nothing to integrate:
/// staff message the customer from their own account.
Uri whatsAppLink(String phone) {
  final digits = phone.replaceAll(RegExp(r'\D'), '');
  final international = digits.length == 11 && digits.startsWith('0')
      ? '20${digits.substring(1)}'
      : digits.startsWith('00')
          ? digits.substring(2)
          : digits;
  return Uri.parse('https://wa.me/$international');
}

Future<void> openWhatsApp(String phone) =>
    launchUrl(whatsAppLink(phone), mode: LaunchMode.externalApplication);

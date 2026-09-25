import 'package:url_launcher/url_launcher.dart';
import 'phone.dart';

/// A WhatsApp link for a phone as customers type it here: a local mobile
/// gets the café's country code (Egypt when the country is not said), an
/// international one keeps its own. wa.me opens the chat in the WhatsApp
/// app, nothing to integrate: staff message the customer from their own
/// account. [text] pre-fills the message.
Uri whatsAppLink(String phone, {String country = 'EG', String? text}) {
  final number = whatsAppNumber(phone, country);
  return Uri.parse('https://wa.me/$number${text == null ? '' : '?text=${Uri.encodeComponent(text)}'}');
}

Future<void> openWhatsApp(String phone, {String country = 'EG', String? text}) =>
    launchUrl(whatsAppLink(phone, country: country, text: text), mode: LaunchMode.externalApplication);

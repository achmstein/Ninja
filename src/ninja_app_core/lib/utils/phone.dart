import 'package:phone_numbers_parser/metadata.dart';
import 'package:phone_numbers_parser/phone_numbers_parser.dart';

/// Phone numbers as a cashier or a customer types them, a phone autofills them or a contact
/// book saved them. The same rule as the server's PhoneRules
/// (src/Ninja.ServiceDefaults/PhoneRules.cs), on the same numbering plans
/// (libphonenumber's, here through phone_numbers_parser): a number is read
/// against the business's country however it is spelled — Arabic-Indic
/// digits, spaces, dashes and brackets, a 00 or a +0 for the plus, the
/// country's own code or a missing trunk 0 — and sent and kept in the one
/// international form, +201012345678. Screens show it the local way.

/// What was typed with only what a number is made of: digits read as 0-9, a
/// leading plus kept and a 00 prefix read as one. Empty when there are none.
String _clean(String? input) {
  if (input == null) return '';
  var plus = false;
  final digits = StringBuffer();
  for (final rune in input.trim().runes) {
    if (rune >= 0x30 && rune <= 0x39) {
      digits.writeCharCode(rune);
    } else if (rune >= 0x0660 && rune <= 0x0669) {
      digits.writeCharCode(0x30 + rune - 0x0660); // ٠-٩
    } else if (rune >= 0x06F0 && rune <= 0x06F9) {
      digits.writeCharCode(0x30 + rune - 0x06F0); // ۰-۹
    } else if ((rune == 0x2B || rune == 0xFF0B) && digits.isEmpty) {
      plus = true;
    }
  }
  var number = digits.toString();
  if (number.isEmpty) return '';
  if (!plus && number.startsWith('00')) {
    plus = true;
    number = number.substring(2);
  }
  return plus ? '+$number' : number;
}

IsoCode? _region(String country) => IsoCode.values.asNameMap()[country.trim().toUpperCase()];

PhoneNumber? _parse(String text, IsoCode? home) {
  try {
    return text.startsWith('+')
        ? PhoneNumber.parse(text)
        : home == null
            ? null
            : PhoneNumber.parse(text, destinationCountry: home);
  } catch (_) {
    return null;
  }
}

/// The number the text spells when it spells a real one of the kind asked
/// for: read against the business's country, or against its own country code
/// when it carries one.
PhoneNumber? _read(String? input, String country, {PhoneNumberType? type}) {
  var text = _clean(input);
  if (text.isEmpty) return null;
  final home = _region(country);
  // +020…, as some forms and contact books write +20: no country code starts with a zero
  if (text.startsWith('+')) text = '+${text.substring(1).replaceFirst(RegExp(r'^0+'), '')}';

  final number = _parse(text, home);
  if (number != null && number.isValid(type: type)) return number;

  // +20 010…, 20 10…: the country's own code in front of a number written the local way
  if (home != null) {
    final digits = text.replaceFirst('+', '');
    final code = PhoneNumber(isoCode: home, nsn: '').countryCode;
    if (digits.length > code.length && digits.startsWith(code)) {
      final local = _parse(digits.substring(code.length), home);
      if (local != null && local.isValid(type: type)) return local;
    }
  }
  return null;
}

/// Whether this is a customer's number here: a mobile of the business's
/// country, in any spelling.
bool isValidPhone(String? input, String country) {
  final number = _read(input, country, type: PhoneNumberType.mobile);
  if (number == null) return false;
  final home = _region(country);
  return home == null || number.isoCode == home;
}

/// The number in the one form it is sent and kept in (+201012345678) when it
/// is a customer's number here; otherwise what was typed without its
/// separators, which the server will refuse. Empty when nothing number-like
/// was typed.
String normalizePhone(String? input, String country) => isValidPhone(input, country)
    ? _read(input, country, type: PhoneNumberType.mobile)!.international
    : _clean(input);

/// A kept number as people here write it: 010 12345678 for one of the
/// business's country, +44 7400 123456 for one from abroad. What is not a
/// number (a hotline's 19019, a note) is shown as it is.
String formatPhone(String? stored, String country) {
  final text = stored?.trim() ?? '';
  final number = _read(text, country);
  if (number == null) return text;
  if (number.isoCode != _region(country)) {
    return '+${number.countryCode} ${number.formatNsn(format: NsnFormat.international)}';
  }
  // The trunk zero people here dial and write (010…, 05…), which the library's grouping leaves off
  final trunk = metadataByIsoCode[number.isoCode]?.nationalPrefix == '0' ? '0' : '';
  return '$trunk${number.formatNsn()}';
}

/// The business's country, kept in step with its brand by the app's root: what
/// a kept number is shown against wherever one is drawn.
String phoneCountry = 'EG';

/// A kept number as people here write it (see [formatPhone]), for showing.
/// It comes inside a left-to-right isolate (U+2066 … U+2069): a number is all
/// digits and spaces, which have no direction of their own, so in an Arabic
/// line its groups would otherwise swap places (12345678 010). A first-strong
/// isolate does not do: with no letter to go by it takes the line's direction.
/// For a field's text or text that is searched use [plainPhone].
String showPhone(String? stored) {
  final shown = formatPhone(stored, phoneCountry);
  return shown.isEmpty ? shown : '\u2066$shown\u2069';
}

/// The same number bare.
String plainPhone(String? stored) => formatPhone(stored, phoneCountry);

/// How many digits were typed, whatever the script
int phoneDigitCount(String input) => _clean(input).replaceAll('+', '').length;

/// Whether the search text reads as a phone number rather than a name
bool looksLikePhone(String input) {
  final digits = phoneDigitCount(input);
  final letters = input.replaceAll(RegExp(r'[\s\-+().]'), '').length;
  return digits >= 2 && digits >= letters - 1;
}

/// The digits wa.me wants: the number with its country code, no plus
String whatsAppNumber(String phone, String country) =>
    (_read(phone, country)?.international ?? _clean(phone)).replaceAll('+', '');

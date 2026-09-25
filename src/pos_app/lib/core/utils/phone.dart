/// A phone number as a cashier types it, in the one form the tenant's
/// country writes it — the same rules as the server's PhoneRules.Normalize,
/// so the live check and the 409 agree: Arabic-Indic digits read as 0-9,
/// spaces, dashes, dots and brackets dropped, a 00 prefix read as +, the
/// country's own code (+20, +966, +971) or a missing trunk 0 turned back
/// into the local 0-prefixed number. Anywhere else an international number
/// keeps its plus. Empty when nothing number-like was typed.
String normalizePhone(String? input, String country) {
  if (input == null || input.trim().isEmpty) return '';
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

  final rule = _rules[country.toUpperCase()];
  if (rule == null) return plus ? '+$number' : number;

  // +20 10…, 20 10…, +20 010… → 010…
  if (number.startsWith(rule.code) && (plus || number.length >= rule.code.length + rule.localLength)) {
    var rest = number.substring(rule.code.length);
    if (rest.startsWith('0')) rest = rest.substring(1);
    return '0$rest';
  }
  // 10… typed without its trunk zero
  if (!plus && number.length == rule.localLength && number[0] == rule.mobileStart) return '0$number';
  return plus ? '+$number' : number;
}

/// How many digits were typed, whatever the script
int phoneDigitCount(String input) => normalizePhone(input, '').replaceAll('+', '').length;

/// Whether the search text reads as a phone number rather than a name
bool looksLikePhone(String input) {
  final digits = phoneDigitCount(input);
  final letters = input.replaceAll(RegExp(r'[\s\-+().]'), '').length;
  return digits >= 2 && digits >= letters - 1;
}

/// The digits wa.me wants: the number with its country code, no plus
String whatsAppNumber(String phone, String country) {
  final normalized = normalizePhone(phone, country);
  if (normalized.startsWith('+')) return normalized.substring(1);
  final rule = _rules[country.toUpperCase()];
  if (rule != null && normalized.startsWith('0')) return '${rule.code}${normalized.substring(1)}';
  // An Egyptian mobile from a till whose country is not known
  if (normalized.length == 11 && normalized.startsWith('01')) return '20${normalized.substring(1)}';
  return normalized;
}

class _Rule {
  final String code;
  final int localLength;
  final String mobileStart;
  const _Rule(this.code, this.localLength, this.mobileStart);
}

const _rules = {
  'EG': _Rule('20', 10, '1'),
  'SA': _Rule('966', 9, '5'),
  'AE': _Rule('971', 9, '5'),
};

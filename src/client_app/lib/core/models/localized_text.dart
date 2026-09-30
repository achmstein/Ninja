import 'package:flutter/widgets.dart';

/// Text the café writes in its own languages: English, Arabic or both.
/// A café that works in one language fills only that side and the other is
/// null, so each side means what its name says. Reading answers in the asked
/// language and falls back to the other one; an empty side counts as missing.
class LocalizedText {
  /// English text; null when the café writes this in Arabic only
  final String? en;

  /// Arabic text; null when the café writes this in English only
  final String? ar;

  const LocalizedText({this.en, this.ar});

  /// Create from JSON map; a blank side is null
  factory LocalizedText.fromJson(Map<String, dynamic> json) {
    return LocalizedText(en: _clean(json['en']), ar: _clean(json['ar']));
  }

  /// A text whose language nobody said (a raw name, a till account): Arabic
  /// script goes to [ar], anything else to [en]
  factory LocalizedText.fromString(String text) {
    final clean = _clean(text);
    return _hasArabic(clean) ? LocalizedText(ar: clean) : LocalizedText(en: clean);
  }

  /// Parse from dynamic value — handles JSON object, plain string, or null.
  /// With [arValue] the string is the English side and [arValue] the Arabic;
  /// a lone string of unknown language goes to the side of its script.
  static LocalizedText parse(dynamic value, [String? arValue]) {
    if (value is Map<String, dynamic>) {
      return LocalizedText.fromJson(value);
    }
    final text = value?.toString();
    if (arValue != null) {
      return LocalizedText(en: _clean(text), ar: _clean(arValue));
    }
    return LocalizedText.fromString(text ?? '');
  }

  /// Parse nullable value
  static LocalizedText? parseNullable(dynamic value) {
    if (value == null) return null;
    return parse(value);
  }

  /// Convert to JSON map; a missing side is left out
  Map<String, dynamic> toJson() {
    return {
      if (_clean(en) != null) 'en': _clean(en),
      if (_clean(ar) != null) 'ar': _clean(ar),
    };
  }

  /// Neither language is written
  bool get isEmpty => _clean(en) == null && _clean(ar) == null;

  /// English when there is English, else the Arabic; '' when empty. For keys,
  /// logs and ordering.
  String get primary => _clean(en) ?? _clean(ar) ?? '';

  /// The text in the locale's language, else in the other one; '' when empty.
  String getText(Locale locale) => inLanguage(locale.languageCode);

  /// The text in [languageCode] ('ar', 'en'), else in the other one; '' when empty.
  String inLanguage(String languageCode) {
    final english = _clean(en);
    final arabic = _clean(ar);
    if (languageCode == 'ar') return arabic ?? english ?? '';
    return english ?? arabic ?? '';
  }

  /// Get text based on the current locale from context
  String getLocalizedText(BuildContext context) {
    final locale = Localizations.localeOf(context);
    return getText(locale);
  }

  /// True when either language contains [query], ignoring case.
  bool contains(String query) {
    final q = query.toLowerCase();
    return (en?.toLowerCase().contains(q) ?? false) || (ar?.toLowerCase().contains(q) ?? false);
  }

  static String? _clean(Object? value) {
    if (value is! String) return null;
    final trimmed = value.trim();
    return trimmed.isEmpty ? null : trimmed;
  }

  static bool _hasArabic(String? text) =>
      text != null && RegExp(r'[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]').hasMatch(text);

  @override
  String toString() => primary;

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is LocalizedText && other.en == en && other.ar == ar;
  }

  @override
  int get hashCode => (en?.hashCode ?? 0) ^ (ar?.hashCode ?? 0);
}

/// Extension to easily get localized text from context
extension LocalizedTextExtension on LocalizedText {
  /// Get the appropriate text based on current locale
  String localized(BuildContext context) => getLocalizedText(context);
}

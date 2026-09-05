import 'package:flutter/widgets.dart';

/// Value object for text that supports multiple languages.
/// Used for content that needs to be displayed in both English and Arabic.
class LocalizedText {
  /// English text (default)
  final String en;

  /// Arabic text
  final String? ar;

  const LocalizedText({required this.en, this.ar});

  /// Create from JSON map
  factory LocalizedText.fromJson(Map<String, dynamic> json) {
    return LocalizedText(
      en: json['en'] as String? ?? '',
      ar: json['ar'] as String?,
    );
  }

  /// Create from a simple string (English only)
  factory LocalizedText.fromString(String text) {
    return LocalizedText(en: text);
  }

  /// Parse from dynamic value - handles both string and object formats
  static LocalizedText parse(dynamic value) {
    if (value is String) {
      return LocalizedText.fromString(value);
    } else if (value is Map<String, dynamic>) {
      return LocalizedText.fromJson(value);
    }
    return LocalizedText(en: value?.toString() ?? '');
  }

  /// Parse nullable value
  static LocalizedText? parseNullable(dynamic value) {
    if (value == null) return null;
    return parse(value);
  }

  /// Convert to JSON map
  Map<String, dynamic> toJson() {
    return {
      'en': en,
      if (ar != null) 'ar': ar,
    };
  }

  /// Get the text for the specified locale.
  /// Falls back to English if the requested language is not available.
  String getText(Locale locale) {
    if (locale.languageCode == 'ar' && ar != null) {
      return ar!;
    }
    return en;
  }

  /// Get text based on the current locale from context
  String getLocalizedText(BuildContext context) {
    final locale = Localizations.localeOf(context);
    return getText(locale);
  }

  @override
  String toString() => en;

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is LocalizedText && other.en == en && other.ar == ar;
  }

  @override
  int get hashCode => en.hashCode ^ (ar?.hashCode ?? 0);
}

/// Extension to easily get localized text from context
extension LocalizedTextExtension on LocalizedText {
  /// Get the appropriate text based on current locale
  String localized(BuildContext context) => getLocalizedText(context);
}

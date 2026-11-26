import 'package:flutter/widgets.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/theme/app_theme.dart' show getFontFamily;

/// The till's seven text roles, the same seven as pos_web's `type-*`
/// utilities (see docs/type.md). A piece of text says what it IS and takes
/// its size, weight and line height from that:
///
/// ```dart
/// Text(name, style: theme.type.heading)
/// Text(phone, style: theme.type.detail.copyWith(color: theme.colors.mutedForeground))
/// ```
///
/// A role never chooses a colour: each starts from the theme's own text style
/// (the foreground colour and the language's font, Alexandria for Arabic and
/// Inter otherwise), so colour is added with `copyWith(color: …)` as before.
///
/// These are the till's own. The shared `TypeRoles` of ninja_app_core
/// (`theme.typography.title` and the rest) is the older six-step scale the
/// kitchen display and the rider app are drawn with; the till does not use it.
extension type const TillType(FTypography _typography) {
  static const List<FontFeature> tabular = [FontFeature.tabularFigures()];

  TextStyle _role(double size, double line, FontWeight weight) =>
      _typography.base.copyWith(fontSize: size, height: line / size, fontWeight: weight);

  /// Arabic letters join: spacing them apart breaks the word
  bool get _arabic => _typography.base.fontFamily == getFontFamily(const Locale('ar'));

  /// 20 / 28 bold: the name of a screen, a panel or a dialog. One per surface.
  TextStyle get title => _role(20, 28, FontWeight.w700);

  /// 16 / 24 semibold: a part's heading inside a surface; the name that leads a row
  TextStyle get heading => _role(16, 24, FontWeight.w600);

  /// 16 / 24: what is read and typed: rows, fields, sentences
  TextStyle get body => _role(16, 24, FontWeight.w400);

  /// 14 / 20: a row's second line, a dense list, what stands beside the main thing
  TextStyle get detail => _role(14, 20, FontWeight.w400);

  /// 12 / 20: a hint, a count, a time. Nothing on the till is smaller.
  TextStyle get caption => _role(12, 20, FontWeight.w400);

  /// 12 / 20 semibold, letter-spaced: a quiet name over a group. Its words go
  /// in capitals where the script has them: show it with [TypeLabel], or pass
  /// the words through [labelCase].
  TextStyle get label => _role(12, 20, FontWeight.w600).copyWith(letterSpacing: _arabic ? 0 : 0.3);

  /// 24 / 32 bold, tabular figures: the one figure a surface is about (a total, a clock)
  TextStyle get figure => _role(24, 32, FontWeight.w700).copyWith(fontFeatures: tabular);

  // ----- controls: a button's words go with its height, not with a role -----
  // None of the three carries a colour: the button decides it (white on
  // primary, foreground on outline).

  /// 16: the words of an ordinary button (44–48 high). The button gives the weight.
  TextStyle get button => _control(16, 24, null);

  /// 14: the words of a small button or a chip (40 high)
  TextStyle get buttonSmall => _control(14, 20, null);

  /// 18 semibold: the words of the screen's one main action (56 high)
  TextStyle get mainAction => _control(18, 28, FontWeight.w600);

  TextStyle _control(double size, double line, FontWeight? weight) => TextStyle(
        fontFamily: _typography.base.fontFamily,
        fontFamilyFallback: _typography.base.fontFamilyFallback,
        fontSize: size,
        height: line / size,
        fontWeight: weight,
      );
}

extension TillTypeTheme on FThemeData {
  /// The till's text roles: `theme.type.title`, `.heading`, `.body`,
  /// `.detail`, `.caption`, `.label`, `.figure`
  TillType get type => TillType(typography);
}

extension TillTypeContext on BuildContext {
  /// The till's text roles, straight from the context: `context.type.body`
  TillType get type => theme.type;
}

/// A label's words: capitals for Latin text. Arabic has no capitals, so it
/// comes back as it went in.
String labelCase(String text) => text.toUpperCase();

/// A quiet name over a group ("New", "Sent", "Recent"): the label role, in
/// capitals where the script has them.
class TypeLabel extends StatelessWidget {
  final String text;

  /// Muted unless told otherwise
  final Color? color;

  const TypeLabel(this.text, {super.key, this.color});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    return Text(
      labelCase(text),
      // Read out as written, not letter by letter
      semanticsLabel: text,
      style: theme.type.label.copyWith(color: color ?? theme.colors.mutedForeground),
    );
  }
}

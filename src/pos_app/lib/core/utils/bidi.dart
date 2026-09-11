import 'package:flutter/widgets.dart';
import 'package:intl/intl.dart' show Bidi;

/// Wraps [text] in a Unicode first-strong isolate (U+2068 … U+2069) so it
/// is laid out as its own directional unit. A number appended to a
/// mixed-script name (an Arabic room name ending in "VIP", then "#12")
/// otherwise fuses with the Latin word into one left-to-right block, and
/// in an Arabic line the number lands between the two words.
String bidiIsolate(String text) => '\u2068$text\u2069';

/// The direction a [Text] should lay [text] out in: its own script's, as
/// its first strong character says. Most customer names are English while
/// the till runs in Arabic; laid out in the Arabic line's direction, a long
/// English name is cut at its START (the ellipsis lands on the left). In its
/// own direction it reads and truncates the way its writer expects.
TextDirection textDirectionFor(String text) => Bidi.startsWithRtl(text) ? TextDirection.rtl : TextDirection.ltr;

/// Where [text], laid out in its own direction, should sit inside the
/// ambient line: at the ambient start. With [textDirectionFor] the text
/// widget aligns to its own start, which for an English name in an Arabic
/// card is the far side from the icon; this pins it back.
TextAlign textAlignFor(BuildContext context) =>
    Directionality.of(context) == TextDirection.rtl ? TextAlign.right : TextAlign.left;

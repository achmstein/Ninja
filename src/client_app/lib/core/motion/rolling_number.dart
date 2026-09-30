import 'package:flutter/widgets.dart';
import 'motion.dart';

/// A figure that rolls to its new value like an odometer: only the digits
/// that changed move, up when the value grows and down when it shrinks.
/// [text] is already formatted (`185.00 EGP`); the run from the first digit
/// to the last rolls, anything around it (a currency) sits still. It reads
/// to a screen reader as the whole string.
class RollingNumber extends StatefulWidget {
  final String text;
  final TextStyle? style;

  /// The number behind [text], for the direction of the roll; parsed from
  /// the text when left out
  final double? value;
  final Duration duration;

  const RollingNumber(this.text, {super.key, this.style, this.value, this.duration = Motion.base});

  @override
  State<RollingNumber> createState() => _RollingNumberState();
}

bool _isDigit(int unit) => (unit >= 0x30 && unit <= 0x39) || (unit >= 0x660 && unit <= 0x669);

/// Splits `185.00 EGP` into (``, `185.00`, ` EGP`)
({String prefix, String number, String suffix}) splitNumber(String text) {
  var first = -1;
  var last = -1;
  for (var i = 0; i < text.length; i++) {
    if (_isDigit(text.codeUnitAt(i))) {
      if (first < 0) first = i;
      last = i;
    }
  }
  if (first < 0) return (prefix: text, number: '', suffix: '');
  return (prefix: text.substring(0, first), number: text.substring(first, last + 1), suffix: text.substring(last + 1));
}

double? _parse(String number) {
  final ascii = String.fromCharCodes(number.codeUnits.map((u) => u >= 0x660 && u <= 0x669 ? u - 0x660 + 0x30 : u));
  return double.tryParse(ascii.replaceAll(RegExp(r'[^0-9.\-]'), ''));
}

class _RollingNumberState extends State<RollingNumber> {
  // +1 rolls up (bigger), -1 down
  int _direction = 1;
  // At rest the figure is one plain Text; digit by digit only while it rolls
  bool _rolling = false;
  int _roll = 0;
  // What it said before this roll, so each digit knows where it rolls from
  String _from = '';

  @override
  void didUpdateWidget(RollingNumber old) {
    super.didUpdateWidget(old);
    if (old.text == widget.text) return;
    final before = old.value ?? _parse(splitNumber(old.text).number);
    final after = widget.value ?? _parse(splitNumber(widget.text).number);
    if (before != null && after != null && before != after) _direction = after > before ? 1 : -1;
    // Mid-roll changes roll on from what is showing now
    if (!_rolling) _from = old.text;
    _rolling = true;
    final roll = ++_roll;
    Future<void>.delayed(widget.duration + const Duration(milliseconds: 20), () {
      if (mounted && roll == _roll) setState(() => _rolling = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    final style = DefaultTextStyle.of(context).style.merge(widget.style).copyWith(
      fontFeatures: const [FontFeature.tabularFigures()],
    );
    if (reduceMotion(context)) {
      return AnimatedSwitcher(
        duration: Motion.fast,
        child: Text(widget.text, key: ValueKey(widget.text), style: style),
      );
    }
    if (!_rolling) return Text(widget.text, style: style);
    final parts = splitNumber(widget.text);
    final chars = parts.number.characters.toList();
    final before = splitNumber(_from).number.characters.toList();
    return Semantics(
      label: widget.text,
      excludeSemantics: true,
      child: AnimatedSize(
          duration: Motion.fast,
          curve: Motion.enter,
          alignment: AlignmentDirectional.centerEnd,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (parts.prefix.isNotEmpty) Text(parts.prefix, style: style),
              // Digits always run left to right, whatever the page does
              Directionality(
                textDirection: TextDirection.ltr,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    for (var i = 0; i < chars.length; i++)
                      // Keyed from the right, so the units stay the units
                      // when the figure grows a digit
                      _RollingChar(
                        key: ValueKey(chars.length - i),
                        char: chars[i],
                        from: before.length - (chars.length - i) >= 0 ? before[before.length - (chars.length - i)] : null,
                        style: style,
                        direction: _direction,
                        duration: widget.duration,
                      ),
                  ],
                ),
              ),
              if (parts.suffix.isNotEmpty) Text(parts.suffix, style: style),
            ],
          ),
        ),
    );
  }
}

class _RollingChar extends StatefulWidget {
  final String char;

  /// The digit it rolls from when it first appears
  final String? from;
  final TextStyle style;
  final int direction;
  final Duration duration;

  const _RollingChar({super.key, required this.char, this.from, required this.style, required this.direction, required this.duration});

  @override
  State<_RollingChar> createState() => _RollingCharState();
}

class _RollingCharState extends State<_RollingChar> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: widget.duration, value: 1);
  String? _previous;
  int _direction = 1;

  @override
  void initState() {
    super.initState();
    final from = widget.from;
    if (from != null && from != widget.char) {
      _previous = from;
      _direction = widget.direction;
      _c.forward(from: 0);
    }
  }

  @override
  void didUpdateWidget(_RollingChar old) {
    super.didUpdateWidget(old);
    if (old.char != widget.char) {
      _previous = old.char;
      _direction = widget.direction;
      _c.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final current = Text(widget.char, style: widget.style);
    return AnimatedBuilder(
      animation: _c,
      builder: (context, _) {
        if (_c.isCompleted || _previous == null) return current;
        final t = Motion.enter.transform(_c.value);
        return ClipRect(
          child: Stack(
            alignment: Alignment.center,
            children: [
              // The old digit leaves the way the new one pushes it
              FractionalTranslation(
                translation: Offset(0, -_direction * t * 0.9),
                child: Opacity(opacity: (1 - t * 1.6).clamp(0.0, 1.0), child: Text(_previous!, style: widget.style)),
              ),
              FractionalTranslation(
                translation: Offset(0, _direction * (1 - t) * 0.9),
                child: Opacity(opacity: t.clamp(0.0, 1.0), child: current),
              ),
            ],
          ),
        );
      },
    );
  }
}

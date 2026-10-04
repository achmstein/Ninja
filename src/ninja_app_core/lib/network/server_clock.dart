import 'dart:io' show HttpDate, HttpException;

/// The server's clock, as read from the Date header of its answers. The
/// board's timers count from when the server confirmed an order, so a
/// kitchen screen whose own clock runs a minute behind showed a new order at
/// 0:00 for that minute, and one ahead started it at a minute. Counting
/// against the server's time instead, the clock starts as the card arrives.
class ServerClock {
  /// Recent readings, the server's time less this device's
  final List<Duration> _samples = [];
  static const _keep = 5;
  Duration _offset = Duration.zero;

  /// Takes one answer's Date header; one without (or unreadable) changes nothing.
  void note(String? header, {DateTime? receivedAt}) {
    if (header == null || header.isEmpty) return;
    final DateTime server;
    try {
      server = HttpDate.parse(header);
    } on FormatException {
      return;
    } on HttpException {
      return;
    }
    final received = receivedAt ?? DateTime.now();
    // The header is whole seconds, rounded down: the server's time was within the second after it
    _samples.add(server.add(const Duration(milliseconds: 500)).difference(received));
    if (_samples.length > _keep) _samples.removeAt(0);
    // The middle reading, so one slow answer does not move every timer
    final sorted = [..._samples]..sort();
    final middle = sorted[sorted.length ~/ 2];
    // Under a second apart is the header's own rounding, not a wrong clock
    _offset = middle.abs() < const Duration(seconds: 1) ? Duration.zero : middle;
  }

  /// Now, by the server's clock as best known; this device's until an answer has come.
  DateTime now() => DateTime.now().add(_offset);

  /// For tests: forget every reading.
  void reset() {
    _samples.clear();
    _offset = Duration.zero;
  }
}

/// The one clock the board counts by.
final serverClock = ServerClock();

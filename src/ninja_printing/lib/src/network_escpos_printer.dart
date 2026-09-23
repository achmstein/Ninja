import 'dart:async';
import 'dart:io';

/// The printer could not be reached or refused the bytes. The message is
/// for the log; the UI shows its own line.
class PrinterException implements Exception {
  final String message;
  const PrinterException(this.message);

  @override
  String toString() => 'PrinterException: $message';
}

/// Anything that takes raw ESC/POS bytes. The LAN printer is the only
/// implementation today; a USB or Bluetooth one would slot in here.
abstract class EscPosPrinter {
  Future<void> send(List<int> bytes);
}

/// An 80 mm thermal printer on the café network, spoken to on the raw
/// port every ESC/POS printer listens on. One connection per job: connect,
/// write, close — no session to keep alive, nothing to recover.
class NetworkEscPosPrinter implements EscPosPrinter {
  final String host;
  final int port;
  final Duration timeout;

  const NetworkEscPosPrinter(this.host, this.port, {this.timeout = const Duration(seconds: 3)});

  @override
  Future<void> send(List<int> bytes) async {
    final Socket socket;
    try {
      socket = await Socket.connect(host, port, timeout: timeout);
    } on SocketException catch (e) {
      throw PrinterException('cannot reach $host:$port — ${e.message}');
    } on TimeoutException {
      throw PrinterException('cannot reach $host:$port — timed out');
    }
    try {
      socket.add(bytes);
      await socket.flush();
      await socket.close();
    } on SocketException catch (e) {
      socket.destroy();
      throw PrinterException('send to $host:$port failed — ${e.message}');
    }
  }
}

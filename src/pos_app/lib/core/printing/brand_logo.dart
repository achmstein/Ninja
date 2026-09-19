import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' as ui;
import 'package:dio/dio.dart';
import 'package:path_provider/path_provider.dart';

/// How wide the logo prints, in dots: about half the 544-dot content width
/// of an 80 mm receipt, roughly the height of the 40 px name in text
const brandLogoWidth = 280;

String? _logoUrl;
Future<ui.Image?>? _logo;

/// The tenant's logo, decoded once at print size. Sheets are painted in a
/// single synchronous pass outside the widget tree, so an `Image.network`
/// would still be loading when the snapshot is taken; the decoded frame is
/// drawn with `RawImage` instead.
///
/// Downloaded once per logo version and kept in the app's documents dir,
/// so a till prints the same after a restart with the network down. No
/// logo, or one that cannot be fetched yet, gives null and the sheet prints
/// the name in bold text.
Future<ui.Image?> brandLogo(String? logoUrl) {
  if (logoUrl == null) return Future.value(null);
  if (logoUrl != _logoUrl || _logo == null) {
    _logoUrl = logoUrl;
    _logo = _load(logoUrl);
  }
  return _logo!;
}

Future<ui.Image?> _load(String url) async {
  try {
    final bytes = await _bytes(url);
    final codec = await ui.instantiateImageCodec(bytes, targetWidth: brandLogoWidth);
    final frame = await codec.getNextFrame();
    codec.dispose();
    return frame.image;
  } catch (_) {
    // Try again on the next print
    _logo = null;
    return null;
  }
}

final _logoFile = RegExp(r'[\\/]brand-logo-[^\\/]*\.png$');

Future<Uint8List> _bytes(String url) async {
  final dir = await getApplicationDocumentsDirectory();
  final version = Uri.parse(url).queryParameters['v'] ?? '0';
  final file = File('${dir.path}${Platform.pathSeparator}brand-logo-$version.png');
  if (await file.exists()) return file.readAsBytes();

  final response = await Dio().get<List<int>>(url, options: Options(responseType: ResponseType.bytes));
  final bytes = Uint8List.fromList(response.data ?? const []);
  if (bytes.isEmpty) throw StateError('empty logo');

  // One logo at a time: an older version's file goes
  await for (final old in dir.list()) {
    if (old is File && _logoFile.hasMatch(old.path) && old.path != file.path) await old.delete();
  }
  await file.writeAsBytes(bytes, flush: true);
  return bytes;
}

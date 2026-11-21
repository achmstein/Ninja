import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

/// The till's own faces, for a test that measures a layout. The test font
/// draws every letter as a square as wide as it is tall, about twice the
/// width of real text, so a row that fits on a phone would overflow in the
/// test and a row that does not might be missed.
Future<void> loadAppFonts() async {
  TestWidgetsFlutterBinding.ensureInitialized();
  for (final family in const ['Inter', 'Alexandria']) {
    final loader = FontLoader(family);
    for (final weight in const ['Regular', 'Medium', 'SemiBold', 'Bold']) {
      final bytes = await File('assets/fonts/$family-$weight.ttf').readAsBytes();
      loader.addFont(Future.value(ByteData.sublistView(bytes)));
    }
    await loader.load();
  }
}

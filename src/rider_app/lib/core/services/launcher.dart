import 'package:flutter/foundation.dart';
import 'package:url_launcher/url_launcher.dart';

/// Opens Maps or the dialer outside the app. False when the phone has
/// nothing to open it with, or refused: the caller tells the rider.
Future<bool> openExternal(Uri uri) async {
  try {
    return await launchUrl(uri, mode: LaunchMode.externalApplication);
  } catch (e) {
    debugPrint('Could not open $uri: $e');
    return false;
  }
}

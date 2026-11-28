import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ninja_staff_ui/kiosk_service.dart';

export 'package:ninja_staff_ui/kiosk_service.dart';

/// This app's kiosk mode (ninja_staff_ui), under its own preference and channel
final kioskServiceProvider = Provider<KioskService>((ref) => KioskService('kds'));

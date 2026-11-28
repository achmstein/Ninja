import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';

/// Where the phone was when the rider handed a delivery over
@immutable
class HandOverFix {
  final double latitude;
  final double longitude;
  final double accuracyMeters;

  const HandOverFix({required this.latitude, required this.longitude, required this.accuracyMeters});

  /// The body of `PUT /api/orders/{id}/delivery/delivered`
  Map<String, dynamic> toJson() => {'latitude': latitude, 'longitude': longitude, 'accuracyMeters': accuracyMeters};
}

/// Whether the phone may say where it is: location on, and the rider let the
/// app (asked once when they have not answered yet).
Future<bool> locationAllowed() async {
  if (!await Geolocator.isLocationServiceEnabled()) return false;
  var permission = await Geolocator.checkPermission();
  if (permission == LocationPermission.denied) permission = await Geolocator.requestPermission();
  return permission == LocationPermission.whileInUse || permission == LocationPermission.always;
}

/// The phone's position at the door, asked for once as the rider says
/// Delivered. Ordering keeps it (when it is within 100 m) so the next
/// delivery to that door finds it. It never holds the step up: no
/// permission, location off, or no fix in time, and Delivered goes without it.
class HandOverLocator {
  /// The GPS gets this long for a fix
  static const timeLimit = Duration(seconds: 8);

  const HandOverLocator();

  Future<HandOverFix?> current() async {
    try {
      if (!await locationAllowed()) return null;
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.best, timeLimit: timeLimit),
      ).timeout(timeLimit + const Duration(seconds: 1));
      return HandOverFix(latitude: position.latitude, longitude: position.longitude, accuracyMeters: position.accuracy);
    } catch (e) {
      debugPrint('Hand-over location: $e');
      return null;
    }
  }
}

final handOverLocatorProvider = Provider<HandOverLocator>((ref) => const HandOverLocator());

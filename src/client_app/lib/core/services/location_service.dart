import 'dart:math' as math;
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import '../../l10n/app_localizations.dart';

/// A point on the map, in degrees
typedef LatLng = ({double lat, double lng});

enum LocationStatus { idle, locating, ok, denied, unavailable }

@immutable
class LocationState {
  final LocationStatus status;

  /// The last fix, kept for the run of the app: asked once, it is not asked again on every page
  final LatLng? here;

  /// Asked on its own once this run: whatever the answer, the app does not ask again unbidden
  final bool asked;

  const LocationState({this.status = LocationStatus.idle, this.here, this.asked = false});

  bool get locating => status == LocationStatus.locating;

  LocationState copyWith({LocationStatus? status, LatLng? here, bool? asked}) =>
      LocationState(status: status ?? this.status, here: here ?? this.here, asked: asked ?? this.asked);
}

/// Where the customer is, on demand (client_web's geo.ts). Nothing asks on
/// launch, nor on opening the branches or booking: those read a position the
/// phone already gives ([readQuietly]); a page that needs one to go on (a pin
/// on a door) asks once it is on screen, once a run ([askOnce]). A
/// no, or a phone that cannot tell, is taken quietly; [locate] is the
/// customer's own "Use my location", later. A refusal for good is not asked
/// again; the button says so and opens the app's settings.
///
/// A precise ask (a pin on a door) is the GPS's own fix, fresh, given time to
/// lock; the coarse one (a café a street away) takes a recent fix and soon.
class LocationNotifier extends Notifier<LocationState> {
  @override
  LocationState build() => const LocationState();

  /// A page that would use the position: asked once a run, never again unbidden
  void askOnce() {
    if (state.asked || state.here != null || state.locating) return;
    request();
  }

  /// What the phone would do if asked for the position: ask (the app may explain first), give it
  /// at once, or refuse without a prompt (refused for good, or location off); null where it cannot tell
  Future<LocationPermission?> permission() async {
    try {
      return await Geolocator.checkPermission();
    } catch (_) {
      return null;
    }
  }

  bool _readQuietly = false;

  /// A page that would use the position but must not ask for it (the
  /// branches, booking, the branch the app opens at): read where the phone
  /// already gives it, else nothing, leaving the asking to "Use my location"
  Future<void> readQuietly() async {
    if (_readQuietly || state.here != null || state.locating) return;
    _readQuietly = true;
    try {
      final permission = await Geolocator.checkPermission();
      if (permission != LocationPermission.whileInUse && permission != LocationPermission.always) return;
    } catch (_) {
      return;
    }
    await request();
  }

  /// One request for the device's position; the state learns the answer.
  /// A precise ask that fails keeps the coarse fix there was.
  Future<void> request({bool precise = false}) async {
    state = state.copyWith(status: LocationStatus.locating, asked: true);
    try {
      if (!await Geolocator.isLocationServiceEnabled()) {
        state = state.copyWith(status: state.here != null ? LocationStatus.ok : LocationStatus.unavailable);
        return;
      }
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
        state = state.copyWith(status: LocationStatus.denied);
        return;
      }
      // Coarse: a fix the phone already has will do, and comes at once
      if (!precise && !kIsWeb) {
        final last = await Geolocator.getLastKnownPosition();
        if (last != null) {
          state = state.copyWith(status: LocationStatus.ok, here: (lat: last.latitude, lng: last.longitude));
          return;
        }
      }
      final position = await Geolocator.getCurrentPosition(
        locationSettings: LocationSettings(
          accuracy: precise ? LocationAccuracy.best : LocationAccuracy.low,
          timeLimit: Duration(seconds: precise ? 20 : 10),
        ),
      );
      state = state.copyWith(status: LocationStatus.ok, here: (lat: position.latitude, lng: position.longitude));
    } catch (e) {
      debugPrint('Location: $e');
      state = state.copyWith(status: state.here != null ? LocationStatus.ok : LocationStatus.unavailable);
    }
  }

  /// The customer's own "Use my location". Refused for good: false, and the
  /// app's settings open where the phone can (the caller says why)
  Future<bool> locate({bool precise = false}) async {
    try {
      if (await Geolocator.checkPermission() == LocationPermission.deniedForever) {
        state = state.copyWith(status: LocationStatus.denied, asked: true);
        if (!kIsWeb) await Geolocator.openAppSettings();
        return false;
      }
    } catch (_) {}
    await request(precise: precise);
    return state.status != LocationStatus.denied;
  }
}

final locationProvider = NotifierProvider<LocationNotifier, LocationState>(LocationNotifier.new);

/// Metres between two points over the Earth's surface (haversine)
double distanceMeters(LatLng a, LatLng b) {
  const r = 6371000.0;
  double rad(double deg) => deg * math.pi / 180;
  final dLat = rad(b.lat - a.lat);
  final dLng = rad(b.lng - a.lng);
  final h = math.pow(math.sin(dLat / 2), 2) + math.cos(rad(a.lat)) * math.cos(rad(b.lat)) * math.pow(math.sin(dLng / 2), 2);
  return 2 * r * math.asin(math.min(1, math.sqrt(h)));
}

/// A distance as people say it: "800 m" to the nearest ten under a kilometre, "1.2 km" to one place under ten, "14 km" beyond
({String value, bool km}) distanceParts(double meters) {
  if (meters < 950) return (value: '${math.max(10, (meters / 10).round() * 10)}', km: false);
  final tenths = (meters / 100).round() / 10;
  return (value: tenths < 10 ? '${tenths % 1 == 0 ? tenths.toInt() : tenths}' : '${(meters / 1000).round()}', km: true);
}

/// The distance in the customer's language ("1.2 km", "1.2 كم")
String distanceText(BuildContext context, double meters) {
  final l10n = AppLocalizations.of(context)!;
  final parts = distanceParts(meters);
  return parts.km ? l10n.distanceKm(parts.value) : l10n.distanceM(parts.value);
}

/// Google Maps' way there from wherever the customer is
Uri directionsUri(LatLng point) => Uri.parse('https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}');

/// Things with a place, closest first when the customer's position is known
/// and the thing has a point; those without one after them, in the order
/// given (the caller's own: the last used, then the owner's)
List<({T item, double? meters})> byDistance<T>(List<T> items, LatLng? here, LatLng? Function(T item) pointOf) {
  final measured = [
    for (final (index, item) in items.indexed)
      (item: item, index: index, meters: here != null && pointOf(item) != null ? distanceMeters(here, pointOf(item)!) : null),
  ];
  measured.sort((a, b) {
    if (a.meters != null && b.meters != null) return a.meters!.compareTo(b.meters!);
    if (a.meters != null) return -1;
    if (b.meters != null) return 1;
    return a.index.compareTo(b.index);
  });
  return [for (final m in measured) (item: m.item, meters: m.meters)];
}

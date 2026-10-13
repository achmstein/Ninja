import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart' as gmaps;
import '../../../core/services/location_service.dart' as geo;
import '../../../core/ui/ui.dart';
import 'map_picker.dart';

/// Close enough to tell one building from the next, as the free map opens
const _streetZoom = 17.0;

/// iOS takes its Maps key from code, before the first map: the build's key
/// is handed to ios/Runner/AppDelegate.swift once, over this channel
const _mapsChannel = MethodChannel('ninja/maps');
Future<void>? _iosKeyGiven;

Future<void> _giveIosKey(String key) =>
    _iosKeyGiven ??= _mapsChannel.invokeMethod<void>('provideApiKey', key).catchError((Object e) {
      _iosKeyGiven = null;
      throw e;
    });

/// The same map under a fixed pin, drawn by Google's own SDK, which costs
/// nothing per load on a phone: used when the build carries a Maps key (the
/// business has Google Maps on). If the map never comes up (the key refused,
/// the SDK missing), [onFail] puts the free map back in its place.
class GoogleMapPicker extends StatefulWidget {
  final String apiKey;
  final geo.LatLng start;
  final geo.LatLng? to;
  final void Function(geo.LatLng point, bool byUser) onSettle;
  final VoidCallback onFail;

  const GoogleMapPicker({super.key, required this.apiKey, required this.start, this.to, required this.onSettle, required this.onFail});

  @override
  State<GoogleMapPicker> createState() => _GoogleMapPickerState();
}

class _GoogleMapPickerState extends State<GoogleMapPicker> {
  gmaps.GoogleMapController? _map;
  late gmaps.LatLng _centre = gmaps.LatLng(widget.start.lat, widget.start.lng);
  bool _keyed = defaultTargetPlatform != TargetPlatform.iOS;
  bool _ready = false;
  bool _moving = false;

  /// The move under way is the app's (a fly to a point), not the customer's
  bool _flying = false;

  /// A finger was on the map since it last came to rest: Google's SDK says a
  /// camera moved, not who moved it, and it comes to rest once on its own at the start
  bool _touched = false;
  geo.LatLng? _pending;
  Timer? _watchdog;

  @override
  void initState() {
    super.initState();
    _watchdog = Timer(const Duration(seconds: 15), () {
      if (mounted && !_ready) widget.onFail();
    });
    if (!_keyed) {
      _giveIosKey(widget.apiKey).then((_) {
        if (mounted) setState(() => _keyed = true);
      }, onError: (Object e) {
        debugPrint('The Maps key could not be given: $e');
        if (mounted) widget.onFail();
      });
    }
  }

  @override
  void dispose() {
    _watchdog?.cancel();
    super.dispose();
  }

  @override
  void didUpdateWidget(GoogleMapPicker old) {
    super.didUpdateWidget(old);
    final to = widget.to;
    if (to != null && to != old.to) _fly(to);
  }

  void _fly(geo.LatLng to) {
    final map = _map;
    if (map == null) {
      _pending = to;
      return;
    }
    _flying = true;
    map.animateCamera(gmaps.CameraUpdate.newLatLngZoom(gmaps.LatLng(to.lat, to.lng), _streetZoom));
  }

  void _idle() {
    if (mounted) setState(() => _moving = false);
    final byUser = _touched && !_flying;
    _flying = false;
    _touched = false;
    widget.onSettle((lat: _centre.latitude, lng: _centre.longitude), byUser);
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    return ClipRRect(
      borderRadius: BorderRadius.circular(20),
      child: ColoredBox(
        color: theme.colors.muted,
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (_keyed)
              Listener(
                onPointerDown: (_) => _touched = true,
                child: gmaps.GoogleMap(
                initialCameraPosition: gmaps.CameraPosition(target: _centre, zoom: _streetZoom),
                compassEnabled: false,
                rotateGesturesEnabled: false,
                tiltGesturesEnabled: false,
                mapToolbarEnabled: false,
                zoomControlsEnabled: false,
                myLocationButtonEnabled: false,
                buildingsEnabled: true,
                // One finger moves the map inside the sheet, rather than the sheet
                gestureRecognizers: {Factory<OneSequenceGestureRecognizer>(() => EagerGestureRecognizer())},
                onMapCreated: (controller) {
                  _map = controller;
                  _watchdog?.cancel();
                  setState(() => _ready = true);
                  final pending = _pending;
                  _pending = null;
                  if (pending != null) _fly(pending);
                },
                onCameraMove: (position) {
                  _centre = position.target;
                  if (!_moving) setState(() => _moving = true);
                },
                onCameraIdle: _idle,
                ),
              ),
            if (!_ready)
              Center(child: SizedBox.square(dimension: 20, child: CircularProgressIndicator(strokeWidth: 2, color: theme.colors.mutedForeground))),
            IgnorePointer(child: CentrePin(moving: _moving)),
          ],
        ),
      ),
    );
  }
}

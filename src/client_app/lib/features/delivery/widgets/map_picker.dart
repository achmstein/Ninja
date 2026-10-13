import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:maplibre_gl/maplibre_gl.dart';
import '../../../core/config/app_config.dart';
import '../../../core/services/location_service.dart' as geo;
import '../../../core/ui/ui.dart';
import '../../../core/widgets/app_text.dart';
import '../../../l10n/app_localizations.dart';
import 'google_map_picker.dart';

/// Free street tiles, no key: OpenFreeMap's style, the same streets the web's map shows
const _style = 'https://tiles.openfreemap.org/styles/liberty';

/// Close enough to tell one building from the next
const _streetZoom = 17.0;

/// A map the customer moves under a pin that stays in the middle, the way
/// delivery apps ask "where exactly" (client_web's map-pin.tsx): wherever
/// the map comes to rest is the point. [to] moves the map (the customer's
/// location found, an address picked); one asked for before the map is up
/// is flown to once it is. [onSettle] says where it came to rest, and
/// whether the customer moved it themselves. Google draws it through the
/// native SDK when the build carries a Maps key (the business has Google
/// Maps on); the free map comes back if Google's never comes up.
class MapPicker extends StatefulWidget {
  final geo.LatLng start;

  /// A new point to fly to; each new value moves the map once
  final geo.LatLng? to;
  final void Function(geo.LatLng point, bool byUser) onSettle;

  const MapPicker({super.key, required this.start, this.to, required this.onSettle});

  @override
  State<MapPicker> createState() => _MapPickerState();
}

class _MapPickerState extends State<MapPicker> {
  bool _googleFailed = false;

  @override
  Widget build(BuildContext context) {
    final key = _googleFailed ? null : AppConfig.googleMapsKey;
    if (key == null) return FreeMapPicker(start: widget.start, to: widget.to, onSettle: widget.onSettle);
    return GoogleMapPicker(
      apiKey: key,
      start: widget.start,
      to: widget.to,
      onSettle: widget.onSettle,
      onFail: () => setState(() => _googleFailed = true),
    );
  }
}

/// The pin that stays put while the map moves under it; its tip is the point, and it lifts while the map moves
class CentrePin extends StatelessWidget {
  final bool moving;

  const CentrePin({super.key, required this.moving});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    return Center(
      child: Stack(
        alignment: Alignment.center,
        clipBehavior: Clip.none,
        children: [
          AnimatedOpacity(
            duration: const Duration(milliseconds: 150),
            opacity: moving ? 0.3 : 0.7,
            child: Container(width: 8, height: 8, decoration: const BoxDecoration(color: Colors.black54, shape: BoxShape.circle)),
          ),
          AnimatedSlide(
            duration: const Duration(milliseconds: 150),
            offset: Offset(0, moving ? -0.72 : -0.5),
            // Filled in the business's colour, as the web's pin is
            child: Icon(
              Icons.location_on,
              size: 44,
              color: theme.colors.primary,
              shadows: const [Shadow(color: Colors.black38, blurRadius: 6, offset: Offset(0, 2))],
            ),
          ),
        ],
      ),
    );
  }
}

/// OpenFreeMap's streets through MapLibre: no key, no bill
class FreeMapPicker extends StatefulWidget {
  final geo.LatLng start;
  final geo.LatLng? to;
  final void Function(geo.LatLng point, bool byUser) onSettle;

  const FreeMapPicker({super.key, required this.start, this.to, required this.onSettle});

  @override
  State<FreeMapPicker> createState() => _FreeMapPickerState();
}

class _FreeMapPickerState extends State<FreeMapPicker> {
  MapLibreMapController? _map;
  bool _ready = false;
  bool _failed = false;
  int _attempt = 0;

  /// The map is moving under the pin: it lifts
  bool _moving = false;

  /// The move under way is the app's (a fly to a point), not the customer's
  bool _flying = false;

  /// Where to fly once the map is up, when [MapPicker.to] came first
  geo.LatLng? _pending;

  /// The style or its tiles never came (offline, blocked): said so, with a way to try again
  Timer? _watchdog;

  @override
  void initState() {
    super.initState();
    _watch();
  }

  @override
  void dispose() {
    _watchdog?.cancel();
    super.dispose();
  }

  void _watch() {
    _watchdog?.cancel();
    _watchdog = Timer(const Duration(seconds: 15), () {
      if (mounted && !_ready) setState(() => _failed = true);
    });
  }

  @override
  void didUpdateWidget(FreeMapPicker old) {
    super.didUpdateWidget(old);
    final to = widget.to;
    if (to != null && to != old.to) _fly(to);
  }

  void _fly(geo.LatLng to) {
    final map = _map;
    if (map == null || !_ready) {
      _pending = to;
      return;
    }
    _flying = true;
    map.animateCamera(CameraUpdate.newLatLngZoom(LatLng(to.lat, to.lng), _streetZoom), duration: const Duration(milliseconds: 900));
  }

  void _idle() {
    final target = _map?.cameraPosition?.target;
    if (mounted) setState(() => _moving = false);
    if (target == null) return;
    final byUser = !_flying;
    _flying = false;
    widget.onSettle((lat: target.latitude, lng: target.longitude), byUser);
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    return ClipRRect(
      borderRadius: BorderRadius.circular(20),
      child: ColoredBox(
        color: theme.colors.muted,
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (!_failed)
              MapLibreMap(
                key: ValueKey(_attempt),
                styleString: _style,
                initialCameraPosition: CameraPosition(target: LatLng(widget.start.lat, widget.start.lng), zoom: _streetZoom),
                trackCameraPosition: true,
                compassEnabled: false,
                rotateGesturesEnabled: false,
                tiltGesturesEnabled: false,
                attributionButtonPosition: AttributionButtonPosition.bottomLeft,
                // One finger moves the map inside the sheet, rather than the sheet
                gestureRecognizers: {Factory<OneSequenceGestureRecognizer>(() => EagerGestureRecognizer())},
                onMapCreated: (controller) => _map = controller,
                onStyleLoadedCallback: () {
                  _watchdog?.cancel();
                  setState(() => _ready = true);
                  final pending = _pending;
                  _pending = null;
                  if (pending != null) _fly(pending);
                },
                onCameraMove: (_) {
                  if (!_moving) setState(() => _moving = true);
                },
                onCameraIdle: _idle,
              ),
            if (_failed)
              Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    AppText(l10n.mapNotLoaded, style: theme.typography.caption.copyWith(color: theme.colors.mutedForeground)),
                    TextButton(
                      onPressed: () {
                        setState(() {
                          _failed = false;
                          _ready = false;
                          _attempt++;
                        });
                        _watch();
                      },
                      child: AppText(l10n.mapRetry),
                    ),
                  ],
                ),
              )
            else if (!_ready)
              Center(child: SizedBox.square(dimension: 20, child: CircularProgressIndicator(strokeWidth: 2, color: theme.colors.mutedForeground))),
            // The pin stays put; its tip is the point. It lifts while the map moves under it
            IgnorePointer(child: CentrePin(moving: _moving)),
          ],
        ),
      ),
    );
  }
}

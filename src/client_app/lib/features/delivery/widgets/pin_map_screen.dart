import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import '../../../core/brand/brand_provider.dart';
import '../../../core/providers/branch_provider.dart';
import '../../../core/services/location_service.dart';
import '../../../core/theme/theme_provider.dart';
import '../../../core/ui/ui.dart';
import '../../../core/widgets/app_text.dart';
import '../../../l10n/app_localizations.dart';
import 'address_search_field.dart';
import 'map_picker.dart';

/// Where the map opens when neither the customer nor the branch is placed: the middle of the business's country
const _countryCentres = <String, LatLng>{
  'EG': (lat: 30.0444, lng: 31.2357),
  'SA': (lat: 24.7136, lng: 46.6753),
  'AE': (lat: 25.2048, lng: 55.2708),
};

/// Where the pin was put, and the street the search wrote for it when the customer searched
@immutable
class PinnedPoint {
  final LatLng point;
  final String? street;

  const PinnedPoint(this.point, {this.street});
}

/// The whole screen a map, the way Talabat and Uber Eats ask where: the pin
/// stays in the middle and the customer moves the map under it, then "Deliver
/// here". [at] is a pin already put (an address changed, or one being added
/// that is moved again); none is a new address, which opens on the phone's own
/// fix. Null when the customer goes back without putting it anywhere.
Future<PinnedPoint?> pickPinOnMap(BuildContext context, {LatLng? at}) =>
    Navigator.of(context, rootNavigator: true).push<PinnedPoint>(
      MaterialPageRoute(fullscreenDialog: true, builder: (_) => PinMapScreen(at: at)),
    );

/// A new pin is taken only once it was put somewhere (the map moved, a street
/// found, or the phone's fix): the map's starting point is the branch, and a
/// rider sent there finds nobody.
class PinMapScreen extends ConsumerStatefulWidget {
  final LatLng? at;

  const PinMapScreen({super.key, this.at});

  @override
  ConsumerState<PinMapScreen> createState() => _PinMapScreenState();
}

class _PinMapScreenState extends ConsumerState<PinMapScreen> {
  late LatLng _point;
  late bool _pinned;

  /// The customer moved the map themselves: a later fix does not take it from them
  late bool _moved;
  LatLng? _flyTo;
  LatLng? _flownTo;

  /// What the search wrote for the place picked, handed on for the street
  String? _street;

  /// "Deliver here" was pressed before the pin was put: said in red
  bool _tried = false;

  /// The phone would ask for the position: why, before it does, and the way to say yes
  bool _explain = false;

  @override
  void initState() {
    super.initState();
    final at = widget.at;
    if (at != null) {
      _point = at;
      _pinned = true;
      _moved = true;
      return;
    }
    final here = ref.read(locationProvider).here;
    final branch = ref.read(branchProvider).selectedBranch?.point;
    final country = ref.read(brandProvider).locale.country;
    _point = here ?? branch ?? _countryCentres[country] ?? _countryCentres['EG']!;
    _pinned = here != null;
    _moved = false;
    _flownTo = here;
    // A new address takes the GPS's own fix, not the coarse one the branch list may have had: at once
    // where the phone gives it already, else on the customer's word once they have read why
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final permission = await ref.read(locationProvider.notifier).permission();
      if (!mounted) return;
      if (permission == LocationPermission.whileInUse || permission == LocationPermission.always) {
        unawaited(ref.read(locationProvider.notifier).request(precise: true));
      } else if (permission == LocationPermission.denied) {
        setState(() => _explain = true);
      }
    });
  }

  Future<void> _useMyLocation() async {
    final l10n = AppLocalizations.of(context)!;
    final here = ref.read(locationProvider).here;
    setState(() {
      _explain = false;
      _moved = false;
      // Back to the fix there is at once; a fresher one follows it
      if (here != null) _flyTo = (lat: here.lat, lng: here.lng);
    });
    final allowed = await ref.read(locationProvider.notifier).locate(precise: true);
    if (!allowed && mounted) {
      showIsland(title: Text(l10n.locationOff), icon: Icon(LucideIcons.mapPinOff, color: context.theme.colors.mutedForeground));
    }
  }

  void _confirm() {
    if (!_pinned) {
      HapticFeedback.lightImpact();
      setState(() => _tried = true);
      return;
    }
    Navigator.of(context).pop(PinnedPoint(_point, street: _street));
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final c = theme.colors;
    final l10n = AppLocalizations.of(context)!;
    final location = ref.watch(locationProvider);
    final search = ref.watch(brandProvider.select((b) => b.addressSearch));
    final rtl = Directionality.of(context) == TextDirection.rtl;
    // The map flies to where the customer is each time a fix comes (the coarse one, then the GPS's),
    // until they move it themselves; "Use my location" hands it back to the fix
    final here = location.here;
    if (!_moved && here != null && here != _flownTo) {
      _flownTo = here;
      _flyTo = here;
      _pinned = true;
    }
    final caption = context.localeText(theme.typography.caption.copyWith(color: c.mutedForeground));
    final safe = MediaQuery.paddingOf(context);

    return AnnotatedRegion<SystemUiOverlayStyle>(
      // The street tiles are light: the clock and battery read dark over them
      value: SystemUiOverlayStyle.dark,
      child: Scaffold(
        backgroundColor: c.background,
        // The keyboard is for the search at the top: the map stays the size it is, and the pin where it is
        resizeToAvoidBottomInset: false,
        body: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: Stack(
                children: [
                  Positioned.fill(
                    child: MapPicker(
                      start: _point,
                      to: _flyTo,
                      borderRadius: BorderRadius.zero,
                      onSettle: (point, byUser) => setState(() {
                        _point = point;
                        if (byUser) {
                          _pinned = true;
                          _moved = true;
                          _tried = false;
                        }
                      }),
                    ),
                  ),
                  // Back, and the street to search for when the customer would rather name it
                  PositionedDirectional(
                    top: safe.top + 8,
                    start: 16,
                    end: 16,
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Padding(
                          padding: EdgeInsets.only(top: search ? 6 : 0),
                          child: _OnMap(
                            label: MaterialLocalizations.of(context).backButtonTooltip,
                            onTap: () => Navigator.of(context).maybePop(),
                            child: Icon(rtl ? LucideIcons.arrowRight : LucideIcons.arrowLeft, size: 20, color: c.foreground),
                          ),
                        ),
                        if (search) ...[
                          const SizedBox(width: 8),
                          Expanded(
                            child: Container(
                              padding: const EdgeInsets.fromLTRB(6, 6, 6, 0),
                              decoration: BoxDecoration(
                                color: c.background,
                                borderRadius: BorderRadius.circular(22),
                                boxShadow: Ninja.surfaceShadow,
                              ),
                              child: AddressSearchField(
                                near: ref.read(branchProvider).selectedBranch?.point,
                                onPick: (place) => setState(() {
                                  _flyTo = place.point;
                                  _pinned = true;
                                  _moved = true;
                                  _tried = false;
                                  _explain = false;
                                  _street = place.address ?? _street;
                                }),
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  PositionedDirectional(
                    end: 16,
                    bottom: 16,
                    child: _OnMap(
                      label: l10n.useMyLocation,
                      onTap: location.locating ? null : _useMyLocation,
                      child: location.locating
                          ? Padding(padding: const EdgeInsets.all(14), child: CircularProgressIndicator(strokeWidth: 2, color: c.foreground))
                          : Icon(LucideIcons.locateFixed, size: 20, color: c.foreground),
                    ),
                  ),
                ],
              ),
            ),
            // Under the map, not over it: the map's own marks (Google's, the free map's credit) stay in sight
            Padding(
              padding: EdgeInsets.fromLTRB(16, 12, 16, 12 + safe.bottom),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (_explain && !_moved && here == null)
                    // Why the app would like the position, before the phone asks for it
                    Pressable(
                      onTap: _useMyLocation,
                      child: Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(color: c.primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(16)),
                        child: Row(
                          children: [
                            Icon(LucideIcons.locateFixed, size: 20, color: c.primary),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  AppText(l10n.useMyLocation, style: caption.copyWith(fontWeight: FontWeight.w600, color: c.foreground)),
                                  AppText(_tried ? l10n.deliveryNeedPin : l10n.deliveryPinWhy,
                                      style: _tried ? caption.copyWith(color: c.destructive) : caption),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    )
                  else
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      child: AppText(
                        _tried && !_pinned ? l10n.deliveryNeedPin : l10n.deliveryMovePin,
                        textAlign: TextAlign.center,
                        style: _tried && !_pinned ? caption.copyWith(color: c.destructive) : caption,
                      ),
                    ),
                  const SizedBox(height: 12),
                  NinjaButton(
                    lifted: true,
                    onPress: _confirm,
                    prefix: const Icon(LucideIcons.mapPinCheck),
                    child: AppText(l10n.deliverySaveAddress),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A round button standing on the map, lifted off it
class _OnMap extends StatelessWidget {
  final String label;
  final VoidCallback? onTap;
  final Widget child;

  const _OnMap({required this.label, required this.onTap, required this.child});

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      child: Pressable(
        onTap: onTap,
        scale: 0.92,
        child: Container(
          width: 44,
          height: 44,
          alignment: Alignment.center,
          decoration: BoxDecoration(color: context.theme.colors.background, shape: BoxShape.circle, boxShadow: Ninja.surfaceShadow),
          child: child,
        ),
      ),
    );
  }
}

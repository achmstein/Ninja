import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import '../../../core/brand/brand_provider.dart';
import '../../../core/models/money.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/text_styles.dart';
import '../../../core/utils/phone.dart';
import '../../../core/widgets/pos_dialog.dart';
import '../../../l10n/app_localizations.dart';
import '../../sale/models/sale_delivery.dart';
import '../../sale/models/sale_line.dart';
import '../models/delivery_order.dart';
import '../services/delivery_service.dart';
import 'delivery_details.dart';

/// Enough digits to be worth asking whether the caller had deliveries before
const _minPhoneDigits = 8;

/// The delivery a cashier took down, and the name the caller gave when no
/// account is attached
typedef DeliveryFormResult = ({SaleDelivery delivery, String name});

/// Where a sale the till took over the phone goes, in the caller's words:
/// the street, the building, the way to the door and the number to call. A
/// pin only when they shared their location; without one the rider goes by
/// the words. The cashier knows the streets, so being past the radius or
/// under the minimum is said, not refused. A caller who had deliveries
/// before is offered those addresses, by their account or their number.
Future<DeliveryFormResult?> showDeliveryFormDialog(
  BuildContext context, {
  SaleDelivery? initial,
  SaleCustomer? customer,
  required double itemsTotal,
}) =>
    showPosDialog<DeliveryFormResult>(
      context,
      maxWidth: 520,
      builder: (_) => _DeliveryForm(initial: initial, customer: customer, itemsTotal: itemsTotal),
    );

class _DeliveryForm extends ConsumerStatefulWidget {
  final SaleDelivery? initial;
  final SaleCustomer? customer;
  final double itemsTotal;

  const _DeliveryForm({this.initial, this.customer, required this.itemsTotal});

  @override
  ConsumerState<_DeliveryForm> createState() => _DeliveryFormState();
}

class _DeliveryFormState extends ConsumerState<_DeliveryForm> {
  late final _name = TextEditingController(text: widget.customer?.name ?? '');
  late final _phone = TextEditingController(text: widget.initial?.phone ?? widget.customer?.phone ?? '');
  late final _street = TextEditingController(text: widget.initial?.address ?? '');
  late final _building = TextEditingController(text: widget.initial?.building ?? '');
  late final _floor = TextEditingController(text: widget.initial?.floor ?? '');
  late final _apartment = TextEditingController(text: widget.initial?.apartment ?? '');
  late final _directions = TextEditingController(text: widget.initial?.directions ?? '');
  late final _location = TextEditingController(text: widget.initial?.location ?? '');

  TillDeliveryQuote? _quote;
  bool _reading = false;
  List<KnownAddress> _known = const [];
  bool _tried = false;
  Timer? _locationDebounce;
  Timer? _phoneDebounce;
  String _lookedUpPhone = '';

  String get _country => ref.read(brandProvider).locale.country;
  bool get _hasAccount => (widget.customer?.id ?? '').isNotEmpty;

  @override
  void initState() {
    super.initState();
    _readLocation();
    _lookUpKnown();
    _location.addListener(() {
      _locationDebounce?.cancel();
      setState(() => _reading = _location.text.trim().isNotEmpty);
      _locationDebounce = Timer(const Duration(milliseconds: 400), _readLocation);
    });
    _phone.addListener(() {
      _phoneDebounce?.cancel();
      _phoneDebounce = Timer(const Duration(milliseconds: 400), _lookUpKnown);
    });
    // Once Save was tried, what is still missing is said as it is typed
    for (final c in [_name, _phone, _street]) {
      c.addListener(() {
        if (_tried) setState(() {});
      });
    }
  }

  @override
  void dispose() {
    _locationDebounce?.cancel();
    _phoneDebounce?.cancel();
    for (final c in [_name, _phone, _street, _building, _floor, _apartment, _directions, _location]) {
      c.dispose();
    }
    super.dispose();
  }

  /// The branch's terms, and the pin read from what was pasted (a short link is followed by Ordering)
  Future<void> _readLocation() async {
    final asked = _location.text.trim();
    try {
      final quote = await ref.read(deliveryRepositoryProvider).tillQuote(location: asked);
      if (!mounted || _location.text.trim() != asked) return;
      setState(() {
        _quote = quote;
        _reading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _reading = false);
    }
  }

  /// The caller's earlier addresses, by account or by the number typed
  Future<void> _lookUpKnown() async {
    final phone = phoneDigitCount(_phone.text) >= _minPhoneDigits ? normalizePhone(_phone.text, _country) : '';
    if (!_hasAccount && phone.isEmpty) {
      if (_known.isNotEmpty) setState(() => _known = const []);
      return;
    }
    if (phone == _lookedUpPhone && _known.isNotEmpty) return;
    _lookedUpPhone = phone;
    try {
      final known = await ref.read(deliveryRepositoryProvider).knownAddresses(customerUserId: widget.customer?.id, phone: phone);
      if (mounted) setState(() => _known = known);
    } catch (_) {
      // Only a convenience: the cashier types the address
    }
  }

  void _pickKnown(KnownAddress a) {
    _street.text = a.address;
    _building.text = a.building ?? '';
    _floor.text = a.floor ?? '';
    _apartment.text = a.apartment ?? '';
    _directions.text = a.directions ?? '';
    if (_phone.text.trim().isEmpty) _phone.text = a.phone ?? '';
    // Its pin as coordinates, which reads back as the same pin
    _location.text = a.latitude != null && a.longitude != null ? '${a.latitude}, ${a.longitude}' : '';
  }

  bool get _nameOk => _hasAccount || _name.text.trim().isNotEmpty;
  bool get _streetOk => _street.text.trim().isNotEmpty;
  bool get _phoneOk => phoneDigitCount(_phone.text) >= _minPhoneDigits;

  void _save() {
    setState(() => _tried = true);
    if (!_nameOk || !_streetOk || !_phoneOk || _reading) return;
    final pinned = _location.text.trim().isNotEmpty && (_quote?.pinned ?? false);
    Navigator.of(context, rootNavigator: true).pop<DeliveryFormResult>((
      delivery: SaleDelivery(
        address: _street.text.trim(),
        phone: normalizePhone(_phone.text, _country),
        building: _building.text.trim(),
        floor: _floor.text.trim(),
        apartment: _apartment.text.trim(),
        directions: _directions.text.trim(),
        location: _location.text.trim(),
        latitude: pinned ? _quote!.latitude : null,
        longitude: pinned ? _quote!.longitude : null,
      ),
      name: _hasAccount ? widget.customer!.name : _name.text.trim(),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final muted = theme.typography.sm.copyWith(color: theme.colors.mutedForeground);
    final error = theme.typography.sm.copyWith(color: theme.colors.destructive);
    final quote = _quote;
    final pasted = _location.text.trim().isNotEmpty;
    final pinned = pasted && (quote?.pinned ?? false);

    Widget field(TextEditingController controller, String label,
            {String? hint, TextInputType? keyboard, TextDirection? direction, bool autofocus = false}) =>
        FTextField(
          control: FTextFieldControl.managed(controller: controller),
          label: Text(label),
          hint: hint,
          keyboardType: keyboard,
          textDirection: direction,
          autofocus: autofocus,
        );

    Widget errorText(bool show, String text) =>
        _tried && show ? Padding(padding: const EdgeInsets.only(top: 4), child: Text(text, style: error)) : const SizedBox.shrink();

    return DialogScroll(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const Icon(FIcons.bike, size: 22),
              const SizedBox(width: 8),
              Expanded(child: Text(l10n.deliveryFormTitle, style: theme.typography.xl.copyWith(fontWeight: FontWeight.w600))),
            ],
          ),
          const SizedBox(height: 16),
          // An account brings its name; a caller off the street says theirs
          if (!_hasAccount) ...[
            field(_name, l10n.deliveryCustomerName, autofocus: true),
            errorText(!_nameOk, l10n.deliveryNeedsName),
            const SizedBox(height: 12),
          ],
          field(_phone, l10n.deliveryPhoneLabel, keyboard: TextInputType.phone, direction: TextDirection.ltr),
          errorText(!_phoneOk, l10n.deliveryPhoneInvalid),
          if (_known.isNotEmpty) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                Icon(FIcons.history, size: 14, color: theme.colors.mutedForeground),
                const SizedBox(width: 6),
                Text(l10n.deliveryKnownAddresses, style: theme.typography.xs.copyWith(color: theme.colors.mutedForeground)),
              ],
            ),
            const SizedBox(height: 6),
            for (final a in _known)
              Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: FTappable(
                  onPress: () => setState(() => _pickKnown(a)),
                  builder: (context, states, child) => Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      border: Border.all(
                          color: a.address == _street.text.trim() && (a.building ?? '') == _building.text.trim()
                              ? theme.colors.primary
                              : theme.colors.border),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: child,
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Icon(FIcons.mapPin, size: 14, color: theme.colors.mutedForeground),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              [
                                if ((a.label ?? '').isNotEmpty) a.label!,
                                [
                                  a.address,
                                  if ((a.building ?? '').isNotEmpty) '${l10n.deliveryBuilding} ${a.building}',
                                  if ((a.floor ?? '').isNotEmpty) '${l10n.deliveryFloor} ${a.floor}',
                                  if ((a.apartment ?? '').isNotEmpty) '${l10n.deliveryApartment} ${a.apartment}',
                                ].join('، '),
                              ].join(' · '),
                              style: theme.typography.sm,
                            ),
                            if ((a.directions ?? '').isNotEmpty)
                              Text('"${a.directions}"',
                                  maxLines: 1, overflow: TextOverflow.ellipsis, style: muted.copyWith(fontStyle: FontStyle.italic)),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
          ],
          const SizedBox(height: 12),
          field(_street, l10n.deliveryStreetLabel),
          errorText(!_streetOk, l10n.deliveryNeedsStreet),
          const SizedBox(height: 12),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: field(_building, l10n.deliveryBuildingLabel)),
              const SizedBox(width: 8),
              Expanded(child: field(_floor, l10n.deliveryFloorLabel)),
              const SizedBox(width: 8),
              Expanded(child: field(_apartment, l10n.deliveryApartmentLabel)),
            ],
          ),
          const SizedBox(height: 12),
          field(_directions, l10n.deliveryDirectionsLabel, hint: l10n.deliveryDirectionsHint),
          const SizedBox(height: 12),
          field(_location, l10n.deliveryLocationLabel, hint: 'https://maps.app.goo.gl/…', direction: TextDirection.ltr),
          const SizedBox(height: 4),
          if (_reading)
            Row(
              children: [
                const SizedBox.square(dimension: 12, child: CircularProgressIndicator(strokeWidth: 2)),
                const SizedBox(width: 6),
                Text(l10n.deliveryLocationReading, style: muted),
              ],
            )
          else if (!pasted)
            Text(l10n.deliveryLocationHint, style: muted)
          else if (pinned)
            Row(
              children: [
                Icon(FIcons.mapPin, size: 14, color: theme.colors.foreground),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    l10n.deliveryLocationFound(quote?.distanceMeters == null ? '' : distanceLabel(l10n, quote!.distanceMeters!)),
                    style: theme.typography.sm,
                  ),
                ),
              ],
            )
          else
            Text(l10n.deliveryLocationUnread, style: muted),
          // Said, not refused: the cashier knows the streets and the regulars
          if (quote != null && !_reading) ...[
            const SizedBox(height: 12),
            if (pinned && !quote.inRange) _Warning(text: l10n.deliveryOutOfRange(_km(quote.radiusKm))),
            if (quote.minimumOrder > 0 && widget.itemsTotal < quote.minimumOrder)
              _Warning(text: l10n.deliveryUnderMinimum(money(context, quote.minimumOrder))),
            Row(
              children: [
                Expanded(child: Text(l10n.deliveryFee, style: muted)),
                Text(quote.fee > 0 ? money(context, quote.fee) : l10n.deliveryFree,
                    style: muted.copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
              ],
            ),
          ],
          const SizedBox(height: 16),
          SizedBox(
            height: 52,
            child: FButton(
              onPress: _reading ? null : _save,
              child: Text(l10n.deliverySave, style: theme.typography.lg.forButton),
            ),
          ),
        ],
      ),
    );
  }

  static String _km(double km) => km == km.roundToDouble() ? km.toStringAsFixed(0) : km.toString();
}

class _Warning extends StatelessWidget {
  final String text;

  const _Warning({required this.text});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final amber = AppColors.amber(theme.colors.brightness);
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(color: AppColors.amber500.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(8)),
      child: Row(
        children: [
          Icon(FIcons.triangleAlert, size: 16, color: amber),
          const SizedBox(width: 6),
          Expanded(child: Text(text, style: theme.typography.sm.copyWith(color: amber))),
        ],
      ),
    );
  }
}

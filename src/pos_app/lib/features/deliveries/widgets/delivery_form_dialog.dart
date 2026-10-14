import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import '../../../core/brand/brand_provider.dart';
import '../../../core/models/money.dart';
import '../../../core/services/branch_names.dart';
import 'package:ninja_app_core/theme/app_theme.dart';
import 'package:ninja_app_core/theme/text_styles.dart';
import '../../../core/utils/phone.dart';
import '../../../core/widgets/pos_dialog.dart';
import '../../../l10n/app_localizations.dart';
import '../../sale/models/sale_delivery.dart';
import '../../sale/models/sale_line.dart';
import '../models/delivery_order.dart';
import '../providers/delivery_form_controller.dart';
import 'address_search_field.dart';
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
/// before is offered those addresses, by their account or their number. A
/// pin out of this branch's area, or clearly nearer another branch, offers
/// that branch: the order is then sent there, made and delivered by it.
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

  bool _tried = false;

  /// The branch nearer the caller the cashier chose to send it to
  late DeliveryAlternative? _sendTo = widget.initial?.sendTo;

  String get _country => ref.read(brandProvider).locale.country;
  bool get _hasAccount => (widget.customer?.id ?? '').isNotEmpty;
  DeliveryFormController get _controller => ref.read(deliveryFormControllerProvider.notifier);

  String get _lookupPhone => phoneDigitCount(_phone.text) >= _minPhoneDigits ? normalizePhone(_phone.text, _country) : '';

  @override
  void initState() {
    super.initState();
    // The terms (and any pin already pasted) at once, then on every new text
    _controller.locationChanged(_location.text, debounce: Duration.zero);
    unawaited(_controller.lookUpKnown(customerUserId: widget.customer?.id, normalizedPhone: _lookupPhone));
    _location.addListener(() => _controller.locationChanged(_location.text));
    _phone.addListener(() => _controller.phoneChanged(customerUserId: widget.customer?.id, normalizedPhone: _lookupPhone));
    // Once Save was tried, what is still missing is said as it is typed
    for (final c in [_name, _phone, _street]) {
      c.addListener(() {
        if (_tried) setState(() {});
      });
    }
  }

  @override
  void dispose() {
    for (final c in [_name, _phone, _street, _building, _floor, _apartment, _directions, _location]) {
      c.dispose();
    }
    super.dispose();
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

  void _save(DeliveryFormState form) {
    setState(() => _tried = true);
    if (!_nameOk || !_streetOk || !_phoneOk || form.reading) return;
    // The pin of the very text in the field, never one an earlier text answered
    final pin = form.pinFor(_location.text);
    final sending = keptSendTo(_sendTo, form.quote?.alternatives ?? const [], pinned: pin != null);
    Navigator.of(context, rootNavigator: true).pop<DeliveryFormResult>((
      delivery: SaleDelivery(
        address: _street.text.trim(),
        phone: normalizePhone(_phone.text, _country),
        building: _building.text.trim(),
        floor: _floor.text.trim(),
        apartment: _apartment.text.trim(),
        directions: _directions.text.trim(),
        location: _location.text.trim(),
        latitude: pin?.latitude,
        longitude: pin?.longitude,
        sendTo: sending,
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
    final form = ref.watch(deliveryFormControllerProvider);
    final quote = form.quote;
    final reading = form.reading;
    final pasted = _location.text.trim().isNotEmpty;
    final pinned = form.pinFor(_location.text) != null;
    // The other branches that deliver to this pin, and the one chosen while it
    // is still offered. None in a business with a call centre: its calls come
    // through the hotline (the server says so too; this covers an older answer)
    final alternatives = offeredAlternatives(quote,
        pinned: pinned, callCentre: ref.watch(featuresProvider.select((f) => f.callCentre)));
    final sending = keptSendTo(_sendTo, alternatives, pinned: pinned);
    final branches = ref.watch(allBranchesProvider).value;
    final minimum = sending?.minimumOrder ?? quote?.minimumOrder ?? 0;
    final fee = sending?.fee ?? quote?.fee ?? 0;

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
          if (form.known.isNotEmpty) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                Icon(FIcons.history, size: 14, color: theme.colors.mutedForeground),
                const SizedBox(width: 6),
                Text(l10n.deliveryKnownAddresses, style: theme.typography.xs.copyWith(color: theme.colors.mutedForeground)),
              ],
            ),
            const SizedBox(height: 6),
            for (final a in form.known)
              Padding(
                key: ValueKey(a.identity),
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
                                ].join(l10n.listSeparator),
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
          // First what a caller says first, the street or a landmark, when the business has Google Maps:
          // a pick puts its point in the location field, as coordinates, and the street when it is empty.
          // The same order as the call centre's
          if (ref.watch(brandProvider.select((b) => b.addressSearch)))
            AddressSearchField(
              onPick: (place) {
                _location.text = place.locationText;
                if (_street.text.trim().isEmpty && place.address != null) _street.text = place.address!;
              },
            ),
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
          if (reading)
            Row(
              children: [
                const SizedBox.square(dimension: 12, child: FCircularProgress()),
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
            Text(form.quoteFailed ? l10n.deliveryLocationNotChecked : l10n.deliveryLocationUnread, style: muted),
          if (!reading && alternatives.isNotEmpty) ...[
            const SizedBox(height: 12),
            NearerBranches(
              alternatives: alternatives,
              chosen: sending?.branchId,
              branchName: (id) => branchNameOf(branches, id, context),
              onChoose: (a) => setState(() => _sendTo = a),
            ),
          ],
          // Said, not refused: the cashier knows the streets and the regulars
          if (quote != null && !reading) ...[
            const SizedBox(height: 12),
            if (pinned && !quote.inRange && sending == null) _Warning(text: outOfRangeWarning(l10n, quote)),
            if (minimum > 0 && widget.itemsTotal < minimum)
              _Warning(text: l10n.deliveryUnderMinimum(money(context, minimum))),
            Row(
              children: [
                Expanded(child: Text(l10n.deliveryFee, style: muted)),
                Text(fee > 0 ? money(context, fee) : l10n.deliveryFree,
                    style: muted.copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
              ],
            ),
          ],
          const SizedBox(height: 16),
          SizedBox(
            height: 52,
            child: FButton(
              onPress: reading ? null : () => _save(form),
              child: Text(
                sending != null ? l10n.deliverySaveSend(branchNameOf(branches, sending.branchId, context)) : l10n.deliverySave,
                style: theme.typography.lg.forButton,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// The other branches the form offers to send the order to: those the quote
/// names for a pin, and none where a call centre takes the business's calls
List<DeliveryAlternative> offeredAlternatives(TillDeliveryQuote? quote, {required bool pinned, required bool callCentre}) =>
    pinned && !callCentre ? quote?.alternatives ?? const <DeliveryAlternative>[] : const <DeliveryAlternative>[];

/// What the till says of a pin the branch does not reach: its drawn area, or
/// the radius when it has none (a branch with only an area has a 0 km radius)
String outOfRangeWarning(AppLocalizations l10n, TillDeliveryQuote quote) {
  if (quote.hasArea) return l10n.deliveryOutOfArea;
  final km = quote.radiusKm;
  return l10n.deliveryOutOfRange(km == km.roundToDouble() ? km.toStringAsFixed(0) : km.toString());
}

/// The branches nearer the caller that deliver there, nearest first: how far
/// and for what fee, with Send. A paused branch says so and takes a second
/// tap. The one chosen says the order goes there, with the way back.
class NearerBranches extends StatefulWidget {
  final List<DeliveryAlternative> alternatives;
  final int? chosen;
  final String Function(int branchId) branchName;
  final void Function(DeliveryAlternative? sendTo) onChoose;

  const NearerBranches({super.key, required this.alternatives, required this.chosen, required this.branchName, required this.onChoose});

  @override
  State<NearerBranches> createState() => _NearerBranchesState();
}

class _NearerBranchesState extends State<NearerBranches> {
  /// The paused branch whose Send was tapped once
  int? _confirming;

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final amber = AppColors.amber(theme.colors.brightness);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        for (final a in widget.alternatives)
          if (widget.chosen == null || widget.chosen == a.branchId)
            Container(
              key: ValueKey(a.branchId),
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: widget.chosen == a.branchId ? theme.colors.primary.withValues(alpha: 0.06) : null,
                border: Border.all(color: widget.chosen == a.branchId ? theme.colors.primary : theme.colors.border),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Icon(FIcons.store, size: 16, color: theme.colors.mutedForeground),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text.rich(
                          TextSpan(children: [
                            TextSpan(
                              text: widget.chosen == a.branchId
                                  ? l10n.deliveryWillSend(widget.branchName(a.branchId))
                                  : l10n.deliveryNearerBranch(
                                      widget.branchName(a.branchId),
                                      distanceLabel(l10n, a.distanceMeters),
                                      a.fee > 0 ? money(context, a.fee) : l10n.deliveryFree,
                                    ),
                            ),
                            if (a.paused)
                              TextSpan(text: ' \u00b7 ${l10n.deliveryBranchPaused}', style: TextStyle(color: amber, fontWeight: FontWeight.w600)),
                          ]),
                          style: theme.typography.sm,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Align(
                    alignment: AlignmentDirectional.centerStart,
                    child: widget.chosen == a.branchId
                        ? FButton(
                            variant: FButtonVariant.outline,
                            mainAxisSize: MainAxisSize.min,
                            onPress: () => widget.onChoose(null),
                            child: Text(l10n.deliveryKeepHere),
                          )
                        : FButton(
                            variant: _confirming == a.branchId ? null : FButtonVariant.secondary,
                            mainAxisSize: MainAxisSize.min,
                            prefix: const Icon(FIcons.send),
                            onPress: () {
                              // A paused branch stopped its customers' orders: the cashier is asked once more
                              if (a.paused && _confirming != a.branchId) {
                                setState(() => _confirming = a.branchId);
                                return;
                              }
                              setState(() => _confirming = null);
                              widget.onChoose(a);
                            },
                            child: Flexible(
                              child: Text(
                                a.paused && _confirming == a.branchId
                                    ? l10n.deliverySendToPaused(widget.branchName(a.branchId))
                                    : l10n.deliverySendTo(widget.branchName(a.branchId)),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ),
                  ),
                ],
              ),
            ),
      ],
    );
  }
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

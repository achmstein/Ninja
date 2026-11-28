import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import '../../../core/brand/brand_provider.dart';
import '../../../core/models/money.dart';
import '../../../core/services/branch_names.dart';
import 'package:ninja_app_core/models/localized_text.dart';
import 'package:ninja_app_core/theme/app_theme.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import 'package:ninja_app_core/utils/phone.dart';
import '../../../core/utils/whatsapp.dart';
import '../../../core/widgets/pos_dialog.dart';
import '../../../l10n/app_localizations.dart';
import '../../customers/dialogs/app_link_dialog.dart' show customerOrigin;
import '../../customers/services/customer_search_service.dart' show IdentityUser;
import '../../orders/models/order.dart' show PinSource;
import '../../sale/models/sale_delivery.dart';
import '../../sale/models/sale_line.dart';
import '../models/delivery_order.dart';
import '../providers/deliveries_provider.dart';
import '../providers/delivery_form_controller.dart';
import 'address_search_field.dart';
import 'area_picker_field.dart';
import 'delivery_details.dart';
import 'pin_quality.dart';
import '../../../core/theme/type_roles.dart';

/// The delivery a cashier took down, and who it is for: the account found
/// (or already on the sale), else the name the caller gave
typedef DeliveryFormResult = ({SaleDelivery delivery, SaleCustomer customer});

/// A delivery the till takes over the phone, in the order the call goes.
/// First the number: a caller who had deliveries before is found by it, with
/// their name when they have an account, and an earlier address is one tap
/// to the last step; who the number is (a customer, someone delivered to
/// before, a new caller) is said under it as it is typed. A sale that already
/// says who it is for opens on the next step, with that customer's addresses
/// at its top. Then, for a new address, where it goes: the branch's
/// named area (which sets the fee) and the street, building, floor and flat
/// as the caller says them, whatever Google knows. A pin on the map is an
/// extra for the rider, folded away with the directions, and never changes
/// the area; Ask for their location sends the caller a link on WhatsApp, and
/// the point their phone shares comes into the form while it is open (or
/// reaches the order after it is placed). Last, everything on one screen: the fee, anything to watch out
/// for, a nearer branch that could make it, and the rider to give it to.
Future<DeliveryFormResult?> showDeliveryFormDialog(
  BuildContext context, {
  SaleDelivery? initial,
  SaleCustomer? customer,
  required double itemsTotal,
}) =>
    showPosDialog<DeliveryFormResult>(
      context,
      size: DialogSize.lg,
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

  /// Changing a delivery already made opens on its last step: everything is there to look over.
  /// The sale already says who it is for, number and all: nobody is asked twice, the form opens on where
  late DeliveryStep _step = firstDeliveryStep(
    changing: widget.initial != null,
    customerName: widget.customer?.name,
    customerPhone: widget.customer?.phone,
  );

  /// Opened past the first step, for a customer the sale already had: their addresses are offered on the second
  late final bool _cameWithCustomer;

  /// The name the field holds because the number is an account's: it goes when the number is no longer theirs
  String? _filledName;

  /// A step's mistakes show once its Next was pressed, and then as they are put right
  bool _triedWho = false;
  bool _triedWhere = false;

  /// Directions and the pin are folded away until wanted (or already filled)
  late bool _more = (widget.initial?.directions ?? '').isNotEmpty || (widget.initial?.location ?? '').isNotEmpty;

  /// The branch nearer the caller the cashier chose to send it to
  late DeliveryAlternative? _sendTo = widget.initial?.sendTo;

  /// The rider picked while the call is on; null gives it later
  late SaleDeliveryRider? _rider = widget.initial?.rider;

  /// Where the pin in [_location] came from: an earlier address's own
  /// source, a map search, or the caller sharing it; null with no pin or an
  /// older sale's pin whose source was never said
  late PinSource? _pinSource = widget.initial?.pinSource;

  String get _country => ref.read(brandProvider).locale.country;
  bool get _hasAccount => (widget.customer?.id ?? '').isNotEmpty;
  DeliveryFormController get _controller => ref.read(deliveryFormControllerProvider.notifier);

  String get _lookupPhone => phoneDigitCount(_phone.text) >= minDeliveryPhoneDigits ? normalizePhone(_phone.text, _country) : '';

  @override
  void initState() {
    super.initState();
    _cameWithCustomer = _step == DeliveryStep.where;
    // Once this build is over: what the form knows may not change while the screen is being built
    unawaited(Future.microtask(_start));
    // The account's name stands in the empty field until the cashier types another
    ref.listenManual(deliveryFormControllerProvider.select((f) => f.account), (before, account) {
      if (!mounted || _hasAccount) return;
      final theirs = _name.text.trim().isEmpty || _name.text == _filledName;
      if (account != null) {
        if (theirs) _name.text = account.displayName;
        _filledName = _name.text == account.displayName ? account.displayName : null;
      } else {
        if (_filledName != null && theirs) _name.clear();
        _filledName = null;
      }
    });
    _location.addListener(() => _controller.locationChanged(_location.text));
    // The caller shared: their point is the pin, said as coordinates like any other
    ref.listenManual(deliveryFormControllerProvider.select((f) => f.shared), (before, shared) {
      if (shared == null || before != null || !mounted) return;
      setState(() {
        _location.text = '${shared.latitude}, ${shared.longitude}';
        _pinSource = PinSource.shared;
        _more = true;
      });
    });
    _phone.addListener(() {
      _controller.phoneChanged(
          customerUserId: widget.customer?.id, normalizedPhone: _lookupPhone, typed: _phone.text, country: _country);
      // Who the number is follows every digit
      setState(() {});
    });
    for (final c in [_name, _street]) {
      c.addListener(() {
        if (_triedWho || _triedWhere) setState(() {});
      });
    }
  }

  /// What the form asks as it opens: the branch's terms, the customer's
  /// earlier addresses, whose number it is, and a location link still out
  void _start() {
    if (!mounted) return;
    // The terms (and any pin already there) at once, then on every new text
    final area = widget.initial?.zoneId == null ? null : widget.initial!.zone;
    _controller.locationChanged(
      _location.text,
      debounce: Duration.zero,
      // The area the sale already goes to stays picked; the branch's answer brings it up to date
      startWith: area == null
          ? null
          : DeliveryZone(
              zoneId: area.id,
              branchId: 0,
              name: area.name,
              fee: area.fee,
              minimumOrder: area.minimumOrder,
              etaMinutes: area.etaMinutes,
            ),
    );
    unawaited(_controller.lookUpKnown(customerUserId: widget.customer?.id, normalizedPhone: _lookupPhone));
    if (!_hasAccount) unawaited(_controller.lookUpCaller(typed: _phone.text, normalizedPhone: _lookupPhone, country: _country));
    // A link sent for this delivery before the form was closed still brings the caller's point
    final token = widget.initial?.locationShareToken;
    if (token != null && widget.initial?.pinSource != PinSource.shared) _controller.watchShare(token);
  }

  @override
  void dispose() {
    for (final c in [_name, _phone, _street, _building, _floor, _apartment, _directions, _location]) {
      c.dispose();
    }
    super.dispose();
  }

  /// Who it is for: the account on the sale, else the one the number belongs to
  SaleCustomer? _account(DeliveryFormState form) {
    if (_hasAccount) return widget.customer;
    final found = form.account;
    if (found == null) return null;
    return SaleCustomer(id: found.id, name: found.displayName, phone: found.phoneNumber, addedAtCounter: found.addedAtCounter);
  }

  /// The name shown: typed, else the account's
  String _shownName(DeliveryFormState form) => _name.text.trim().isNotEmpty ? _name.text.trim() : _account(form)?.name ?? '';

  bool _nameOk(DeliveryFormState form) => _account(form) != null || _name.text.trim().isNotEmpty;
  bool get _phoneOk => phoneDigitCount(_phone.text) >= minDeliveryPhoneDigits;
  bool get _streetOk => _street.text.trim().isNotEmpty;

  void _toWhere(DeliveryFormState form) {
    setState(() {
      _triedWho = true;
      if (_phoneOk && _nameOk(form)) _step = DeliveryStep.where;
    });
  }

  void _toCheck() {
    setState(() {
      _triedWhere = true;
      if (_streetOk) _step = DeliveryStep.check;
    });
  }

  void _pickKnown(KnownAddress a, DeliveryFormState form) {
    _street.text = a.address;
    _building.text = a.building ?? '';
    _floor.text = a.floor ?? '';
    _apartment.text = a.apartment ?? '';
    _directions.text = a.directions ?? '';
    if (_phone.text.trim().isEmpty) _phone.text = a.phone ?? '';
    // Its pin as coordinates, which reads back as the same pin
    _location.text = a.hasPin ? '${a.latitude}, ${a.longitude}' : '';
    _pinSource = a.hasPin ? a.pinSource : null;
    _sendTo = null;
    // Another address altogether: its own pin says the area again
    _controller.pickZone(null);
    setState(() {
      _triedWho = true;
      if (_phoneOk && _nameOk(form)) _step = DeliveryStep.check;
    });
  }

  void _save(DeliveryFormState form) {
    if (form.reading) return;
    if (!_phoneOk || !_nameOk(form)) return setState(() => _step = DeliveryStep.who);
    if (!_streetOk) return setState(() => _step = DeliveryStep.where);
    // The pin of the very text in the field, never one an earlier text answered
    final pin = form.pinFor(_location.text);
    final sending = keptSendTo(_sendTo, form.quote?.alternatives ?? const [], pinned: pin != null);
    // An area is this branch's own: an order sent to another branch has none
    final zone = sending == null ? form.zone : null;
    final phone = normalizePhone(_phone.text, _country);
    final account = _account(form);
    Navigator.of(context, rootNavigator: true).pop<DeliveryFormResult>((
      delivery: SaleDelivery(
        address: _street.text.trim(),
        phone: phone,
        building: _building.text.trim(),
        floor: _floor.text.trim(),
        apartment: _apartment.text.trim(),
        directions: _directions.text.trim(),
        location: _location.text.trim(),
        latitude: pin?.latitude,
        longitude: pin?.longitude,
        sendTo: sending,
        zone: zone == null ? null : SaleDeliveryZone.of(zone),
        // Another branch's riders are its own: one picked here never follows the order there
        rider: sending == null ? _rider : null,
        pinSource: pin == null ? null : _pinSource,
        // Placed with the order, a location the caller shares later still reaches it
        locationShareToken: form.shareToken,
      ),
      customer: account == null
          ? SaleCustomer(name: _name.text.trim(), phone: phone)
          : SaleCustomer(id: account.id, name: _shownName(form), phone: account.phone, addedAtCounter: account.addedAtCounter),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final form = ref.watch(deliveryFormControllerProvider);
    final quote = form.quote;

    // The branch's own answer says whether it delivers at all
    final Widget body;
    if (quote != null && !quote.delivers) {
      body = _Said(text: l10n.deliveryNotHere);
    } else if (quote == null && form.quoteFailed) {
      body = Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _Said(text: l10n.deliveryTermsUnknown),
          FButton(
            variant: FButtonVariant.outline,
            mainAxisSize: MainAxisSize.min,
            onPress: () => unawaited(_controller.readLocation(_location.text)),
            child: Text(l10n.retry),
          ),
        ],
      );
    } else if (quote == null) {
      body = const Padding(padding: EdgeInsets.all(24), child: Center(child: FCircularProgress()));
    } else {
      body = switch (_step) {
        DeliveryStep.who => _who(context, form),
        DeliveryStep.where => _where(context, form),
        DeliveryStep.check => _check(context, form),
      };
    }

    return DialogScroll(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const Icon(FIcons.bike, size: Sizes.icon),
              const SizedBox(width: 8),
              Expanded(child: Text(l10n.deliveryFormTitle, style: theme.type.title)),
            ],
          ),
          const SizedBox(height: 12),
          _StepBar(
            step: _step,
            done: {
              DeliveryStep.who: _name.text.trim().isNotEmpty ? _name.text.trim() : showPhone(_phone.text.trim()),
              DeliveryStep.where: [
                if (form.zone != null) form.zone!.name.localized(context),
                if (_street.text.trim().isNotEmpty) _street.text.trim(),
              ].join(l10n.listSeparator),
            },
            onGo: (step) => setState(() => _step = step),
          ),
          const SizedBox(height: 16),
          body,
        ],
      ),
    );
  }

  Widget _field(TextEditingController controller, String label,
          {String? hint, TextInputType? keyboard, TextDirection? direction, bool autofocus = false, String? error, VoidCallback? onSubmit}) =>
      Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          FTextField(
            control: FTextFieldControl.managed(controller: controller),
            label: Text(label),
            hint: hint,
            keyboardType: keyboard,
            textDirection: direction,
            autofocus: autofocus,
            onSubmit: onSubmit == null ? null : (_) => onSubmit(),
          ),
          if (error != null)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(error, style: context.theme.type.detail.copyWith(color: context.theme.colors.destructive)),
            ),
        ],
      );

  Widget _bigButton(String text, VoidCallback? onPress, {bool outline = false, Widget? prefix, Widget? suffix}) => SizedBox(
        height: Sizes.controlLarge,
        child: FButton(
          variant: outline ? FButtonVariant.outline : null,
          onPress: onPress,
          prefix: prefix,
          suffix: suffix,
          // A long branch name is wider than a phone's dialog: the words shorten instead of running over
          child: Flexible(
            child: Text(text, maxLines: 1, overflow: TextOverflow.ellipsis, style: context.theme.type.mainAction),
          ),
        ),
      );

  /// A customer whose number holds the digits typed was tapped: the number and the name are theirs
  void _pickCaller(IdentityUser customer) {
    _name.text = customer.displayName;
    _phone.text = plainPhone(customer.phoneNumber);
  }

  /// Who the number is, said under it as it is typed: a customer with an
  /// account, the customers whose numbers hold its digits (a tap each),
  /// someone delivered to before, or a new caller
  Widget? _caller(BuildContext context, DeliveryFormState form, SaleCustomer? account) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    Widget line(IconData icon, String text, {Color? color, Color? fill, FontWeight? weight}) => Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(color: fill ?? theme.colors.muted, borderRadius: BorderRadius.circular(Sizes.radius)),
          child: Row(
            children: [
              Icon(icon, size: Sizes.iconSmall, color: color ?? theme.colors.mutedForeground),
              const SizedBox(width: 8),
              Expanded(
                child: Text(text, style: theme.type.detail.copyWith(color: color ?? theme.colors.mutedForeground, fontWeight: weight)),
              ),
            ],
          ),
        );

    if (account != null) {
      final green = AppColors.emerald(theme.colors.brightness);
      return line(
        FIcons.userRound,
        [if (account.name.isNotEmpty) account.name, l10n.deliveryKnownCustomer].join(' · '),
        color: green,
        fill: green.withValues(alpha: 0.1),
        weight: FontWeight.w600,
      );
    }
    if (form.suggestions.isNotEmpty) {
      return Container(
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          border: Border.all(color: theme.colors.border),
          borderRadius: BorderRadius.circular(Sizes.radius),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (final (i, c) in form.suggestions.indexed) ...[
              if (i > 0) Divider(height: 1, color: theme.colors.border),
              FTappable(
                key: ValueKey(c.id),
                semanticsLabel: c.displayName,
                onPress: () => _pickCaller(c),
                child: Container(
                  constraints: const BoxConstraints(minHeight: 48),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  child: Row(
                    children: [
                      Icon(FIcons.userRound, size: Sizes.iconSmall, color: theme.colors.mutedForeground),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(c.displayName,
                            maxLines: 1, overflow: TextOverflow.ellipsis, style: theme.type.detail.copyWith(fontWeight: FontWeight.w600)),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        plainPhone(c.phoneNumber),
                        textDirection: TextDirection.ltr,
                        style: theme.type.detail
                            .copyWith(color: theme.colors.mutedForeground, fontFeatures: const [FontFeature.tabularFigures()]),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
      );
    }
    return switch (form.callerFor(_lookupPhone)) {
      DeliveryCaller.calledBefore => line(FIcons.history, l10n.deliveryCalledBefore, color: theme.colors.foreground, weight: FontWeight.w500),
      DeliveryCaller.newCaller => line(FIcons.plus, l10n.deliveryNewCaller),
      _ => null,
    };
  }

  /// A customer's earlier addresses, one tap each: the same address again is the commonest delivery there is
  Widget _knownAddresses(BuildContext context, DeliveryFormState form) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final muted = theme.type.detail.copyWith(color: theme.colors.mutedForeground);
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Icon(FIcons.history, size: Sizes.iconSmall, color: theme.colors.mutedForeground),
            const SizedBox(width: 6),
            Text(l10n.deliveryKnownAddresses, style: muted),
          ],
        ),
        const SizedBox(height: 6),
        for (final a in form.known)
          Padding(
            key: ValueKey(a.identity),
            padding: const EdgeInsets.only(bottom: 8),
            child: FTappable(
              onPress: () => _pickKnown(a, form),
              builder: (context, states, child) => Container(
                constraints: const BoxConstraints(minHeight: 64),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  border: Border.all(color: theme.colors.border),
                  borderRadius: BorderRadius.circular(Sizes.radius),
                ),
                child: child,
              ),
              child: Row(
                children: [
                  Icon(FIcons.mapPin, size: Sizes.icon, color: theme.colors.mutedForeground),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          [
                            if ((a.label ?? '').isNotEmpty) a.label!,
                            _addressLine(l10n, a.address, a.building, a.floor, a.apartment),
                          ].join(' · '),
                          style: theme.type.detail.copyWith(fontWeight: FontWeight.w600),
                        ),
                        if ((a.directions ?? '').isNotEmpty)
                          Text('"${a.directions}"',
                              maxLines: 1, overflow: TextOverflow.ellipsis, style: muted.copyWith(fontStyle: FontStyle.italic)),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Icon(FIcons.check, size: Sizes.iconSmall, color: theme.colors.primary),
                  const SizedBox(width: 4),
                  Text(l10n.deliverySameAddress,
                      style: theme.type.detail.copyWith(color: theme.colors.primary, fontWeight: FontWeight.w600)),
                ],
              ),
            ),
          ),
      ],
    );
  }

  /// Step one: the number first, as the call starts; a caller who had deliveries before is one tap away
  Widget _who(BuildContext context, DeliveryFormState form) {
    final l10n = AppLocalizations.of(context)!;
    final caller = _caller(context, form, _account(form));
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // The same box as every other in the form: its height and its text size
        _field(_phone, l10n.deliveryPhoneLabel,
            keyboard: TextInputType.phone,
            direction: TextDirection.ltr,
            autofocus: _phone.text.isEmpty,
            error: _triedWho && !_phoneOk ? l10n.deliveryPhoneInvalid : null,
            onSubmit: () => _toWhere(form)),
        if (caller != null) ...[const SizedBox(height: 8), caller],
        const SizedBox(height: 12),
        _field(_name, l10n.deliveryCustomerName,
            error: _triedWho && !_nameOk(form) ? l10n.deliveryNeedsName : null, onSubmit: () => _toWhere(form)),
        if (form.known.isNotEmpty) ...[
          const SizedBox(height: 16),
          _knownAddresses(context, form),
        ],
        const SizedBox(height: 16),
        form.known.isNotEmpty
            ? _bigButton(l10n.deliveryNewAddress, () => _toWhere(form), outline: true, prefix: const Icon(FIcons.plus))
            : _bigButton(l10n.deliveryNextTo(l10n.deliveryStepWhere), () => _toWhere(form), suffix: Icon(_forwardIcon(context))),
      ],
    );
  }

  /// Step two: the area (its fee) and the street as the caller says it; directions and the pin folded away
  Widget _where(BuildContext context, DeliveryFormState form) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final muted = theme.type.detail.copyWith(color: theme.colors.mutedForeground);
    final quote = form.quote;
    final zones = quote?.zones ?? const <DeliveryZone>[];
    final pinned = form.pinFor(_location.text) != null;
    final pinZone = form.pinZone;
    void pick(DeliveryZone? zone) {
      if (zone != null) setState(() => _sendTo = null);
      _controller.pickZone(zone);
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // The sale already said who it is for, so the first step was passed over: their addresses are offered here
        if (_cameWithCustomer && form.known.isNotEmpty) ...[
          _knownAddresses(context, form),
          const SizedBox(height: 8),
        ],
        if (zones.isNotEmpty) ...[
          AreaChoice(zones: zones, picked: form.zone, onPick: pick),
          const SizedBox(height: 12),
        ],
        _field(_street, l10n.deliveryStreetLabel,
            autofocus: zones.isEmpty && _street.text.isEmpty, error: _triedWhere && !_streetOk ? l10n.deliveryNeedsStreet : null),
        const SizedBox(height: 12),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: _field(_building, l10n.deliveryBuildingLabel)),
            const SizedBox(width: 8),
            Expanded(child: _field(_floor, l10n.deliveryFloorLabel)),
            const SizedBox(width: 8),
            Expanded(child: _field(_apartment, l10n.deliveryApartmentLabel)),
          ],
        ),
        const SizedBox(height: 12),
        _shareLocation(context, form),
        const SizedBox(height: 8),
        if (!_more)
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: FButton(
              variant: FButtonVariant.ghost,
              mainAxisSize: MainAxisSize.min,
              prefix: const Icon(FIcons.chevronDown),
              onPress: () => setState(() => _more = true),
              // Wider than a phone's dialog in one line: the words shorten instead of running over
              child: Flexible(child: Text(l10n.deliveryMoreForRider, maxLines: 1, overflow: TextOverflow.ellipsis)),
            ),
          )
        else
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              border: Border.all(color: theme.colors.border),
              borderRadius: BorderRadius.circular(Sizes.radius),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _field(_directions, l10n.deliveryDirectionsLabel, hint: l10n.deliveryDirectionsHint),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Icon(FIcons.mapPinned, size: Sizes.iconSmall, color: theme.colors.mutedForeground),
                    const SizedBox(width: 6),
                    Expanded(child: Text(l10n.deliveryPinLabel, style: muted)),
                  ],
                ),
                const SizedBox(height: 6),
                // A pin for the rider: it never fills in the area, and the street only when it is empty
                if (ref.watch(brandProvider.select((b) => b.addressSearch)))
                  AddressSearchField(
                    onPick: (place) {
                      _pinSource = PinSource.search;
                      _location.text = place.locationText;
                      if (_street.text.trim().isEmpty && place.address != null) _street.text = place.address!;
                    },
                  ),
                const SizedBox(height: 6),
                if (form.reading && _location.text.trim().isNotEmpty)
                  Row(
                    children: [
                      const SizedBox.square(dimension: Sizes.iconSmall, child: FCircularProgress()),
                      const SizedBox(width: 6),
                      Text(l10n.deliveryLocationReading, style: muted),
                    ],
                  )
                else if (pinned)
                  Row(
                    children: [
                      Icon(FIcons.mapPin, size: Sizes.iconSmall, color: theme.colors.foreground),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          l10n.deliveryLocationFound(quote?.distanceMeters == null ? '' : distanceLabel(l10n, quote!.distanceMeters!)),
                          style: theme.type.detail,
                        ),
                      ),
                      FButton(
                        variant: FButtonVariant.ghost,
                        mainAxisSize: MainAxisSize.min,
                        onPress: () {
                          _pinSource = null;
                          _location.clear();
                        },
                        child: Text(l10n.deliveryPinRemove),
                      ),
                    ],
                  )
                else if (_location.text.trim().isNotEmpty && form.quoteFailed)
                  Text(l10n.deliveryLocationNotChecked, style: muted)
                else
                  Text(l10n.deliveryPinOptional, style: muted),
              ],
            ),
          ),
        if (pinZone != null) ...[
          const SizedBox(height: 12),
          _Warning(
            text: l10n.deliveryPinInOtherArea(pinZone.name.localized(context)),
            action: FButton(
              variant: FButtonVariant.outline,
              mainAxisSize: MainAxisSize.min,
              onPress: () => pick(pinZone),
              child: Text(l10n.deliveryUseArea(pinZone.name.localized(context))),
            ),
          ),
        ],
        const SizedBox(height: 16),
        Row(
          children: [
            SizedBox(
              height: Sizes.controlLarge,
              width: Sizes.controlLarge,
              child: Semantics(
                label: l10n.goBack,
                button: true,
                child: FButton.icon(
                  variant: FButtonVariant.outline,
                  onPress: () => setState(() => _step = DeliveryStep.who),
                  child: Icon(FIcons.arrowLeft),
                ),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(child: _bigButton(l10n.deliveryNextTo(l10n.deliveryStepCheck), _toCheck, suffix: Icon(_forwardIcon(context)))),
          ],
        ),
      ],
    );
  }

  /// Sends the caller the location link on WhatsApp: the one already waiting,
  /// else a new one (the first, or after the last expired)
  Future<void> _askLocation() async {
    final l10n = AppLocalizations.of(context)!;
    final form = ref.read(deliveryFormControllerProvider);
    final token = form.shareWaiting ? form.shareToken : (await _controller.makeShareLink())?.token;
    if (token == null || !mounted) return;
    final url = LocationShareLink(token, DateTime.now()).url(customerOrigin(ref));
    await openOrSay(context, whatsAppLink(_phone.text, country: _country, text: l10n.deliveryShareMessage(url.toString())),
        l10n.couldNotOpenWhatsApp);
  }

  /// The caller's own point, asked for over WhatsApp: the button, then
  /// waiting (with Send again), then received
  Widget _shareLocation(BuildContext context, DeliveryFormState form) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final muted = theme.type.detail.copyWith(color: theme.colors.mutedForeground);
    if (_pinSource == PinSource.shared && _location.text.trim().isNotEmpty) {
      final green = AppColors.emerald(theme.colors.brightness);
      return Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: green.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(Sizes.radius)),
        child: Row(
          children: [
            Icon(FIcons.circleCheck, size: Sizes.icon, color: green),
            const SizedBox(width: 8),
            Expanded(child: Text(l10n.deliveryShareReceived, style: theme.type.detail.copyWith(color: green, fontWeight: FontWeight.w600))),
          ],
        ),
      );
    }
    if (form.shareWaiting) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(border: Border.all(color: theme.colors.border), borderRadius: BorderRadius.circular(Sizes.radius)),
        child: Row(
          children: [
            const SizedBox.square(dimension: Sizes.iconSmall, child: FCircularProgress()),
            const SizedBox(width: 8),
            Expanded(child: Text(l10n.deliveryShareWaiting, style: theme.type.detail)),
            FButton(
              variant: FButtonVariant.ghost,
              mainAxisSize: MainAxisSize.min,
              prefix: const Icon(FIcons.send),
              onPress: () => unawaited(_askLocation()),
              child: Text(l10n.deliveryShareSendAgain),
            ),
          ],
        ),
      );
    }
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _bigButton(
          l10n.deliveryAskLocation,
          form.shareMaking ? null : () => unawaited(_askLocation()),
          outline: true,
          prefix: form.shareMaking
              ? const SizedBox.square(dimension: Sizes.iconSmall, child: FCircularProgress())
              : const Icon(FIcons.mapPinHouse),
        ),
        const SizedBox(height: 4),
        if (form.shareFailed)
          Text(l10n.deliveryShareFailed, style: theme.type.detail.copyWith(color: theme.colors.destructive))
        else if (form.shareExpired)
          Text(l10n.deliveryShareExpired, style: theme.type.detail.copyWith(color: AppColors.amber(theme.colors.brightness)))
        else
          Text(l10n.deliveryAskLocationHint, style: muted),
      ],
    );
  }

  /// Step three: all of it on one screen, the rider to give it to, and Send
  Widget _check(BuildContext context, DeliveryFormState form) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final muted = theme.type.detail.copyWith(color: theme.colors.mutedForeground);
    final quote = form.quote;
    final reading = form.reading;
    final pinned = form.pinFor(_location.text) != null;
    // The other branches that deliver to this pin, and the one chosen while it
    // is still offered. None in a business with a call centre: its calls come
    // through the hotline (the server says so too; this covers an older answer)
    final alternatives = offeredAlternatives(quote, pinned: pinned, callCentre: ref.watch(featuresProvider.select((f) => f.callCentre)));
    final sending = keptSendTo(_sendTo, alternatives, pinned: pinned);
    final branches = ref.watch(allBranchesProvider).value;
    final zone = sending == null ? form.zone : null;
    final zones = quote?.zones ?? const <DeliveryZone>[];
    final minimum = sending?.minimumOrder ?? quote?.minimumOrder ?? 0;
    final fee = sending?.fee ?? quote?.fee ?? 0;
    final phone = normalizePhone(_phone.text, _country);
    final directions = _directions.text.trim();

    Widget row(List<Widget> children, VoidCallback onEdit) => Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: children)),
              FButton(
                variant: FButtonVariant.ghost,
                mainAxisSize: MainAxisSize.min,
                prefix: const Icon(FIcons.pencil),
                onPress: onEdit,
                child: Text(l10n.deliveryEdit),
              ),
            ],
          ),
        );

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          decoration: BoxDecoration(
            border: Border.all(color: theme.colors.border),
            borderRadius: BorderRadius.circular(Sizes.radius),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              row([
                Text(_shownName(form), style: theme.type.heading),
                Text(plainPhone(phone), textDirection: TextDirection.ltr, style: muted),
              ], () => setState(() => _step = DeliveryStep.who)),
              Divider(height: 1, color: theme.colors.border),
              row([
                if (zone != null) Text(zone.name.localized(context), style: muted.copyWith(fontWeight: FontWeight.w600)),
                Text(_street.text.trim(), style: theme.type.heading),
                if ([_building, _floor, _apartment].any((c) => c.text.trim().isNotEmpty))
                  Text(_addressLine(l10n, '', _building.text.trim(), _floor.text.trim(), _apartment.text.trim()), style: muted),
                if (directions.isNotEmpty) Text('"$directions"', style: muted.copyWith(fontStyle: FontStyle.italic)),
                const SizedBox(height: 4),
                PinQualityLabel(quality: pinned ? PinSource.of(_pinSource ?? PinSource.search, hasPin: true) : PinSource.none),
                if (!pinned && form.shareWaiting) Text(l10n.deliveryShareWaiting, style: muted),
              ], () => setState(() => _step = DeliveryStep.where)),
            ],
          ),
        ),
        const SizedBox(height: 12),
        if (zones.isNotEmpty && zone == null && sending == null)
          _Warning(
            text: l10n.deliveryNoAreaPicked,
            action: FButton(
              variant: FButtonVariant.outline,
              mainAxisSize: MainAxisSize.min,
              onPress: () => setState(() => _step = DeliveryStep.where),
              child: Text(l10n.deliveryPickArea),
            ),
          ),
        // Said, not refused: the cashier knows the streets and the regulars
        if (quote != null && !reading) ...[
          // A named area is delivered to wherever it is drawn: only a pin in none is out of reach
          if (pinned && !quote.inRange && sending == null && zone == null && !form.pinInOffArea) _Warning(text: outOfRangeWarning(l10n, quote)),
          if (sending == null && ((zone != null && !zone.on) || form.pinInOffArea)) _Warning(text: l10n.deliveryAreaOffNow),
          if (minimum > 0 && widget.itemsTotal < minimum) _Warning(text: l10n.deliveryUnderMinimum(money(context, minimum))),
        ],
        Row(
          children: [
            Expanded(
              child: Text(
                zone?.etaMinutes == null ? l10n.deliveryFee : '${l10n.deliveryFee} · ${l10n.deliveryAboutMinutes(zone!.etaMinutes!)}',
                style: muted,
              ),
            ),
            if (reading)
              const SizedBox.square(dimension: Sizes.iconSmall, child: FCircularProgress())
            else
              Text(fee > 0 ? money(context, fee) : l10n.deliveryFree,
                  style: theme.type.detail.copyWith(fontWeight: FontWeight.w600, fontFeatures: const [FontFeature.tabularFigures()])),
          ],
        ),
        if (!reading && alternatives.isNotEmpty) ...[
          const SizedBox(height: 12),
          NearerBranches(
            alternatives: alternatives,
            chosen: sending?.branchId,
            branchName: (id) => branchNameOf(branches, id, context),
            onChoose: (a) {
              setState(() => _sendTo = a);
              // Sent to another branch, the area picked here no longer holds
              if (a != null) _controller.pickZone(null);
            },
          ),
        ],
        if (sending == null) ...[
          const SizedBox(height: 12),
          _RiderChoice(value: _rider, onChange: (r) => setState(() => _rider = r)),
        ],
        const SizedBox(height: 16),
        _bigButton(
          sending != null ? l10n.deliverySaveSend(branchNameOf(branches, sending.branchId, context)) : l10n.deliverySave,
          reading ? null : () => _save(form),
        ),
      ],
    );
  }
}

/// The street, then building, floor and flat, on one line in the till's words
String _addressLine(AppLocalizations l10n, String street, String? building, String? floor, String? apartment) => [
      if (street.isNotEmpty) street,
      if ((building ?? '').isNotEmpty) '${l10n.deliveryBuilding} $building',
      if ((floor ?? '').isNotEmpty) '${l10n.deliveryFloor} $floor',
      if ((apartment ?? '').isNotEmpty) '${l10n.deliveryApartment} $apartment',
    ].join(l10n.listSeparator);

/// The arrow that points on to the next step, whichever way the language reads
IconData _forwardIcon(BuildContext context) => FIcons.arrowRight;

/// Where in the three steps the call is, seen at a glance: "Step 1 of 3",
/// then a bar per step with its icon and name under it. The bars of the step
/// now and the ones behind are filled; the ones behind are ticked, say what
/// was entered there (the caller, the area and street) and are a tap away to
/// change it.
class _StepBar extends StatelessWidget {
  final DeliveryStep step;

  /// What each step behind holds, said under its name
  final Map<DeliveryStep, String> done;
  final void Function(DeliveryStep step) onGo;

  const _StepBar({required this.step, required this.done, required this.onGo});

  static const _bar = 6.0;
  static const _icons = [FIcons.userRound, FIcons.mapPin, FIcons.send];

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final labels = [l10n.deliveryStepWho, l10n.deliveryStepWhere, l10n.deliveryStepCheck];
    final at = step.index;

    Widget one(int i) {
      final past = i < at;
      final now = i == at;
      final lit = past || now;
      final held = past ? done[DeliveryStep.values[i]] ?? '' : '';
      final body = Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // The step's bar: filled behind and now
          Container(
            height: _bar,
            decoration: BoxDecoration(
              color: lit ? theme.colors.primary : theme.colors.muted,
              borderRadius: BorderRadius.circular(_bar / 2),
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Icon(
                past ? FIcons.check : _icons[i],
                size: Sizes.iconSmall,
                color: lit ? theme.colors.primary : theme.colors.mutedForeground.withValues(alpha: 0.6),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  labels[i],
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.type.detail.copyWith(
                    color: lit ? theme.colors.foreground : theme.colors.mutedForeground,
                    fontWeight: now ? FontWeight.w600 : (past ? FontWeight.w500 : null),
                  ),
                ),
              ),
            ],
          ),
          if (held.isNotEmpty)
            Padding(
              padding: const EdgeInsetsDirectional.only(start: Sizes.iconSmall + 6, top: 2),
              child: Text(
                held,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: theme.type.caption.copyWith(color: theme.colors.mutedForeground),
              ),
            ),
        ],
      );
      return past ? FTappable(semanticsLabel: labels[i], onPress: () => onGo(DeliveryStep.values[i]), child: body) : body;
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Said in words first, so a glance knows there is more to come
        TypeLabel(l10n.deliveryStepOf(at + 1, labels.length)),
        const SizedBox(height: 8),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (var i = 0; i < labels.length; i++) ...[
              if (i > 0) const SizedBox(width: 8),
              Expanded(child: one(i)),
            ],
          ],
        ),
      ],
    );
  }
}

/// Who takes it, picked while the call is still on: the branch's riders, free
/// ones first, or Later to give it from Deliveries once it is ready
class _RiderChoice extends ConsumerWidget {
  final SaleDeliveryRider? value;
  final void Function(SaleDeliveryRider? rider) onChange;

  const _RiderChoice({required this.value, required this.onChange});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final riders = ref.watch(tillRidersProvider);
    final list = [...?riders.value]..sort((a, b) => _rank(a).compareTo(_rank(b)));
    if (riders.isLoading && list.isEmpty) return const Center(child: FCircularProgress());
    if (list.isEmpty) return const SizedBox.shrink();

    Widget chip({required bool chosen, required String title, String? status, bool? free, required VoidCallback onPress}) => FTappable(
          semanticsLabel: title,
          selected: chosen,
          onPress: onPress,
          builder: (context, states, child) => Container(
            constraints: const BoxConstraints(minHeight: 48),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: chosen ? theme.colors.primary.withValues(alpha: 0.06) : null,
              border: Border.all(color: chosen ? theme.colors.primary : theme.colors.border, width: chosen ? 1.5 : 1),
              borderRadius: BorderRadius.circular(Sizes.radius),
            ),
            child: child,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (free != null) ...[
                    Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(shape: BoxShape.circle, color: free ? AppColors.emerald500 : theme.colors.mutedForeground),
                    ),
                    const SizedBox(width: 6),
                  ],
                  Text(title, style: theme.type.detail.copyWith(fontWeight: FontWeight.w600)),
                ],
              ),
              if (status != null) Text(status, style: theme.type.caption.copyWith(color: theme.colors.mutedForeground)),
            ],
          ),
        );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(l10n.deliveryGiveTo, style: theme.type.detail.copyWith(color: theme.colors.mutedForeground, fontWeight: FontWeight.w500)),
        const SizedBox(height: 6),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            chip(chosen: value == null, title: l10n.deliveryRiderLater, onPress: () => onChange(null)),
            for (final r in list)
              chip(
                chosen: value?.userId == r.userId,
                title: r.name,
                status: !r.signedIn
                    ? l10n.riderNotSignedIn
                    : !r.onDuty
                        ? l10n.riderOffDuty
                        : r.out > 0
                            ? l10n.riderOut(r.out)
                            : l10n.riderFree,
                free: r.onDuty && r.out == 0,
                onPress: () => onChange(SaleDeliveryRider.of(r)),
              ),
          ],
        ),
      ],
    );
  }

  /// Free and on duty first, then on duty and out, then the rest
  static int _rank(TillRider r) => !r.onDuty || !r.signedIn ? 2 : (r.out > 0 ? 1 : 0);
}

/// A line said in place of the form: the branch doesn't deliver, or its terms couldn't be read
class _Said extends StatelessWidget {
  final String text;

  const _Said({required this.text});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 16),
        child: Text(text,
            textAlign: TextAlign.center, style: context.theme.type.detail.copyWith(color: context.theme.colors.mutedForeground)),
      );
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
                borderRadius: BorderRadius.circular(Sizes.radius),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Icon(FIcons.store, size: Sizes.iconSmall, color: theme.colors.mutedForeground),
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
                          style: theme.type.detail,
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

  /// The way to put it right, beside the words
  final Widget? action;

  const _Warning({required this.text, this.action});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final amber = AppColors.amber(theme.colors.brightness);
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(color: AppColors.amber500.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(Sizes.radius)),
      child: Row(
        children: [
          Icon(FIcons.triangleAlert, size: Sizes.iconSmall, color: amber),
          const SizedBox(width: 6),
          Expanded(child: Text(text, style: theme.type.detail.copyWith(color: amber))),
          if (action != null) ...[const SizedBox(width: 8), action!],
        ],
      ),
    );
  }
}

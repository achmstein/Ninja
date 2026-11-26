import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/auth/auth_service.dart';
import '../../../core/brand/brand_provider.dart';
import '../../../core/services/location_service.dart';
import '../../../core/theme/theme_provider.dart';
import '../../../core/ui/ui.dart';
import '../../../core/widgets/app_text.dart';
import '../../../l10n/app_localizations.dart';
import '../models/delivery_address.dart';
import '../services/delivery_service.dart';
import 'map_picker.dart';
import 'pin_map_screen.dart';

/// A language's list comma: ", " in English, "، " in Arabic
String listSeparator(BuildContext context) => Localizations.localeOf(context).languageCode == 'ar' ? '، ' : ', ';

/// An address on one line in the customer's language: "Tahrir St · Bldg 12, Floor 3"
String addressLineOf(BuildContext context, DeliveryAddress address) {
  final l10n = AppLocalizations.of(context)!;
  return address.line(
    building: l10n.deliveryBuildingShort,
    floor: l10n.deliveryFloorShort,
    apartment: l10n.deliveryApartmentShort,
    separator: listSeparator(context),
  );
}

/// Where the order is brought: the customer's saved addresses, one tap to
/// pick (client_web's address-sheet.tsx). A new one is the delivery apps'
/// way: the whole screen a map to put the pin on the door ([pickPinOnMap]),
/// then this sheet for the words that find it. Opened from the tray, and from
/// the You page's "My addresses" ([manage]: picking one there edits it rather
/// than choosing it). From the tray, a customer with none goes straight to the map.
Future<void> showAddressSheet(BuildContext context, {bool manage = false}) async {
  PinnedPoint? pin;
  final saved = ProviderScope.containerOf(context).read(myAddressesProvider);
  if (!manage && saved.hasValue && saved.value!.isEmpty) {
    pin = await pickPinOnMap(context);
    if (pin == null || !context.mounted) return;
  }
  await showNinjaSheet<void>(
    context: context,
    padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
    builder: (_) => _AddressSheet(manage: manage, firstPin: pin),
  );
}

class _AddressSheet extends ConsumerStatefulWidget {
  final bool manage;

  /// The pin of a new address put on the map before the sheet opened
  final PinnedPoint? firstPin;

  const _AddressSheet({required this.manage, this.firstPin});

  @override
  ConsumerState<_AddressSheet> createState() => _AddressSheetState();
}

class _AddressSheetState extends ConsumerState<_AddressSheet> {
  /// The details, for a new address (its pin put on the map) or one being changed; unset shows the list
  late ({DeliveryAddress? address, PinnedPoint? pin})? _editing = widget.firstPin == null ? null : (address: null, pin: widget.firstPin);

  /// The map was opened on its own for a customer found to have none
  bool _mapOpened = false;

  /// A new address: the map first, then its details here; back from the map leaves the list as it was
  Future<void> _addNew({bool closeIfNone = false}) async {
    final pin = await pickPinOnMap(context);
    if (!mounted) return;
    if (pin == null) {
      if (closeIfNone) Navigator.of(context).pop();
      return;
    }
    setState(() => _editing = (address: null, pin: pin));
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final saved = ref.watch(myAddressesProvider);
    final chosen = ref.watch(deliveryChoiceProvider).address;
    final list = saved.value ?? const <DeliveryAddress>[];
    final empty = saved.hasValue && list.isEmpty;
    // A customer with none goes straight to the map, from the tray: here when that was only known once the sheet was open
    if (empty && !widget.manage && _editing == null && !_mapOpened) {
      _mapOpened = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _addNew(closeIfNone: true);
      });
    }
    final form = _editing;
    final title = form == null
        ? (widget.manage ? l10n.myAddresses : l10n.deliveryAddressTitle)
        : form.address == null
            ? l10n.deliveryNewAddress
            : l10n.deliveryEditAddress;

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(4, 0, 4, 12),
          child: AppText(title, style: context.localeText(theme.typography.headline.copyWith(fontWeight: FontWeight.w800, color: theme.colors.foreground))),
        ),
        if (form != null)
          _AddressForm(
            key: ValueKey(form.address?.id ?? 'new'),
            initial: form.address,
            pin: form.pin,
            onDone: (address) {
              if (widget.manage) {
                setState(() => _editing = null);
                return;
              }
              if (address != null) ref.read(deliveryChoiceProvider.notifier).setAddress(address);
              Navigator.of(context).pop();
            },
          )
        else ...[
          if (saved.isLoading && !saved.hasValue)
            SizedBox(height: 96, child: Center(child: SizedBox.square(dimension: 20, child: CircularProgressIndicator(strokeWidth: 2, color: theme.colors.mutedForeground))))
          else
            for (final address in list)
              _AddressRow(
                address: address,
                selected: !widget.manage && chosen != null && chosen.sameAs(address),
                manage: widget.manage,
                onTap: () {
                  if (widget.manage) {
                    setState(() => _editing = (address: address, pin: null));
                    return;
                  }
                  ref.read(deliveryChoiceProvider.notifier).setAddress(address);
                  Navigator.of(context).pop();
                },
              ),
          if (widget.manage && empty)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 16),
              child: AppText(l10n.myAddressesEmpty, style: context.localeText(theme.typography.note.copyWith(color: theme.colors.mutedForeground))),
            ),
          Pressable(
            onTap: _addNew,
            child: SizedBox(
              height: 56,
              child: Row(
                children: [
                  const SizedBox(width: 16),
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(color: theme.colors.primary, shape: BoxShape.circle),
                    child: Icon(LucideIcons.plus, size: 20, color: theme.colors.primaryForeground),
                  ),
                  const SizedBox(width: 12),
                  AppText(
                    l10n.deliveryNewAddress,
                    style: context.localeText(theme.typography.body.copyWith(fontWeight: FontWeight.w600, color: theme.colors.foreground)),
                  ),
                ],
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class _AddressRow extends StatelessWidget {
  final DeliveryAddress address;
  final bool selected;
  final bool manage;
  final VoidCallback onTap;

  const _AddressRow({required this.address, required this.selected, required this.manage, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final icon = switch (labelKind(address.label)) {
      LabelKind.home => LucideIcons.house,
      LabelKind.work => LucideIcons.briefcase,
      LabelKind.other => LucideIcons.mapPin,
    };
    final name = shownLabel(address.label, home: l10n.deliveryLabelHome, work: l10n.deliveryLabelWork) ?? address.address;
    return Semantics(
      selected: selected,
      button: true,
      child: Pressable(
        onTap: onTap,
        child: Container(
          constraints: const BoxConstraints(minHeight: 64),
          margin: const EdgeInsets.only(bottom: 6),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(color: selected ? theme.colors.muted : null, borderRadius: BorderRadius.circular(20)),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(color: selected ? theme.colors.background : theme.colors.muted, shape: BoxShape.circle),
                child: Icon(icon, size: 20, color: theme.colors.foreground),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    AppText(
                      name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: context.localeText(theme.typography.body.copyWith(fontWeight: FontWeight.w600, color: theme.colors.foreground)),
                    ),
                    AppText(
                      addressLineOf(context, address),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: context.localeText(theme.typography.caption.copyWith(color: theme.colors.mutedForeground)),
                    ),
                  ],
                ),
              ),
              if (selected)
                Icon(LucideIcons.check, size: 20, color: theme.colors.foreground)
              else if (manage)
                Icon(Directionality.of(context) == TextDirection.rtl ? LucideIcons.chevronLeft : LucideIcons.chevronRight, size: 16, color: theme.colors.mutedForeground),
            ],
          ),
        ),
      ),
    );
  }
}

/// One address's details: the pin, small at the top (a tap opens the whole
/// screen map to move it), then the words a rider needs. A new one comes here
/// only with its pin put on the map ([pin]). Removing one is at the foot of its
/// form, asked once more.
class _AddressForm extends ConsumerStatefulWidget {
  final DeliveryAddress? initial;
  final PinnedPoint? pin;
  final void Function(DeliveryAddress? address) onDone;

  const _AddressForm({super.key, required this.initial, this.pin, required this.onDone});

  @override
  ConsumerState<_AddressForm> createState() => _AddressFormState();
}

class _AddressFormState extends ConsumerState<_AddressForm> {
  late final DeliveryAddress? _initial = widget.initial;
  late LatLng _point = _initial != null ? (lat: _initial.latitude, lng: _initial.longitude) : widget.pin!.point;

  late final _street = TextEditingController(text: _initial?.address ?? widget.pin?.street ?? '');
  late final _building = TextEditingController(text: _initial?.building ?? '');
  late final _floor = TextEditingController(text: _initial?.floor ?? '');
  late final _apartment = TextEditingController(text: _initial?.apartment ?? '');
  late final _directions = TextEditingController(text: _initial?.directions ?? '');
  // Shown the local way; kept and sent in the international form
  late final _phone = TextEditingController(
      text: ref.read(brandProvider).locale.editablePhone(_initial?.phone ?? ref.read(authServiceProvider).phoneNumber));
  late LabelKind _kind = labelKind(_initial?.label);
  late final _labelText = TextEditingController(text: labelKind(_initial?.label) == LabelKind.other ? (_initial?.label ?? '') : '');

  bool _tried = false;
  bool _busy = false;
  bool _removing = false;

  /// The pin moved on the whole screen map; a street the search found there fills an empty street
  Future<void> _adjust() async {
    final pin = await pickPinOnMap(context, at: _point);
    if (pin == null || !mounted) return;
    setState(() {
      _point = pin.point;
      if (_street.text.trim().isEmpty && pin.street != null) _street.text = pin.street!;
    });
  }

  @override
  void dispose() {
    for (final c in [_street, _building, _floor, _apartment, _directions, _phone, _labelText]) {
      c.dispose();
    }
    super.dispose();
  }

  String? _problem(AppLocalizations l10n) {
    final phoneOk = ref.read(brandProvider).locale.isValidPhone(_phone.text);
    if (_street.text.trim().isEmpty) return l10n.deliveryNeedStreet;
    if (!phoneOk) return l10n.deliveryNeedPhone;
    return null;
  }

  Future<void> _save() async {
    final l10n = AppLocalizations.of(context)!;
    setState(() => _tried = true);
    if (_problem(l10n) != null) return;
    String? text(TextEditingController c) => c.text.trim().isEmpty ? null : c.text.trim();
    final address = DeliveryAddress(
      id: _initial?.id,
      label: storedLabel(_kind, _labelText.text),
      latitude: _point.lat,
      longitude: _point.lng,
      address: _street.text.trim(),
      building: text(_building),
      floor: text(_floor),
      apartment: text(_apartment),
      directions: text(_directions),
      phone: ref.read(brandProvider).locale.normalizePhone(_phone.text),
    );
    setState(() => _busy = true);
    try {
      final repository = ref.read(deliveryRepositoryProvider);
      final saved = address.id != null ? await repository.update(address) : await repository.add(address);
      await ref.read(myAddressesProvider.notifier).refresh();
      showIsland(title: Text(l10n.deliveryAddressSaved), icon: const Icon(LucideIcons.check, color: NinjaColors.success));
      widget.onDone(saved);
    } catch (_) {
      showIsland(title: Text(l10n.deliveryAddressNotSaved), icon: const Icon(LucideIcons.circleX, color: NinjaColors.error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _remove() async {
    final l10n = AppLocalizations.of(context)!;
    final id = _initial?.id;
    if (id == null) return;
    setState(() => _busy = true);
    try {
      await ref.read(deliveryRepositoryProvider).remove(id);
      final choice = ref.read(deliveryChoiceProvider);
      if (choice.address?.id == id) ref.read(deliveryChoiceProvider.notifier).setAddress(null);
      await ref.read(myAddressesProvider.notifier).refresh();
      showIsland(title: Text(l10n.deliveryAddressRemoved), icon: const Icon(LucideIcons.check, color: NinjaColors.success));
      widget.onDone(null);
    } catch (_) {
      showIsland(title: Text(l10n.deliveryAddressNotRemoved), icon: const Icon(LucideIcons.circleX, color: NinjaColors.error));
    } finally {
      if (mounted) {
        setState(() {
          _busy = false;
          _removing = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final c = theme.colors;
    final l10n = AppLocalizations.of(context)!;
    final problem = _tried ? _problem(l10n) : null;
    final caption = context.localeText(theme.typography.caption.copyWith(color: c.mutedForeground));

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _PinPreview(point: _point, onTap: _busy ? null : _adjust),
        const SizedBox(height: 12),
        NinjaField(
          controller: _street,
          hint: l10n.deliveryStreet,
          textCapitalization: TextCapitalization.words,
          autofillHints: const [AutofillHints.fullStreetAddress],
          onChange: (_) => setState(() {}),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(child: NinjaField(controller: _building, hint: l10n.deliveryBuilding)),
            const SizedBox(width: 8),
            Expanded(child: NinjaField(controller: _floor, hint: l10n.deliveryFloor, keyboardType: TextInputType.number)),
            const SizedBox(width: 8),
            Expanded(child: NinjaField(controller: _apartment, hint: l10n.deliveryApartment)),
          ],
        ),
        const SizedBox(height: 8),
        NinjaField(controller: _directions, hint: l10n.deliveryDirectionsHint, maxLines: 2),
        const SizedBox(height: 8),
        Directionality(
          textDirection: TextDirection.ltr,
          child: NinjaField(
            controller: _phone,
            hint: l10n.deliveryPhone,
            keyboardType: TextInputType.phone,
            autofillHints: const [AutofillHints.telephoneNumber],
            onChange: (_) => setState(() {}),
          ),
        ),
        if (problem != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(4, 8, 4, 0),
            child: AppText(problem, style: caption.copyWith(color: c.destructive)),
          ),
        const SizedBox(height: 12),
        // What it is called: Home, Work, or the customer's own word
        Row(
          children: [
            for (final kind in const [LabelKind.home, LabelKind.work]) ...[
              Pressable(
                onTap: () => setState(() => _kind = _kind == kind ? LabelKind.other : kind),
                child: Container(
                  height: 44,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  alignment: Alignment.center,
                  decoration: ShapeDecoration(color: _kind == kind ? c.primary : c.muted, shape: const StadiumBorder()),
                  child: AppText(
                    kind == LabelKind.home ? l10n.deliveryLabelHome : l10n.deliveryLabelWork,
                    style: context.localeText(theme.typography.note.copyWith(
                      fontWeight: FontWeight.w600,
                      color: _kind == kind ? c.primaryForeground : c.foreground,
                    )),
                  ),
                ),
              ),
              const SizedBox(width: 8),
            ],
            Expanded(
              child: NinjaField(
                controller: _labelText,
                hint: l10n.deliveryLabel,
                onChange: (_) => setState(() => _kind = LabelKind.other),
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        NinjaButton(
          busy: _busy && !_removing,
          onPress: _busy ? null : _save,
          prefix: const Icon(LucideIcons.check),
          child: AppText(l10n.deliverySaveDetails),
        ),
        if (_initial?.id != null) ...[
          const SizedBox(height: 8),
          if (_removing) ...[
            AppText(
              l10n.deliveryRemoveConfirm,
              textAlign: TextAlign.center,
              style: context.localeText(theme.typography.note.copyWith(fontWeight: FontWeight.w600, color: c.foreground)),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: NinjaButton(
                    variant: NinjaButtonVariant.secondary,
                    onPress: _busy ? null : () => setState(() => _removing = false),
                    child: AppText(l10n.deliveryKeep),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: NinjaButton(
                    variant: NinjaButtonVariant.destructive,
                    busy: _busy,
                    onPress: _busy ? null : _remove,
                    child: AppText(l10n.deliveryRemoveYes),
                  ),
                ),
              ],
            ),
          ] else
            NinjaButton(
              variant: NinjaButtonVariant.ghost,
              onPress: _busy ? null : () => setState(() => _removing = true),
              prefix: Icon(LucideIcons.trash2, color: c.destructive),
              child: AppText(l10n.deliveryRemoveAddress, style: TextStyle(color: c.destructive)),
            ),
        ],
      ],
    );
  }
}

/// The pin, small and still, at the top of an address's details: a tap opens
/// the whole screen map to move it
class _PinPreview extends StatelessWidget {
  final LatLng point;
  final VoidCallback? onTap;

  const _PinPreview({required this.point, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final c = theme.colors;
    final l10n = AppLocalizations.of(context)!;
    return Pressable(
      onTap: onTap,
      semanticLabel: l10n.deliveryAdjustPin,
      child: SizedBox(
        height: 132,
        child: Stack(
          fit: StackFit.expand,
          children: [
            // Not to be moved here: a finger on it is the tap that opens the big one
            IgnorePointer(
              child: ExcludeSemantics(
                child: MapPicker(start: point, to: point, onSettle: (_, _) {}),
              ),
            ),
            PositionedDirectional(
              end: 8,
              bottom: 8,
              child: Container(
                height: 32,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: ShapeDecoration(color: c.background, shape: const StadiumBorder(), shadows: Ninja.surfaceShadow),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(LucideIcons.move, size: 14, color: c.foreground),
                    const SizedBox(width: 6),
                    AppText(
                      l10n.deliveryAdjustPin,
                      style: context.localeText(theme.typography.caption.copyWith(fontWeight: FontWeight.w600, color: c.foreground)),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

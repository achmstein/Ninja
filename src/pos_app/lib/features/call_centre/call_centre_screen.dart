import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import 'package:ninja_app_core/models/branch.dart';
import 'package:ninja_app_core/models/localized_text.dart';
import 'package:ninja_app_core/providers/branch_provider.dart';
import 'package:ninja_app_core/theme/app_theme.dart';
import 'package:ninja_app_core/theme/text_styles.dart';
import '../../core/brand/brand_provider.dart';
import '../../core/config/app_config.dart';
import '../../core/models/money.dart';
import '../../core/utils/phone.dart';
import '../../core/widgets/pos_dialog.dart';
import '../../core/widgets/pos_toast.dart';
import '../../l10n/app_localizations.dart';
import '../deliveries/models/delivery_order.dart';
import '../deliveries/widgets/delivery_details.dart';
import '../sale/models/sale_delivery.dart';
import '../sale/models/sale_line.dart';
import 'call_centre_controller.dart';

/// Enough digits to be worth looking the caller up
const _minPhoneDigits = 8;

/// The call centre's home: "next caller". Every sale starts from the caller,
/// not from a branch: their number (their account and the addresses any
/// branch delivered to before), then where it goes, which picks the branch
/// that delivers there (the agent may choose another), or a pickup at a
/// branch they name. The till then works as that branch for the one order.
class CallCentreScreen extends ConsumerStatefulWidget {
  const CallCentreScreen({super.key});

  @override
  ConsumerState<CallCentreScreen> createState() => _CallCentreScreenState();
}

class _CallCentreScreenState extends ConsumerState<CallCentreScreen> {
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _street = TextEditingController();
  final _building = TextEditingController();
  final _floor = TextEditingController();
  final _apartment = TextEditingController();
  final _directions = TextEditingController();
  final _location = TextEditingController();
  Timer? _phonePause;
  bool _tried = false;

  /// The paused branch whose pick was tapped once
  int? _confirming;

  String get _country => ref.read(brandProvider).locale.country;
  CallCentreController get _controller => ref.read(callCentreControllerProvider.notifier);

  @override
  void initState() {
    super.initState();
    // Each call starts clean: nothing of the last caller is kept
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _controller.reset();
    });
    _phone.addListener(() {
      _phonePause?.cancel();
      final digits = phoneDigitCount(_phone.text);
      _phonePause = Timer(AppConfig.deliveryLookupDebounce,
          () => _controller.lookUp(digits >= _minPhoneDigits ? normalizePhone(_phone.text, _country) : ''));
      if (_tried) setState(() {});
    });
    for (final c in [_name, _street]) {
      c.addListener(() {
        if (_tried) setState(() {});
      });
    }
  }

  @override
  void dispose() {
    _phonePause?.cancel();
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
    _location.text = a.latitude != null && a.longitude != null ? '${a.latitude}, ${a.longitude}' : '';
    if (_location.text.isNotEmpty) unawaited(_controller.resolve(_location.text));
  }

  bool get _phoneOk => phoneDigitCount(_phone.text) >= _minPhoneDigits;

  SaleCustomer? _customer(CallCentreState call) {
    final account = call.customer;
    if (account != null) {
      return SaleCustomer(id: account.id, name: account.displayName, phone: account.phoneNumber, addedAtCounter: account.addedAtCounter);
    }
    final name = _name.text.trim();
    return name.isEmpty ? null : SaleCustomer(name: name, phone: normalizePhone(_phone.text, _country));
  }

  Future<void> _take({required int branchId, required bool delivery}) async {
    final call = ref.read(callCentreControllerProvider);
    setState(() => _tried = true);
    final customer = _customer(call);
    if (customer == null || !_phoneOk || (delivery && _street.text.trim().isEmpty)) return;
    final resolution = call.resolution;
    final pinned = resolution != null && call.resolvedFor == _location.text.trim() && resolution.pinned;
    await _controller.start(
      branchId: branchId,
      customer: customer,
      delivery: delivery
          ? SaleDelivery(
              address: _street.text.trim(),
              phone: normalizePhone(_phone.text, _country),
              building: _building.text.trim(),
              floor: _floor.text.trim(),
              apartment: _apartment.text.trim(),
              directions: _directions.text.trim(),
              location: _location.text.trim(),
              latitude: pinned ? resolution.latitude : null,
              longitude: pinned ? resolution.longitude : null,
            )
          : null,
    );
    if (mounted) context.go('/sale');
  }

  Future<void> _pickup(List<Branch> branches) async {
    final l10n = AppLocalizations.of(context)!;
    setState(() => _tried = true);
    if (_customer(ref.read(callCentreControllerProvider)) == null || !_phoneOk) return;
    final branchId = await showPosDialog<int>(
      context,
      maxWidth: 420,
      builder: (dialogContext) => DialogScroll(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(l10n.callCentrePickupAt, style: dialogContext.theme.typography.xl.copyWith(fontWeight: FontWeight.w600)),
            const SizedBox(height: 12),
            for (final b in branches)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: SizedBox(
                  height: 48,
                  child: FButton(
                    variant: FButtonVariant.outline,
                    prefix: const Icon(FIcons.store),
                    onPress: () => Navigator.of(dialogContext, rootNavigator: true).pop(b.id),
                    child: Text(b.name.localized(dialogContext)),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
    if (branchId == null || !mounted) return;
    await _take(branchId: branchId, delivery: false);
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final muted = theme.typography.sm.copyWith(color: theme.colors.mutedForeground);
    final error = theme.typography.sm.copyWith(color: theme.colors.destructive);
    final amber = AppColors.amber(theme.colors.brightness);
    final call = ref.watch(callCentreControllerProvider);
    final branches = ref.watch(branchProvider).branches;
    final resolution = call.resolvedFor == _location.text.trim() ? call.resolution : null;
    final chosen = resolution == null ? null : call.chosen;

    String nameOf(int id) {
      for (final b in branches) {
        if (b.id == id) return b.name.localized(context);
      }
      return '#$id';
    }

    Widget field(TextEditingController controller, String label, {String? hint, TextInputType? keyboard, TextDirection? direction}) =>
        FTextField(
          control: FTextFieldControl.managed(controller: controller),
          label: Text(label),
          hint: hint,
          keyboardType: keyboard,
          textDirection: direction,
        );

    Widget errorText(bool show, String text) =>
        _tried && show ? Padding(padding: const EdgeInsets.only(top: 4), child: Text(text, style: error)) : const SizedBox.shrink();

    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 640),
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            Row(
              children: [
                const Icon(FIcons.headset, size: 24),
                const SizedBox(width: 8),
                Expanded(child: Text(l10n.callCentreNextCaller, style: theme.typography.xl2.copyWith(fontWeight: FontWeight.w700))),
              ],
            ),
            const SizedBox(height: 4),
            Text(l10n.callCentreCallerHint, style: muted),
            const SizedBox(height: 16),
            field(_phone, l10n.deliveryPhoneLabel, keyboard: TextInputType.phone, direction: TextDirection.ltr),
            errorText(!_phoneOk, l10n.deliveryPhoneInvalid),
            const SizedBox(height: 12),
            // An account brings its name; a caller without one says theirs
            if (call.customer != null)
              Row(
                children: [
                  Icon(FIcons.userCheck, size: 16, color: theme.colors.primary),
                  const SizedBox(width: 6),
                  Expanded(child: Text(call.customer!.displayName, style: theme.typography.base.copyWith(fontWeight: FontWeight.w600))),
                ],
              )
            else ...[
              field(_name, l10n.deliveryCustomerName),
              errorText(_name.text.trim().isEmpty, l10n.deliveryNeedsName),
            ],
            if (call.known.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text(l10n.deliveryKnownAddresses, style: theme.typography.xs.copyWith(color: theme.colors.mutedForeground)),
              const SizedBox(height: 6),
              for (final a in call.known)
                Padding(
                  key: ValueKey(a.identity),
                  padding: const EdgeInsets.only(bottom: 6),
                  child: FTappable(
                    onPress: () => setState(() => _pickKnown(a)),
                    builder: (context, states, child) => Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        border: Border.all(color: a.address == _street.text.trim() ? theme.colors.primary : theme.colors.border),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: child,
                    ),
                    child: Row(
                      children: [
                        Icon(FIcons.mapPin, size: 14, color: theme.colors.mutedForeground),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            [
                              if ((a.label ?? '').isNotEmpty) a.label!,
                              a.address,
                              if ((a.building ?? '').isNotEmpty) '${l10n.deliveryBuilding} ${a.building}',
                            ].join(l10n.listSeparator),
                            style: theme.typography.sm,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
            const SizedBox(height: 12),
            field(_street, l10n.deliveryStreetLabel),
            errorText(_street.text.trim().isEmpty && chosen != null, l10n.deliveryNeedsStreet),
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
            const SizedBox(height: 8),
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: FButton(
                variant: FButtonVariant.secondary,
                mainAxisSize: MainAxisSize.min,
                prefix: call.resolving ? const SizedBox.square(dimension: 14, child: FCircularProgress()) : const Icon(FIcons.search),
                onPress: call.resolving
                    ? null
                    : () {
                        if (_location.text.trim().isEmpty) {
                          showPosToast(context, PosToastType.info, l10n.callCentreNeedsLocation);
                          return;
                        }
                        setState(() => _confirming = null);
                        _controller.resolve(_location.text);
                      },
                child: Text(l10n.callCentreFindBranch),
              ),
            ),
            if (call.resolveFailed) ...[
              const SizedBox(height: 8),
              Text(l10n.deliveryLocationNotChecked, style: muted),
            ] else if (resolution != null) ...[
              const SizedBox(height: 12),
              if (!resolution.locationRead)
                Text(l10n.deliveryLocationUnread, style: muted)
              else if (resolution.branches.isEmpty)
                Text(l10n.callCentreNoBranch, style: muted)
              else
                for (final b in resolution.branches)
                  Padding(
                    key: ValueKey(b.branchId),
                    padding: const EdgeInsets.only(bottom: 8),
                    child: FTappable(
                      onPress: () {
                        // A paused branch stopped its customers' orders: the agent is asked once more
                        if (b.paused && _confirming != b.branchId && chosen?.branchId != b.branchId) {
                          setState(() => _confirming = b.branchId);
                          return;
                        }
                        setState(() => _confirming = null);
                        _controller.choose(b);
                      },
                      builder: (context, states, child) => Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: chosen?.branchId == b.branchId ? theme.colors.primary.withValues(alpha: 0.06) : null,
                          border: Border.all(color: chosen?.branchId == b.branchId ? theme.colors.primary : theme.colors.border),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: child,
                      ),
                      child: Row(
                        children: [
                          Icon(chosen?.branchId == b.branchId ? FIcons.circleCheck : FIcons.store, size: 16),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text.rich(
                              TextSpan(children: [
                                TextSpan(
                                  text: _confirming == b.branchId
                                      ? l10n.deliverySendToPaused(nameOf(b.branchId))
                                      : l10n.callCentreBranchFor(
                                          nameOf(b.branchId),
                                          distanceLabel(l10n, b.distanceMeters),
                                          b.fee > 0 ? money(context, b.fee) : l10n.deliveryFree,
                                        ),
                                ),
                                if (b.paused && _confirming != b.branchId)
                                  TextSpan(text: ' · ${l10n.deliveryBranchPaused}', style: TextStyle(color: amber, fontWeight: FontWeight.w600)),
                              ]),
                              style: theme.typography.sm,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
            ],
            const SizedBox(height: 16),
            if (chosen != null)
              SizedBox(
                height: 52,
                child: FButton(
                  prefix: const Icon(FIcons.bike),
                  onPress: () => _take(branchId: chosen.branchId, delivery: true),
                  child: Text(l10n.callCentreTakeAt(nameOf(chosen.branchId)), style: theme.typography.lg.forButton),
                ),
              ),
            const SizedBox(height: 8),
            SizedBox(
              height: 48,
              child: FButton(
                variant: FButtonVariant.outline,
                prefix: const Icon(FIcons.shoppingBag),
                onPress: branches.isEmpty ? null : () => _pickup(branches),
                child: Text(l10n.callCentrePickupAt),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

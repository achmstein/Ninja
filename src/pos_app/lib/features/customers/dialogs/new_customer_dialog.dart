import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import '../../../core/brand/brand_provider.dart';
import '../../../core/network/network_status.dart';
import '../../../core/theme/text_styles.dart';
import '../../../core/utils/name_match.dart';
import '../../../core/utils/phone.dart';
import '../../../core/widgets/pos_dialog.dart';
import '../../../core/widgets/toast_helpers.dart';
import '../../../l10n/app_localizations.dart';
import '../../sale/models/sale_line.dart';
import '../providers/customer_providers.dart';
import '../services/customer_search_service.dart';

const _lookupDebounce = Duration(milliseconds: 300);
const _minPhoneDigits = 7;
const _minNameLength = 2;

SaleCustomer _saleCustomer(IdentityUser user) =>
    SaleCustomer(id: user.id, name: user.displayName, phone: user.phoneNumber, addedAtCounter: user.addedAtCounter);

/// A customer by name and phone, added at the counter so their points
/// start with this sale. While the cashier types, the number is checked
/// against everyone the café already has (normalized the way the server
/// keeps it: Arabic digits, spaces, +20), and names that look alike are
/// offered — so the regular who never gave their number twice is not added
/// twice. Resolves to the customer to attach, or null when cancelled.
Future<SaleCustomer?> showNewCustomerDialog(BuildContext context, {String name = '', String phone = ''}) {
  return showPosDialog<SaleCustomer>(
    context,
    builder: (context) => _NewCustomerDialog(initialName: name, initialPhone: phone),
  );
}

class _NewCustomerDialog extends ConsumerStatefulWidget {
  final String initialName;
  final String initialPhone;
  const _NewCustomerDialog({this.initialName = '', this.initialPhone = ''});

  @override
  ConsumerState<_NewCustomerDialog> createState() => _NewCustomerDialogState();
}

class _NewCustomerDialogState extends ConsumerState<_NewCustomerDialog> {
  late final _name = TextEditingController(text: widget.initialName);
  late final _phone = TextEditingController(text: widget.initialPhone);
  Timer? _debounce;
  CustomerLookup _lookup = CustomerLookup.empty;
  // What the lookup on screen was asked, so a late answer to an older question is dropped
  String _asked = '';
  bool _saving = false;
  bool _nameError = false;
  String? _phoneError;
  // The customer a 409 named, when the lookup had not caught them
  IdentityUser? _conflict;

  @override
  void initState() {
    super.initState();
    _name.addListener(_changed);
    _phone.addListener(_changed);
    _typed = '${_name.text}|${_phone.text}';
    // What the search carried over is checked straight away
    if (widget.initialName.isNotEmpty || widget.initialPhone.isNotEmpty) {
      _debounce = Timer(Duration.zero, _runLookup);
    }
  }

  // The text as last seen: a controller also notifies on a cursor move
  String _typed = '';

  @override
  void dispose() {
    _debounce?.cancel();
    _name.dispose();
    _phone.dispose();
    super.dispose();
  }

  String get _country => ref.read(brandProvider).locale.country;

  void _changed() {
    final typed = '${_name.text}|${_phone.text}';
    if (typed == _typed) return;
    _typed = typed;
    setState(() {
      _nameError = false;
      _phoneError = null;
      _conflict = null;
    });
    _debounce?.cancel();
    _debounce = Timer(_lookupDebounce, _runLookup);
  }

  Future<void> _runLookup() async {
    final phone = normalizePhone(_phone.text, _country);
    final name = _name.text.trim();
    final askPhone = phone.replaceAll('+', '').length >= _minPhoneDigits ? phone : '';
    final askName = normalizeName(name).length >= _minNameLength ? name : '';
    final question = '$askPhone|$askName';
    if (question == _asked) return;
    _asked = question;
    if (askPhone.isEmpty && askName.isEmpty) {
      setState(() => _lookup = CustomerLookup.empty);
      return;
    }
    try {
      final found = await ref.read(counterCustomerServiceProvider).lookup(phone: askPhone, name: askName);
      if (!mounted || _asked != question) return;
      setState(() => _lookup = found);
    } catch (_) {
      // The check is a help, not a gate: the server's 409 still stands behind the button
    }
  }

  void _use(IdentityUser user) => Navigator.of(context, rootNavigator: true).pop(_saleCustomer(user));

  Future<void> _create() async {
    final l10n = AppLocalizations.of(context)!;
    final name = _name.text.trim();
    final phone = normalizePhone(_phone.text, _country);
    if (name.isEmpty) {
      setState(() => _nameError = true);
      return;
    }
    setState(() => _saving = true);
    try {
      final result = await ref.read(counterCustomerServiceProvider).add(name: name, phone: phone);
      if (!mounted) return;
      switch (result) {
        case CustomerAdded(:final user):
          showSuccessToast(context, l10n.customerAdded);
          _use(user);
        case CustomerExists(:final existing):
          setState(() => _conflict = existing);
        case CustomerRefused(:final field, :final placeholder):
          setState(() {
            if (field == 'name') {
              _nameError = true;
            } else {
              _phoneError = l10n.phoneLike(placeholder ?? '');
            }
          });
      }
    } catch (_) {
      if (mounted) showErrorToast(context, l10n.somethingWentWrong);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final muted = theme.typography.sm.copyWith(color: theme.colors.mutedForeground);
    final error = theme.typography.sm.copyWith(color: theme.colors.destructive);

    final typedPhone = normalizePhone(_phone.text, _country);
    // An exact number match is the same person: using them is the way on
    final exact = _conflict ?? (_lookup.match != null && _lookup.phone == typedPhone && typedPhone.isNotEmpty ? _lookup.match : null);
    final similar = _lookup.similar.where((u) => u.id != exact?.id).take(3).toList();
    final canCreate = !_saving && exact == null && _name.text.trim().isNotEmpty && typedPhone.isNotEmpty;

    return DialogScroll(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(l10n.newCustomer, style: theme.typography.xl.copyWith(fontWeight: FontWeight.w600)),
          const SizedBox(height: 16),
          FTextField(
            control: FTextFieldControl.managed(controller: _name),
            label: Text(l10n.newCustomerName),
            autofocus: widget.initialName.isEmpty,
            textCapitalization: TextCapitalization.words,
          ),
          if (_nameError) ...[
            const SizedBox(height: 4),
            Text(l10n.nameRequired, style: error),
          ],
          const SizedBox(height: 12),
          FTextField(
            control: FTextFieldControl.managed(controller: _phone),
            label: Text(l10n.newCustomerPhone),
            keyboardType: TextInputType.phone,
            autofocus: widget.initialName.isNotEmpty && widget.initialPhone.isEmpty,
          ),
          if (_phoneError case final message?) ...[
            const SizedBox(height: 4),
            Text(message, style: error),
          ],
          if (exact != null) ...[
            const SizedBox(height: 12),
            _ExistingCard(user: exact, onUse: () => _use(exact)),
          ],
          if (similar.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(l10n.didYouMean, style: muted),
            const SizedBox(height: 4),
            for (final user in similar)
              FTappable(
                onPress: () => _use(user),
                builder: (context, states, child) => Container(
                  constraints: const BoxConstraints(minHeight: 48),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: states.contains(FTappableVariant.pressed) ? theme.colors.secondary : null,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: child,
                ),
                child: Row(
                  children: [
                    Icon(FIcons.user, size: 18, color: theme.colors.mutedForeground),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(user.displayName, maxLines: 1, overflow: TextOverflow.ellipsis,
                              style: theme.typography.base.copyWith(fontWeight: FontWeight.w500)),
                          if (user.contact case final contact?)
                            Directionality(textDirection: TextDirection.ltr, child: Text(contact, style: muted)),
                        ],
                      ),
                    ),
                    if (sameName(user.displayName, _name.text))
                      FBadge(variant: FBadgeVariant.secondary, child: Text(l10n.sameName)),
                  ],
                ),
              ),
          ],
          const SizedBox(height: 20),
          Row(
            children: [
              Expanded(
                child: SizedBox(
                  height: 48,
                  child: FButton(
                    variant: FButtonVariant.outline,
                    onPress: () => Navigator.of(context, rootNavigator: true).pop(),
                    child: Text(l10n.cancel, style: theme.typography.base.forButton),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: SizedBox(
                  height: 48,
                  child: FButton(
                    // With a match on screen, using them is the primary way on
                    variant: exact != null ? FButtonVariant.outline : null,
                    onPress: canCreate ? _create : null,
                    child: Text(l10n.createCustomer, style: theme.typography.base.forButton),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// "Already a customer": who the number belongs to, their points, and the
/// way to use them instead
class _ExistingCard extends ConsumerWidget {
  final IdentityUser user;
  final VoidCallback onUse;
  const _ExistingCard({required this.user, required this.onUse});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final muted = theme.typography.sm.copyWith(color: theme.colors.mutedForeground);
    final showPoints = ref.watch(featuresProvider).loyalty && ref.watch(onlineProvider);
    final points = showPoints ? ref.watch(loyaltyAccountProvider(user.id)).value?.pointsBalance : null;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: theme.colors.primary.withValues(alpha: 0.06),
        border: Border.all(color: theme.colors.primary.withValues(alpha: 0.4)),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(l10n.alreadyACustomer, style: muted),
          const SizedBox(height: 4),
          Row(
            children: [
              const Icon(FIcons.user, size: 18),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(user.displayName, maxLines: 1, overflow: TextOverflow.ellipsis,
                        style: theme.typography.base.copyWith(fontWeight: FontWeight.w600)),
                    Row(
                      children: [
                        if (user.phoneNumber case final phone?)
                          Directionality(textDirection: TextDirection.ltr, child: Text(phone, style: muted)),
                        if (points != null) ...[
                          Text('  ·  ', style: muted),
                          Flexible(child: Text(l10n.pointsBalance(points), style: muted, overflow: TextOverflow.ellipsis)),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          SizedBox(
            height: 44,
            child: FButton(
              onPress: onUse,
              child: Text(l10n.useThisCustomer, style: theme.typography.base.forButton),
            ),
          ),
        ],
      ),
    );
  }
}

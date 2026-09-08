import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import '../../../core/theme/text_styles.dart';
import '../../../l10n/app_localizations.dart';
import '../../customers/services/customer_search_service.dart';
import '../models/sale_line.dart';

const _searchDebounce = Duration(milliseconds: 300);
const _minSearchLength = 2;

/// Attach-a-customer search for loyalty accrual and on-account settling.
/// Debounced Keycloak search; the typed name is offered first because most
/// people at a table have no account and the waiters know them by name.
/// With [accountsOnly] there is no name shortcut: for the room roster, a
/// member is a tab the bill can go on, and a bare name is nobody.
/// [quickPicks] are offered before the search — the room's roster when the
/// sale is for a room; most of the time the person is already there, so
/// this is one tap instead of a search.
Future<SaleCustomer?> showCustomerDialog(
  BuildContext context, {
  bool accountsOnly = false,
  List<({String id, String name})> quickPicks = const [],
}) {
  return showFDialog<SaleCustomer>(
    context: context,
    useRootNavigator: true,
    builder: (context, style, animation) => FDialog.raw(
      style: style,
      animation: animation,
      constraints: const BoxConstraints(maxWidth: 448),
      builder: (context, _) => _CustomerDialog(accountsOnly: accountsOnly, quickPicks: quickPicks),
    ),
  );
}

class _CustomerDialog extends ConsumerStatefulWidget {
  final bool accountsOnly;
  final List<({String id, String name})> quickPicks;
  const _CustomerDialog({this.accountsOnly = false, this.quickPicks = const []});

  @override
  ConsumerState<_CustomerDialog> createState() => _CustomerDialogState();
}

class _CustomerDialogState extends ConsumerState<_CustomerDialog> {
  final _term = TextEditingController();
  Timer? _debounce;
  String _search = '';
  List<IdentityUser> _users = const [];
  bool _loading = false;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    _term.addListener(_onTermChanged);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _term.dispose();
    super.dispose();
  }

  void _onTermChanged() {
    setState(() {});
    _debounce?.cancel();
    _debounce = Timer(_searchDebounce, _runSearch);
  }

  Future<void> _runSearch() async {
    final term = _term.text.trim();
    final search = term.length >= _minSearchLength ? term : '';
    if (search == _search && !_failed) return;
    setState(() {
      _search = search;
      _failed = false;
      _users = const [];
      _loading = search.isNotEmpty;
    });
    if (search.isEmpty) return;
    try {
      final users = await ref.read(customerSearchServiceProvider).search(search);
      if (!mounted || _search != search) return;
      setState(() {
        _users = users;
        _loading = false;
      });
    } catch (_) {
      if (!mounted || _search != search) return;
      setState(() {
        _failed = true;
        _loading = false;
      });
    }
  }

  void _pick(SaleCustomer customer) => Navigator.of(context, rootNavigator: true).pop(customer);

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final typedName = _term.text.trim();
    final muted = theme.typography.sm.copyWith(color: theme.colors.mutedForeground);

    Widget centered(String text) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 32),
          child: Text(text, textAlign: TextAlign.center, style: muted),
        );

    return ConstrainedBox(
      constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.85),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(l10n.chooseCustomer, style: theme.typography.xl.copyWith(fontWeight: FontWeight.w600)),
            const SizedBox(height: 16),
            if (widget.quickPicks.isNotEmpty) ...[
              Text(l10n.inTheRoom, style: muted),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final person in widget.quickPicks)
                    SizedBox(
                      height: 44,
                      child: FButton(
                        variant: FButtonVariant.outline,
                        mainAxisSize: MainAxisSize.min,
                        onPress: () => _pick(SaleCustomer(id: person.id, name: person.name)),
                        prefix: Icon(FIcons.user, size: 16, color: theme.colors.mutedForeground),
                        child: Text(person.name.isNotEmpty ? person.name : l10n.guest,
                            maxLines: 1, overflow: TextOverflow.ellipsis, style: theme.typography.base.forButton),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 16),
            ],
            FTextField(
              control: FTextFieldControl.managed(controller: _term),
              hint: l10n.searchCustomersPlaceholder,
              autofocus: true,
            ),
            if (!widget.accountsOnly && typedName.isNotEmpty) ...[
              const SizedBox(height: 16),
              SizedBox(
                height: 56,
                child: FButton(
                  variant: FButtonVariant.outline,
                  mainAxisAlignment: MainAxisAlignment.start,
                  onPress: () => _pick(SaleCustomer(name: typedName)),
                  prefix: Icon(FIcons.userPlus, size: 20, color: theme.colors.mutedForeground),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(l10n.useNameAction(typedName), maxLines: 1, overflow: TextOverflow.ellipsis,
                          style: theme.typography.base.forButton.copyWith(fontWeight: FontWeight.w500)),
                      Text(l10n.noAccountNeeded, style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground)),
                    ],
                  ),
                ),
              ),
            ],
            const SizedBox(height: 8),
            Flexible(
              child: _search.isEmpty
                  ? centered(l10n.typeToSearch)
                  : _loading
                      ? const Padding(
                          padding: EdgeInsets.symmetric(vertical: 32),
                          child: Center(child: SizedBox.square(dimension: 24, child: CircularProgressIndicator(strokeWidth: 2))),
                        )
                      : _failed
                          ? centered(l10n.somethingWentWrong)
                          : _users.isEmpty
                              ? centered(l10n.noCustomersFound)
                              : ListView.builder(
                                  shrinkWrap: true,
                                  itemCount: _users.length,
                                  itemBuilder: (context, index) {
                                    final user = _users[index];
                                    return FTappable(
                                      onPress: () => _pick(SaleCustomer(id: user.id, name: user.displayName)),
                                      builder: (context, states, child) => Container(
                                        constraints: const BoxConstraints(minHeight: 56),
                                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                        decoration: BoxDecoration(
                                          color: states.contains(FTappableVariant.pressed) ? theme.colors.secondary : null,
                                          borderRadius: BorderRadius.circular(10),
                                        ),
                                        child: child,
                                      ),
                                      child: Row(
                                        children: [
                                          Icon(FIcons.user, size: 20, color: theme.colors.mutedForeground),
                                          const SizedBox(width: 12),
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                Text(user.displayName, maxLines: 1, overflow: TextOverflow.ellipsis,
                                                    style: theme.typography.base.copyWith(fontWeight: FontWeight.w500)),
                                                if (user.contact != null)
                                                  Text(user.contact!, maxLines: 1, overflow: TextOverflow.ellipsis, style: muted),
                                              ],
                                            ),
                                          ),
                                        ],
                                      ),
                                    );
                                  },
                                ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              height: 48,
              child: FButton(
                variant: FButtonVariant.outline,
                onPress: () => Navigator.of(context, rootNavigator: true).pop(),
                child: Text(l10n.cancel, style: theme.typography.base.forButton),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

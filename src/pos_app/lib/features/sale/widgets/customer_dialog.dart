import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import '../../../core/widgets/skeleton.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import 'package:ninja_app_core/theme/text_styles.dart';
import '../../../core/utils/highlight.dart';
import '../../../core/widgets/pos_toast.dart';
import '../../../l10n/app_localizations.dart';
import '../../../core/utils/bidi.dart';
import '../../../core/utils/phone.dart';
import '../../customers/dialogs/customer_card_dialog.dart';
import '../../customers/dialogs/new_customer_dialog.dart';
import '../../customers/services/customer_search_service.dart';
import '../models/sale_line.dart';

const _searchDebounce = Duration(milliseconds: 300);
const _minSearchLength = 2;

/// Attach-a-customer search for loyalty accrual and on-account settling —
/// the one picker behind "Choose customer" on the sale pad and in the
/// new-bill dialog. Debounced Keycloak search; the typed name is offered first because most
/// people at a table have no account and the waiters know them by name.
/// With [accountsOnly] there is no name shortcut: for the room roster, a
/// member is a tab the bill can go on, and a bare name is nobody.
/// [quickPicks] are offered before the search — the room's roster when the
/// sale is for a room; most of the time the person is already there, so
/// this is one tap instead of a search.
/// [title] replaces "Choose customer" for a plain lookup.
/// [busy] are accounts that cannot be picked, each with where their bill
/// is: opening a new bill, whoever already has one running shows greyed
/// out with it — one person, one bill.
Future<SaleCustomer?> showCustomerDialog(
  BuildContext context, {
  bool accountsOnly = false,
  List<({String id, String name})> quickPicks = const [],
  String? title,
  Map<String, String> busy = const {},
}) {
  // A sheet down the screen's end side, the whole height: the field stays at
  // its top and the results fill it down to the keyboard, which on a
  // landscape tablet leaves a dialog no room between itself and the top.
  // The sheet takes its width from the picker itself (480, or the whole
  // screen once the field is tapped), so no width is set here
  return showFSheet<SaleCustomer>(
    context: context,
    useRootNavigator: true,
    side: Directionality.of(context) == TextDirection.rtl ? FLayout.ltr : FLayout.rtl,
    mainAxisMaxRatio: null,
    draggable: false,
    builder: (context) => _CustomerDialog(accountsOnly: accountsOnly, quickPicks: quickPicks, title: title, busy: busy),
  );
}

class _CustomerDialog extends ConsumerStatefulWidget {
  final bool accountsOnly;
  final List<({String id, String name})> quickPicks;
  final String? title;
  final Map<String, String> busy;
  const _CustomerDialog({this.accountsOnly = false, this.quickPicks = const [], this.title, this.busy = const {}});

  @override
  ConsumerState<_CustomerDialog> createState() => _CustomerDialogState();
}

class _CustomerDialogState extends ConsumerState<_CustomerDialog> {
  final _term = TextEditingController();
  final _focus = FocusNode();
  // Tapping the field is the start of a search: the sheet grows to the whole
  // screen, the field on its top row and nothing but results under it, as a
  // search opens in any phone app. With nobody in the room to offer first,
  // it opens that way, keyboard up: the search is all there is to do. The
  // back arrow brings the sheet back, or closes it when there was none
  late bool _searching = widget.quickPicks.isEmpty;
  // Adding someone takes the search's place, in the same sheet
  bool _adding = false;
  Timer? _debounce;
  String _search = '';
  List<IdentityUser> _users = const [];
  bool _loading = false;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    _term.addListener(_onTermChanged);
    _focus.addListener(() {
      if (_focus.hasFocus && !_searching) setState(() => _searching = true);
    });
  }

  void _stopSearching() {
    if (widget.quickPicks.isEmpty) {
      Navigator.of(context, rootNavigator: true).pop();
      return;
    }
    _focus.unfocus();
    setState(() => _searching = false);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _term.dispose();
    _focus.dispose();
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

  // The customer the form made or found: theirs is the bill, unless one of
  // theirs is already running
  void _added(SaleCustomer added) {
    final onBill = widget.busy[added.id];
    if (onBill != null) {
      showPosToast(context, PosToastType.error, AppLocalizations.of(context)!.alreadyOnBill(onBill));
      return;
    }
    _pick(added);
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final typedName = _term.text.trim();
    final muted = theme.typography.sm.copyWith(color: theme.colors.mutedForeground);
    // The letters that matched, marked, so the eye lands on the right Ahmed
    // without reading every row
    final mark = TextStyle(backgroundColor: theme.colors.primary.withValues(alpha: 0.15), fontWeight: FontWeight.w700);

    Widget centered(String text) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 32),
      child: Text(text, textAlign: TextAlign.center, style: muted),
    );

    // The sheet ends where the keyboard starts: the results list gets every
    // row between the field and the keyboard, and scrolls only past that
    final keyboard = MediaQuery.viewInsetsOf(context).bottom;
    final screen = MediaQuery.sizeOf(context).width;
    // The system's back leaves the search first, the sheet second
    // A number is nobody's name: that one is a customer to add
    final asPhone = looksLikePhone(typedName);
    final offerName = !widget.accountsOnly && typedName.isNotEmpty && !asPhone;

    // A way on that needs no result, as a row of the list
    Widget actionRow(IconData icon, String title, String? subtitle, VoidCallback onPress) => FTappable(
          onPress: onPress,
          builder: (context, states, child) => Container(
            constraints: const BoxConstraints(minHeight: Sizes.controlLarge),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: states.contains(FTappableVariant.pressed) ? theme.colors.secondary : null,
              borderRadius: BorderRadius.circular(Sizes.radius),
            ),
            child: child,
          ),
          child: Row(
            children: [
              Icon(icon, size: Sizes.icon, color: theme.colors.mutedForeground),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: theme.typography.base.copyWith(fontWeight: FontWeight.w500)),
                    if (subtitle != null) Text(subtitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: muted),
                  ],
                ),
              ),
            ],
          ),
        );

    // The system's back leaves the form first, the search second, the sheet last
    return PopScope(
      canPop: !_adding && (!_searching || widget.quickPicks.isEmpty),
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        if (_adding) {
          setState(() => _adding = false);
        } else {
          _stopSearching();
        }
      },
      child: AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      curve: Curves.easeOut,
      width: _searching || screen < 480 ? screen : 480,
      decoration: BoxDecoration(
        color: theme.colors.background,
        border: BorderDirectional(start: BorderSide(color: theme.colors.border)),
      ),
      padding: EdgeInsets.only(bottom: keyboard),
      // Across a whole tablet a row would run from one edge to the other:
      // the search keeps to a column down the middle
      child: Align(
        alignment: Alignment.topCenter,
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: _searching ? 640 : double.infinity),
      child: _adding
          ? Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Container(
                  height: Sizes.header,
                  padding: const EdgeInsets.symmetric(horizontal: Sizes.gapSm),
                  decoration: BoxDecoration(border: Border(bottom: BorderSide(color: theme.colors.border))),
                  child: Row(
                    children: [
                      SizedBox.square(
                        dimension: Sizes.control,
                        child: FButton.icon(
                          variant: FButtonVariant.ghost,
                          onPress: () => setState(() => _adding = false),
                          child: const Icon(FIcons.arrowLeft, size: Sizes.iconNav),
                        ),
                      ),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(l10n.newCustomer,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: theme.typography.heading.copyWith(fontWeight: FontWeight.w600)),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: NewCustomerForm(
                    initialName: asPhone ? '' : typedName,
                    initialPhone: asPhone ? typedName : '',
                    onPicked: _added,
                    onCancel: () => setState(() => _adding = false),
                  ),
                ),
              ],
            )
          : Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // A header row like every screen's: the title, and the way out
          if (!_searching)
          Container(
            height: Sizes.header,
            padding: const EdgeInsetsDirectional.only(start: Sizes.gapLg, end: Sizes.gapSm),
            decoration: BoxDecoration(border: Border(bottom: BorderSide(color: theme.colors.border))),
            child: Row(
              children: [
                Expanded(
                  child: Text(widget.title ?? l10n.chooseCustomer,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.typography.heading.copyWith(fontWeight: FontWeight.w600)),
                ),
                SizedBox.square(
                  dimension: Sizes.control,
                  child: FButton.icon(
                    variant: FButtonVariant.ghost,
                    onPress: () => Navigator.of(context, rootNavigator: true).pop(),
                    child: const Icon(FIcons.x, size: Sizes.iconNav),
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: EdgeInsetsDirectional.fromSTEB(_searching ? Sizes.gapSm : Sizes.gapLg, Sizes.gapLg, Sizes.gapLg, 0),
            child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (!_searching && widget.quickPicks.isNotEmpty) ...[
              Text(l10n.inTheRoom, style: muted),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final person in widget.quickPicks)
                    ConstrainedBox(
                      constraints: const BoxConstraints(minHeight: Sizes.controlSmall),
                      child: FButton(
                        variant: FButtonVariant.outline,
                        mainAxisSize: MainAxisSize.min,
                        onPress: () => _pick(SaleCustomer(id: person.id, name: person.name)),
                        prefix: Icon(FIcons.user, size: Sizes.iconSmall, color: theme.colors.mutedForeground),
                        child: Text(
                          person.name.isNotEmpty ? person.name : l10n.guest,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.typography.base.forButton,
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 16),
            ],
            Row(
              children: [
                if (_searching) ...[
                  SizedBox.square(
                    dimension: Sizes.control,
                    child: FButton.icon(
                      variant: FButtonVariant.ghost,
                      onPress: _stopSearching,
                      child: const Icon(FIcons.arrowLeft, size: Sizes.iconNav),
                    ),
                  ),
                  const SizedBox(width: 4),
                ],
                Expanded(
                  child: FTextField(
                    control: FTextFieldControl.managed(controller: _term),
                    focusNode: _focus,
                    hint: l10n.searchCustomersPlaceholder,
                    // Open on the search with nobody to offer; and back from
                    // adding someone, the search is where it was
                    autofocus: _searching,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
          ],
            ),
          ),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(Sizes.gapLg, 0, Sizes.gapLg, Sizes.gapLg),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // The two ways on that need no result: the typed name as
                  // it is, first because it is the common case, and a
                  // customer made here
                  if (offerName)
                    actionRow(FIcons.pencil, l10n.useNameAction(typedName), l10n.noAccountNeeded,
                        () => _pick(SaleCustomer(name: typedName))),
                  actionRow(FIcons.userPlus, l10n.newCustomer, null, () => setState(() => _adding = true)),
                  Container(height: 1, margin: const EdgeInsets.symmetric(vertical: 4), color: theme.colors.border),
              _search.isEmpty
                ? const SizedBox.shrink()
                : _loading
                ? Skeleton(
                    child: Column(
                      children: [
                        for (var i = 0; i < 5; i++)
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            child: Row(
                              children: [
                                skeletonBox(context, width: 40, height: 40, circle: true),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      skeletonBar(context, widthFactor: 0.5, height: 14),
                                      const SizedBox(height: 8),
                                      skeletonBar(context, widthFactor: 0.3, height: 12),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                      ],
                    ),
                  )
                : _failed
                ? centered(l10n.somethingWentWrong)
                : _users.isEmpty
                ? centered(l10n.noCustomersFound)
                : ListView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: _users.length,
                    itemBuilder: (context, index) {
                      final user = _users[index];
                      final onBill = widget.busy[user.id];
                      return Row(
                        children: [
                          Expanded(
                            child: FTappable(
                              onPress: onBill != null
                                  ? null
                                  : () => _pick(SaleCustomer(id: user.id, name: user.displayName, phone: user.phoneNumber, addedAtCounter: user.addedAtCounter)),
                              builder: (context, states, child) => Opacity(
                                opacity: onBill == null ? 1 : 0.6,
                                child: Container(
                                  constraints: const BoxConstraints(minHeight: Sizes.control),
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                  decoration: BoxDecoration(
                                    color: states.contains(FTappableVariant.pressed) ? theme.colors.secondary : null,
                                    borderRadius: BorderRadius.circular(Sizes.radius),
                                  ),
                                  child: child,
                                ),
                              ),
                              child: Row(
                                children: [
                                  Icon(FIcons.user, size: Sizes.icon, color: theme.colors.mutedForeground),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text.rich(
                                          TextSpan(
                                            children: highlightSpans(user.displayName, matchRanges(user.displayName, _search), mark),
                                          ),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: theme.typography.base.copyWith(fontWeight: FontWeight.w500),
                                        ),
                                        if (onBill != null)
                                          Text(l10n.alreadyOnBill(onBill), maxLines: 1, overflow: TextOverflow.ellipsis, style: muted)
                                        else if (user.contact case final contact?)
                                          Text.rich(
                                            TextSpan(
                                              children: highlightSpans(
                                                contact,
                                                user.phoneNumber?.isNotEmpty == true
                                                    ? phoneRanges(contact, _search)
                                                    : matchRanges(contact, _search),
                                                mark,
                                              ),
                                            ),
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            // A number reads left to right whatever the till's
                                            // language: without this its groups swap places in Arabic
                                            textDirection: user.phoneNumber?.isNotEmpty == true ? TextDirection.ltr : null,
                                            textAlign: textAlignFor(context),
                                            style: muted,
                                          ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          // A look before the pick: points and tab, without attaching
                          SizedBox.square(
                            dimension: Sizes.controlSmall,
                            child: FButton.icon(
                              variant: FButtonVariant.ghost,
                              onPress: () => showCustomerCard(context, id: user.id, name: user.displayName, phone: user.phoneNumber, addedAtCounter: user.addedAtCounter),
                              child: Icon(FIcons.info, size: Sizes.icon, color: theme.colors.mutedForeground),
                            ),
                          ),
                        ],
                      );
                    },
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
        ),
      ),
      ),
    );
  }
}

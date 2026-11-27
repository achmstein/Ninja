import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import '../../../core/utils/bidi.dart';
import '../../../core/utils/highlight.dart';
import '../../../core/utils/phone.dart';
import '../../../core/widgets/pos_toast.dart';
import '../../../core/widgets/skeleton.dart';
import '../../../l10n/app_localizations.dart';
import '../../sale/models/sale_line.dart';
import '../customer_letters.dart';
import '../dialogs/new_customer_dialog.dart';
import '../recent_customers.dart';
import '../services/customer_search_service.dart';
import '../../../core/theme/type_roles.dart';

const _searchDebounce = Duration(milliseconds: 250);

/// How many customers the list holds before a name has to be typed
const customerListMax = 200;

/// How many matches a typed name brings back
const _matchesMax = 20;

SaleCustomer _saleCustomer(IdentityUser user) =>
    SaleCustomer(id: user.id, name: user.displayName, phone: user.phoneNumber, addedAtCounter: user.addedAtCounter);

/// Finding a customer by name, on the whole screen: the box on its top row and
/// the results right under it, so a tablet's keyboard only ever covers the
/// empty foot. Nothing needs typing to begin with: the people offered first
/// ([quickPicks], a room's), the customers picked lately, then everyone by
/// name, with a strip of letters to jump by the first one. The keyboard waits
/// for a tap on the box. A name that is nobody's yet can go on the order as it
/// is, or be added as a customer, which is the only place a phone number is
/// asked.
///
/// Pops with the [SaleCustomer] picked, or with nothing.
class CustomerSearchScreen extends ConsumerStatefulWidget {
  /// Only people with an account can be picked: no "use this name". For a
  /// room's people and a reservation, where a bare name is nobody
  final bool accountsOnly;

  /// People offered before anything else: the room's, when the sale is a room's
  final List<({String id, String name})> quickPicks;

  /// What the search is for, read out in place of "Choose customer"
  final String? title;

  /// Accounts that cannot be picked, each with where their bill is: one
  /// person, one bill
  final Map<String, String> busy;

  const CustomerSearchScreen({
    super.key,
    this.accountsOnly = false,
    this.quickPicks = const [],
    this.title,
    this.busy = const {},
  });

  @override
  ConsumerState<CustomerSearchScreen> createState() => _CustomerSearchScreenState();
}

class _CustomerSearchScreenState extends ConsumerState<CustomerSearchScreen> {
  final _term = TextEditingController();
  // The text as last seen: a controller also notifies on a cursor move
  String _text = '';
  // The first letter picked from the strip, in place of a typed name
  String? _letter;
  // Adding someone takes the search's place, on the same screen
  bool _adding = false;

  // Everyone, for the list and the letters; nothing until the server answers
  List<IdentityUser>? _everyone;
  bool _everyoneFailed = false;
  List<String> _recent = const [];

  // The matches once a name is typed: what was asked, and what came back
  Timer? _debounce;
  String _search = '';
  List<IdentityUser> _matches = const [];
  bool _loading = false;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    _term.addListener(_onTermChanged);
    _loadEveryone();
    _loadRecent();
  }

  /// Whoever the branch last rang something up for, from its bills: the same people on every
  /// till. Until the server answers (offline, or a business not on that release yet) the
  /// customers picked on this tablet stand in
  Future<void> _loadRecent() async {
    List<String> ids;
    try {
      ids = await ref.read(branchRecentCustomersProvider)();
    } catch (_) {
      ids = [for (final c in await readRecentCustomers()) c.id];
    }
    if (mounted) setState(() => _recent = ids);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _term.dispose();
    super.dispose();
  }

  Future<void> _loadEveryone() async {
    try {
      final users = await ref.read(customerSearchServiceProvider).search('', max: customerListMax);
      if (mounted) setState(() => _everyone = users);
    } catch (_) {
      if (mounted) setState(() => _everyoneFailed = true);
    }
  }

  void _onTermChanged() {
    if (_term.text == _text) return;
    _text = _term.text;
    final typed = _text.trim();
    _debounce?.cancel();
    setState(() {
      // Typing is its own way to a name: the letter is let go
      _letter = null;
      if (typed.isEmpty) {
        _search = '';
        _matches = const [];
        _loading = false;
        _failed = false;
      }
    });
    if (typed.isNotEmpty) _debounce = Timer(_searchDebounce, _runSearch);
  }

  Future<void> _runSearch() async {
    final search = _term.text.trim();
    if (search.isEmpty || (search == _search && !_failed)) return;
    setState(() {
      _search = search;
      _failed = false;
      _loading = true;
    });
    try {
      final users = await ref.read(customerSearchServiceProvider).search(search, max: _matchesMax);
      // A late answer to an older question is dropped
      if (!mounted || _search != search) return;
      setState(() {
        _matches = users;
        _loading = false;
      });
    } catch (_) {
      if (!mounted || _search != search) return;
      setState(() {
        _matches = const [];
        _failed = true;
        _loading = false;
      });
    }
  }

  void _clear() {
    _term.clear();
    setState(() => _letter = null);
  }

  void _pickLetter(String letter) {
    _term.clear();
    setState(() => _letter = _letter == letter ? null : letter);
  }

  void _pick(SaleCustomer customer) {
    // Remembered for next time; the pick does not wait for the tablet's storage
    unawaited(rememberRecentCustomer(customer));
    Navigator.of(context).pop(customer);
  }

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
    final typed = _term.text.trim();
    final arabicFirst = Localizations.localeOf(context).languageCode == 'ar';
    final rule = BorderSide(color: theme.colors.border);
    final muted = theme.type.detail.copyWith(color: theme.colors.mutedForeground);
    // The letters that matched, marked, so the eye lands on the right Ahmed
    // without reading every row
    final mark = TextStyle(backgroundColor: theme.colors.primary.withValues(alpha: 0.15), fontWeight: FontWeight.w700);
    // A number is nobody's name: that one is a customer to add
    final asPhone = looksLikePhone(typed);

    Widget pressable({required VoidCallback? onPress, required Widget child}) => FTappable(
          onPress: onPress,
          builder: (context, states, child) => Opacity(
            opacity: onPress == null ? 0.5 : 1,
            child: Container(
              constraints: const BoxConstraints(minHeight: Sizes.controlLarge),
              padding: const EdgeInsets.symmetric(horizontal: Sizes.gapLg, vertical: Sizes.gapSm),
              decoration: BoxDecoration(
                color: states.contains(FTappableVariant.pressed) ? theme.colors.secondary : null,
                border: Border(bottom: rule),
              ),
              child: child,
            ),
          ),
          child: child,
        );

    // A name in its own script's direction, so a long one is cut at its end,
    // but starting where the line starts whatever it is written in
    Widget nameText(String name, {List<InlineSpan>? spans}) => Text.rich(
          TextSpan(children: spans ?? [TextSpan(text: name)]),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          textDirection: textDirectionFor(name),
          textAlign: textAlignFor(context),
          style: theme.type.heading,
        );

    Widget row(IdentityUser user, {bool marked = false}) {
      final name = user.displayName;
      final onBill = widget.busy[user.id];
      // Switched off by the owner, or on a bill already: shown, greyed, and not to be picked
      final locked = onBill != null || !user.enabled;
      final under = !user.enabled ? l10n.customerDisabled : (onBill != null ? l10n.alreadyOnBill(onBill) : null);
      return pressable(
        onPress: locked ? null : () => _pick(_saleCustomer(user)),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                mainAxisSize: MainAxisSize.min,
                children: [
                  nameText(name, spans: marked ? highlightSpans(name, matchRanges(name, typed), mark) : null),
                  if (under != null) Text(under, maxLines: 1, overflow: TextOverflow.ellipsis, style: muted),
                ],
              ),
            ),
            if (user.phoneNumber?.isNotEmpty == true) ...[
              const SizedBox(width: Sizes.gap),
              // A number reads left to right whatever the till's language:
              // without this its groups swap places in Arabic
              Text(
                plainPhone(user.phoneNumber),
                maxLines: 1,
                textDirection: TextDirection.ltr,
                style: muted.copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
              ),
            ],
          ],
        ),
      );
    }

    // A way on that needs no result, as a row of the list
    Widget actionRow(IconData icon, String title, String subtitle, VoidCallback onPress) => pressable(
          onPress: onPress,
          child: Row(
            children: [
              Icon(icon, size: Sizes.icon, color: theme.colors.mutedForeground),
              const SizedBox(width: Sizes.gap),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: theme.type.heading),
                    Text(subtitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: muted),
                  ],
                ),
              ),
            ],
          ),
        );

    Widget caption(String text) => Padding(
          padding: const EdgeInsets.fromLTRB(Sizes.gapLg, Sizes.gap, Sizes.gapLg, Sizes.gapXs),
          child: TypeLabel(text),
        );

    Widget nothing(String text) => Padding(
          padding: const EdgeInsets.symmetric(horizontal: Sizes.gapLg, vertical: Sizes.gapXl),
          child: Text(text, textAlign: TextAlign.center, style: muted),
        );

    // A name and a number: a customer row's shape
    Widget skeletons() => Skeleton(
          child: Column(
            children: [
              for (var i = 0; i < 6; i++)
                Container(
                  constraints: const BoxConstraints(minHeight: Sizes.controlLarge),
                  padding: const EdgeInsets.symmetric(horizontal: Sizes.gapLg, vertical: Sizes.gapSm),
                  decoration: BoxDecoration(border: Border(bottom: rule)),
                  child: Row(
                    children: [
                      Expanded(child: skeletonBar(context, widthFactor: 0.4, height: 14)),
                      skeletonBox(context, width: 96, height: 12, radius: 4),
                    ],
                  ),
                ),
            ],
          ),
        );

    final everyone = [...?_everyone]
      ..sort((a, b) => compareNames(a.displayName, b.displayName, arabicFirst: arabicFirst));
    // Only letters somebody is filed under
    final strip = lettersStrip(everyone.map((u) => u.displayName), arabicFirst: arabicFirst);

    final List<Widget> rows;
    if (typed.isNotEmpty) {
      // Still waiting on the pause after the last key, or on the server's first answer
      final waiting = typed != _search || (_loading && _matches.isEmpty);
      rows = [
        if (waiting)
          skeletons()
        else if (_failed)
          nothing(l10n.somethingWentWrong)
        else if (_matches.isEmpty)
          nothing(l10n.customerSearchNone)
        else
          for (final user in _matches) row(user, marked: true),
        // A name that is nobody's yet: on this order as it is, or a customer from now on
        if (!widget.accountsOnly && !asPhone) ...[
          caption(l10n.customerSearchNotListed),
          actionRow(FIcons.pencil, l10n.useNameAction(typed), l10n.noAccountNeeded, () => _pick(SaleCustomer(name: typed))),
        ],
        actionRow(FIcons.userPlus, l10n.newCustomer, l10n.customerSearchAddHint, () => setState(() => _adding = true)),
      ];
    } else if (_everyone == null) {
      rows = [_everyoneFailed ? nothing(l10n.somethingWentWrong) : skeletons()];
    } else if (_letter case final letter?) {
      final under = everyone.where((u) => filedUnder(u.displayName) == letter);
      rows = under.isEmpty ? [nothing(l10n.customerSearchNone)] : [for (final user in under) row(user)];
    } else {
      // Whoever was picked lately and is still a customer here, newest first
      final recent = [
        for (final id in _recent) ...everyone.where((u) => u.id == id).take(1),
      ];
      rows = [
        if (widget.quickPicks.isNotEmpty) ...[
          caption(l10n.inTheRoom),
          for (final person in widget.quickPicks)
            pressable(
              onPress: () => _pick(SaleCustomer(id: person.id, name: person.name)),
              child: Align(
                alignment: AlignmentDirectional.centerStart,
                child: nameText(person.name.isNotEmpty ? person.name : l10n.guest),
              ),
            ),
        ],
        if (recent.isNotEmpty) ...[
          caption(l10n.recentCustomers),
          for (final user in recent) row(user),
        ],
        caption(l10n.customerSearchEveryone),
        if (everyone.isEmpty) nothing(l10n.noCustomersFound) else for (final user in everyone) row(user),
        // A long list is not for scrolling: past this many, the name is typed
        if (everyone.length >= customerListMax) nothing(l10n.customerSearchTypeForMore),
      ];
    }

    Widget topRow({required VoidCallback onBack, required Widget child}) => Container(
          constraints: const BoxConstraints(minHeight: Sizes.header),
          padding: const EdgeInsetsDirectional.only(start: Sizes.gapSm, end: Sizes.gap, top: 6, bottom: 6),
          decoration: BoxDecoration(border: Border(bottom: rule)),
          child: Row(
            children: [
              SizedBox.square(
                dimension: Sizes.control,
                child: Semantics(
                  label: l10n.goBack,
                  child: FButton.icon(
                    variant: FButtonVariant.ghost,
                    onPress: onBack,
                    child: Icon(
                      FIcons.arrowLeft,
                      size: Sizes.iconNav,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: Sizes.gapXs),
              Expanded(child: child),
            ],
          ),
        );

    final Widget body;
    if (_adding) {
      body = Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          topRow(
            onBack: () => setState(() => _adding = false),
            child: Text(l10n.newCustomer,
                maxLines: 1, overflow: TextOverflow.ellipsis, style: theme.type.title),
          ),
          Expanded(
            child: NewCustomerForm(
              initialName: asPhone ? '' : typed,
              initialPhone: asPhone ? typed : '',
              onPicked: _added,
              onCancel: () => setState(() => _adding = false),
            ),
          ),
        ],
      );
    } else {
      body = Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          topRow(
            onBack: () => Navigator.of(context).pop(),
            child: Semantics(
              label: widget.title ?? l10n.chooseCustomer,
              child: FTextField(
                control: FTextFieldControl.managed(controller: _term),
                hint: l10n.customerSearchPlaceholder,
                // No autofocus: the keyboard waits for a tap on the box
                maxLines: 1,
                autocorrect: false,
                textInputAction: TextInputAction.search,
                suffixBuilder: typed.isEmpty && _text.isEmpty && _letter == null
                    ? null
                    : (context, style, _) => Semantics(
                          label: l10n.customerSearchClear,
                          button: true,
                          child: FTappable(
                            onPress: _clear,
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 12),
                              child: Icon(FIcons.x, size: Sizes.icon, color: theme.colors.mutedForeground),
                            ),
                          ),
                        ),
              ),
            ),
          ),
          // A name's first letter, without the keyboard
          if (strip.isNotEmpty)
            Container(
              decoration: BoxDecoration(border: Border(bottom: rule)),
              child: Semantics(
                label: l10n.customerSearchLetters,
                container: true,
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: Sizes.gap, vertical: Sizes.gapSm),
                  child: Row(
                    children: [
                      for (final letter in strip)
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 2),
                          child: Semantics(
                            button: true,
                            selected: _letter == letter,
                            child: FTappable(
                              onPress: () => _pickLetter(letter),
                              builder: (context, states, child) => Container(
                                width: Sizes.controlSmall,
                                height: Sizes.controlSmall,
                                alignment: Alignment.center,
                                decoration: BoxDecoration(
                                  color: _letter == letter
                                      ? theme.colors.primary
                                      : (states.contains(FTappableVariant.pressed) ? theme.colors.secondary : null),
                                  borderRadius: BorderRadius.circular(Sizes.radius),
                                ),
                                child: child,
                              ),
                              child: Text(
                                letter,
                                style: theme.type.body.copyWith(
                                  fontWeight: FontWeight.w600,
                                  color: _letter == letter ? theme.colors.primaryForeground : null,
                                ),
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ),
          Expanded(
            child: ListView.builder(
              padding: EdgeInsets.zero,
              itemCount: rows.length,
              itemBuilder: (context, index) => rows[index],
            ),
          ),
        ],
      );
    }

    // The screen ends where the keyboard starts: the results get every row
    // between the box and the keyboard, and scroll only past that
    final keyboard = MediaQuery.viewInsetsOf(context).bottom;
    // The system's back leaves the form first, the search second
    return PopScope(
      canPop: !_adding,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) setState(() => _adding = false);
      },
      child: Material(
        color: theme.colors.background,
        child: SafeArea(
          child: Padding(
            padding: EdgeInsets.only(bottom: keyboard),
            // A column down the middle: across a whole tablet a row would run
            // from one edge to the other
            child: Align(
              alignment: Alignment.topCenter,
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 720),
                child: DecoratedBox(
                  decoration: BoxDecoration(border: Border.symmetric(vertical: rule)),
                  child: body,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

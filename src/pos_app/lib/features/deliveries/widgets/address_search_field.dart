import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import '../../../core/widgets/pos_toast.dart';
import '../../../l10n/app_localizations.dart';
import '../services/address_search.dart';

/// Google's suggestions for the street typed, from the business's own server;
/// a pick hands [onPick] its point. One session token per search, closed by the
/// pick. The till's delivery form and the call centre both ask with it.
class AddressSearchField extends ConsumerStatefulWidget {
  final void Function(PickedPlace place) onPick;

  const AddressSearchField({super.key, required this.onPick});

  @override
  ConsumerState<AddressSearchField> createState() => _AddressSearchFieldState();
}

class _AddressSearchFieldState extends ConsumerState<AddressSearchField> {
  final _text = TextEditingController();
  Timer? _pause;
  String? _session;
  String? _asked;
  String? _picking;
  bool _searching = false;
  List<PlaceSuggestion> _suggestions = const [];

  @override
  void initState() {
    super.initState();
    _text.addListener(_changed);
  }

  @override
  void dispose() {
    _pause?.cancel();
    _text.dispose();
    super.dispose();
  }

  void _changed() {
    _pause?.cancel();
    final q = searchableQuery(_text.text);
    if (q == null) {
      if (_asked != null || _suggestions.isNotEmpty) {
        setState(() {
          _asked = null;
          _suggestions = const [];
          _searching = false;
        });
      }
      return;
    }
    if (q == _asked) return;
    _pause = Timer(searchDebounce, () => _search(q));
  }

  Future<void> _search(String q) async {
    final language = Localizations.localeOf(context).languageCode;
    _session ??= newSearchSession();
    setState(() {
      _asked = q;
      _searching = true;
    });
    final found = await ref.read(addressSearchProvider).suggest(q, session: _session!, language: language);
    if (!mounted || _asked != q) return;
    setState(() {
      _suggestions = found;
      _searching = false;
    });
  }

  Future<void> _pick(PlaceSuggestion suggestion) async {
    final l10n = AppLocalizations.of(context)!;
    final language = Localizations.localeOf(context).languageCode;
    final session = _session ?? newSearchSession();
    setState(() => _picking = suggestion.placeId);
    final place = await ref.read(addressSearchProvider).pick(suggestion, session: session, language: language);
    if (!mounted) return;
    // The pick closes the session; the next search opens another
    _session = null;
    setState(() => _picking = null);
    if (place == null) {
      showPosToast(context, PosToastType.error, l10n.deliverySearchFailed);
      return;
    }
    _pause?.cancel();
    _asked = null;
    _suggestions = const [];
    _text.clear();
    widget.onPick(place);
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final muted = theme.typography.sm.copyWith(color: theme.colors.mutedForeground);
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          FTextField(
            control: FTextFieldControl.managed(controller: _text),
            hint: l10n.deliverySearchAddress,
            textInputAction: TextInputAction.search,
            suffixBuilder: _searching
                ? (context, style, states) => const Padding(
                      padding: EdgeInsetsDirectional.only(end: 10),
                      child: SizedBox.square(dimension: 14, child: FCircularProgress()),
                    )
                : null,
          ),
          for (final s in _suggestions)
            InkWell(
              onTap: _picking == null ? () => _pick(s) : null,
              borderRadius: BorderRadius.circular(8),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
                child: Row(
                  children: [
                    _picking == s.placeId
                        ? const SizedBox.square(dimension: 14, child: FCircularProgress())
                        : Icon(FIcons.mapPin, size: 16, color: theme.colors.mutedForeground),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(s.primaryText, maxLines: 1, overflow: TextOverflow.ellipsis, style: theme.typography.sm.copyWith(fontWeight: FontWeight.w600)),
                          if (s.secondaryText != null) Text(s.secondaryText!, maxLines: 1, overflow: TextOverflow.ellipsis, style: muted),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

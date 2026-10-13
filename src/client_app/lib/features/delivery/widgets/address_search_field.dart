import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/brand/brand_provider.dart';
import '../../../core/services/location_service.dart';
import '../../../core/theme/theme_provider.dart';
import '../../../core/ui/ui.dart';
import '../../../core/widgets/app_text.dart';
import '../../../l10n/app_localizations.dart';
import '../services/address_search.dart';

/// A street to type above the map, for a customer who would rather name it
/// than find it (client_web's address-search.tsx): Google's suggestions,
/// from the business's own server, lean toward the branch; picking one hands
/// [onPick] its point, the map flies there and the pin is put on the door as
/// before. Shown only when the business has address search on.
class AddressSearchField extends ConsumerStatefulWidget {
  final LatLng? near;
  final void Function(PickedPlace place) onPick;

  const AddressSearchField({super.key, this.near, required this.onPick});

  @override
  ConsumerState<AddressSearchField> createState() => _AddressSearchFieldState();
}

class _AddressSearchFieldState extends ConsumerState<AddressSearchField> {
  final _text = TextEditingController();
  Timer? _pause;

  /// The search's session token: made at its first call, closed by the pick
  String? _session;
  List<PlaceSuggestion> _suggestions = const [];
  bool _searching = false;
  String? _picking;

  /// The query whose answer is wanted; an older one's answer that comes late is dropped
  String? _asked;

  @override
  void dispose() {
    _pause?.cancel();
    _text.dispose();
    super.dispose();
  }

  void _changed(String text) {
    _pause?.cancel();
    final q = searchableQuery(text);
    if (q == null) {
      setState(() {
        _asked = null;
        _suggestions = const [];
        _searching = false;
      });
      return;
    }
    _pause = Timer(searchDebounce, () => _search(q));
  }

  Future<void> _search(String q) async {
    final language = Localizations.localeOf(context).languageCode;
    _session ??= newSearchSession();
    setState(() {
      _asked = q;
      _searching = true;
    });
    final found = await ref.read(addressSearchProvider).suggest(q, session: _session!, language: language, near: widget.near);
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
    setState(() {
      _picking = null;
      // The pick closes the session; the next search opens another
      _session = null;
      if (place != null) {
        _pause?.cancel();
        _text.clear();
        _asked = null;
        _suggestions = const [];
      }
    });
    if (place != null) {
      FocusScope.of(context).unfocus();
      widget.onPick(place);
    } else {
      showIsland(title: AppText(l10n.deliverySearchFailed), icon: Icon(LucideIcons.mapPinOff, color: context.theme.colors.mutedForeground));
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!ref.watch(brandProvider.select((b) => b.addressSearch))) return const SizedBox.shrink();
    final theme = context.theme;
    final c = theme.colors;
    final l10n = AppLocalizations.of(context)!;
    final caption = context.localeText(theme.typography.caption.copyWith(color: c.mutedForeground));
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Stack(
            alignment: AlignmentDirectional.centerEnd,
            children: [
              NinjaField(
                controller: _text,
                hint: l10n.deliverySearchAddress,
                textInputAction: TextInputAction.search,
                textCapitalization: TextCapitalization.words,
                onChange: _changed,
              ),
              if (_searching)
                Padding(
                  padding: const EdgeInsetsDirectional.only(end: 14),
                  child: SizedBox.square(dimension: 16, child: CircularProgressIndicator(strokeWidth: 2, color: c.mutedForeground)),
                ),
            ],
          ),
          for (final s in _suggestions)
            Pressable(
              onTap: _picking == null ? () => _pick(s) : null,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
                child: Row(
                  children: [
                    _picking == s.placeId
                        ? SizedBox.square(dimension: 16, child: CircularProgressIndicator(strokeWidth: 2, color: c.mutedForeground))
                        : Icon(LucideIcons.mapPin, size: 16, color: c.mutedForeground),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          AppText(s.primaryText, maxLines: 1, overflow: TextOverflow.ellipsis,
                              style: caption.copyWith(color: c.foreground, fontWeight: FontWeight.w600)),
                          if (s.secondaryText != null) AppText(s.secondaryText!, maxLines: 1, overflow: TextOverflow.ellipsis, style: caption),
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

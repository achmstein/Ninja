import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/models/localized_text.dart';
import 'package:ninja_app_core/theme/app_theme.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import '../../../core/models/money.dart';
import '../../../core/utils/bidi.dart';
import '../../../core/utils/name_match.dart';
import '../../../l10n/app_localizations.dart';
import '../models/delivery_order.dart';
import '../../../core/theme/type_roles.dart';

/// The most areas offered for what was typed
const maxAreaMatches = 8;

/// Up to this many named areas are shown as buttons, one tap each; more are searched by name
const areaButtonsMax = 12;

/// The area the caller says, the same way on every till screen: a few areas
/// are buttons to tap, many are searched by name.
class AreaChoice extends StatelessWidget {
  final List<DeliveryZone> zones;
  final DeliveryZone? picked;

  /// The area tapped; null when the search field's cross cleared it
  final void Function(DeliveryZone? zone) onPick;

  /// The branch's name, said with each area when they span several branches
  final String Function(int branchId)? branchName;

  const AreaChoice({super.key, required this.zones, required this.picked, required this.onPick, this.branchName});

  @override
  Widget build(BuildContext context) => zones.length <= areaButtonsMax
      ? AreaButtons(zones: zones, picked: picked, onPick: onPick, branchName: branchName)
      : AreaPickerField(zones: zones, picked: picked, onPick: onPick, branchName: branchName);
}

/// The named areas as buttons, each with its fee (and its branch, where
/// several branches' areas are shown): the caller says the area, the cashier
/// taps it. One switched off for a while, or whose branch paused, says so and
/// takes a second tap.
class AreaButtons extends StatefulWidget {
  final List<DeliveryZone> zones;
  final DeliveryZone? picked;
  final void Function(DeliveryZone zone) onPick;
  final String Function(int branchId)? branchName;

  const AreaButtons({super.key, required this.zones, required this.picked, required this.onPick, this.branchName});

  @override
  State<AreaButtons> createState() => _AreaButtonsState();
}

class _AreaButtonsState extends State<AreaButtons> {
  int? _armed;

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final amber = AppColors.amber(theme.colors.brightness);
    final branchName = widget.zones.map((z) => z.branchId).toSet().length > 1 ? widget.branchName : null;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(l10n.deliveryAreaLabel, style: theme.type.detail.copyWith(fontWeight: FontWeight.w500)),
        const SizedBox(height: 6),
        LayoutBuilder(
          builder: (context, box) {
            final columns = box.maxWidth >= 420 ? 3 : 2;
            final width = (box.maxWidth - 8 * (columns - 1)) / columns;
            return Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final z in widget.zones)
                  SizedBox(
                    key: ValueKey(z.zoneId),
                    width: width,
                    child: FTappable(
                      semanticsLabel: z.name.localized(context),
                      selected: widget.picked?.zoneId == z.zoneId,
                      onPress: () {
                        final held = !z.on || z.branchPaused;
                        if (held && _armed != z.zoneId) return setState(() => _armed = z.zoneId);
                        setState(() => _armed = null);
                        widget.onPick(z);
                      },
                      builder: (context, states, child) {
                        final chosen = widget.picked?.zoneId == z.zoneId;
                        return Stack(
                          clipBehavior: Clip.none,
                          children: [
                            Container(
                              width: double.infinity,
                              constraints: const BoxConstraints(minHeight: 56),
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                              decoration: BoxDecoration(
                                color: chosen ? theme.colors.primary.withValues(alpha: 0.06) : null,
                                border: Border.all(color: chosen ? theme.colors.primary : theme.colors.border, width: chosen ? 1.5 : 1),
                                borderRadius: BorderRadius.circular(Sizes.radius),
                              ),
                              child: child,
                            ),
                            // The tick sits on the corner, never in the name's way: a long name wraps whole
                            if (chosen)
                              PositionedDirectional(
                                top: -6,
                                end: -6,
                                child: Container(
                                  width: 20,
                                  height: 20,
                                  decoration: BoxDecoration(color: theme.colors.primary, shape: BoxShape.circle),
                                  child: Icon(FIcons.check, size: 12, color: theme.colors.primaryForeground),
                                ),
                              ),
                          ],
                        );
                      },
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(z.name.localized(context),
                              maxLines: 2, overflow: TextOverflow.ellipsis, style: theme.type.detail.copyWith(fontWeight: FontWeight.w600)),
                          Text(
                            [
                              if (branchName != null) branchName(z.branchId),
                              z.fee > 0 ? money(context, z.fee) : l10n.deliveryFree,
                            ].join(' · '),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: theme.type.caption.copyWith(color: theme.colors.mutedForeground),
                          ),
                          if (!z.on || z.branchPaused)
                            Text(
                              _armed == z.zoneId ? l10n.deliveryAreaOffTapAgain : (!z.on ? l10n.deliveryAreaOff : l10n.deliveryBranchPaused),
                              style: theme.type.caption.copyWith(color: amber, fontWeight: FontWeight.w600),
                            ),
                        ],
                      ),
                    ),
                  ),
              ],
            );
          },
        ),
      ],
    );
  }
}

/// The areas whose name, in either language, holds every word typed: spelled
/// as the server's name search reads names (Arabic letter variants and
/// diacritics set aside), in the list's own order, the first few only.
/// Nothing typed finds nothing.
List<DeliveryZone> matchAreas(List<DeliveryZone> zones, String query) {
  final words = normalizeName(query).split(' ').where((w) => w.isNotEmpty).toList();
  if (words.isEmpty) return const [];
  final found = <DeliveryZone>[];
  for (final zone in zones) {
    final names = [normalizeName(zone.name.en), normalizeName(zone.name.ar)];
    if (words.every((w) => names.any((n) => n.contains(w)))) {
      found.add(zone);
      if (found.length == maxAreaMatches) break;
    }
  }
  return found;
}

/// The area the caller says they live in, picked by name: type a few letters
/// and the branch's named areas that match are offered, each with its fee,
/// about how long it takes, and whether the branch is delivering there now.
/// One switched off (or of a paused branch) takes a second tap. The area
/// picked stands in the field's place, with a cross to clear it.
class AreaPickerField extends StatefulWidget {
  final List<DeliveryZone> zones;
  final DeliveryZone? picked;

  /// The area tapped; null when the cross cleared it
  final void Function(DeliveryZone? zone) onPick;

  /// The branch's name, said on each line when the list spans several branches
  final String Function(int branchId)? branchName;

  const AreaPickerField({super.key, required this.zones, required this.picked, required this.onPick, this.branchName});

  @override
  State<AreaPickerField> createState() => _AreaPickerFieldState();
}

class _AreaPickerFieldState extends State<AreaPickerField> {
  final _text = TextEditingController();

  /// The area off for now whose line was tapped once
  int? _confirming;

  @override
  void initState() {
    super.initState();
    _text.addListener(() => setState(() => _confirming = null));
  }

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  void _tap(DeliveryZone zone) {
    // Switched off, or its branch paused: the cashier is asked once more
    if ((!zone.on || zone.branchPaused) && _confirming != zone.zoneId) {
      setState(() => _confirming = zone.zoneId);
      return;
    }
    _text.clear();
    widget.onPick(zone);
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final muted = theme.type.detail.copyWith(color: theme.colors.mutedForeground);
    final amber = AppColors.amber(theme.colors.brightness);
    final warn = TextStyle(color: amber, fontWeight: FontWeight.w600);
    final branchName = widget.zones.map((z) => z.branchId).toSet().length > 1 ? widget.branchName : null;

    // What an area costs and takes, and how it stands, on one line
    InlineSpan about(DeliveryZone zone, {bool armed = false}) => TextSpan(children: [
          TextSpan(
            text: [
              if (branchName != null) branchName(zone.branchId),
              zone.fee > 0 ? money(context, zone.fee) : l10n.deliveryFree,
              if (zone.etaMinutes != null) l10n.deliveryAboutMinutes(zone.etaMinutes!),
            ].join(' · '),
          ),
          if (armed)
            TextSpan(
              text: ' · ${!zone.on ? l10n.deliveryAreaOffTapAgain : l10n.deliverySendToPaused((widget.branchName ?? hashNumber)(zone.branchId))}',
              style: warn,
            )
          else ...[
            if (!zone.on) TextSpan(text: ' · ${l10n.deliveryAreaOff}', style: warn),
            if (zone.branchPaused) TextSpan(text: ' · ${l10n.deliveryBranchPaused}', style: warn),
          ],
        ]);

    final picked = widget.picked;
    if (picked != null) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(l10n.deliveryAreaLabel, style: theme.type.detail.copyWith(fontWeight: FontWeight.w500)),
          const SizedBox(height: 6),
          Container(
            padding: const EdgeInsetsDirectional.only(start: 12, top: 4, bottom: 4),
            decoration: BoxDecoration(
              color: theme.colors.primary.withValues(alpha: 0.06),
              border: Border.all(color: theme.colors.primary),
              borderRadius: BorderRadius.circular(Sizes.radius),
            ),
            child: Row(
              children: [
                Icon(FIcons.mapPinned, size: Sizes.iconSmall, color: theme.colors.primary),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(picked.name.localized(context),
                          maxLines: 1, overflow: TextOverflow.ellipsis, style: theme.type.detail.copyWith(fontWeight: FontWeight.w600)),
                      Text.rich(about(picked), maxLines: 2, overflow: TextOverflow.ellipsis, style: muted),
                    ],
                  ),
                ),
                SizedBox.square(
                  dimension: Sizes.controlSmall,
                  child: Semantics(
                    label: l10n.deliveryAreaClear,
                    button: true,
                    child: FButton.icon(
                      variant: FButtonVariant.ghost,
                      onPress: () {
                        setState(() => _confirming = null);
                        widget.onPick(null);
                      },
                      child: const Icon(FIcons.x, size: Sizes.icon),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      );
    }

    final typed = _text.text.trim().isNotEmpty;
    final matches = matchAreas(widget.zones, _text.text);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        FTextField(
          control: FTextFieldControl.managed(controller: _text),
          label: Text(l10n.deliveryAreaLabel),
          hint: l10n.deliveryAreaSearch,
          textInputAction: TextInputAction.search,
        ),
        if (typed && matches.isEmpty)
          Padding(padding: const EdgeInsets.only(top: 4), child: Text(l10n.deliveryAreaNone, style: muted)),
        for (final zone in matches)
          InkWell(
            key: ValueKey(zone.zoneId),
            onTap: () => _tap(zone),
            borderRadius: BorderRadius.circular(Sizes.radius),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
              child: Row(
                children: [
                  Icon(FIcons.mapPinned, size: Sizes.iconSmall, color: theme.colors.mutedForeground),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(zone.name.localized(context),
                            maxLines: 1, overflow: TextOverflow.ellipsis, style: theme.type.detail.copyWith(fontWeight: FontWeight.w600)),
                        Text.rich(about(zone, armed: _confirming == zone.zoneId), maxLines: 2, overflow: TextOverflow.ellipsis, style: muted),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

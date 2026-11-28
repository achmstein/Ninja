import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import '../../../core/widgets/skeleton.dart';
import 'package:ninja_app_core/models/localized_text.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import '../../../core/widgets/pos_toast.dart';
import '../../../l10n/app_localizations.dart';
import '../../catalog/models/catalog_item.dart';
import '../../catalog/providers/catalog_provider.dart';
import '../../../core/theme/type_roles.dart';

/// One entry of the list: what is off now (id null), or a category
typedef _Entry = ({int? id, String name, int off, int all});

/// Marking items sold out (and back) for this branch. Two panels across the
/// whole screen, as the receipts are: the categories down the side, each with
/// how many of its items are off, and the picked category's items across the
/// rest, two to a row, a tap on one flipping it. The first entry gathers
/// everything that is off now, which is what the page is opened for most:
/// bringing back what ran out. A search spans every category. A narrow screen
/// has the categories as one scrolling row over the items. The web till's
/// Availability is the same.
///
/// Reads the same providers as the sale pad, so a flip here greys the tile
/// there at once. The server ANDs the branch override with the global flag,
/// so a row shows the effective state: an item the back office pulled
/// everywhere stays off whatever the till says.
class AvailabilityScreen extends ConsumerStatefulWidget {
  const AvailabilityScreen({super.key});

  @override
  ConsumerState<AvailabilityScreen> createState() => _AvailabilityScreenState();
}

class _AvailabilityScreenState extends ConsumerState<AvailabilityScreen> {
  final _term = TextEditingController();

  /// What was picked: a category's id, or [_off] for what is off now; nothing until a tap
  int? _picked;
  bool _pickedOff = false;

  /// From this width the categories go down the side (the receipts page's two columns)
  static const double _twoColumns = 900;

  @override
  void initState() {
    super.initState();
    _term.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _term.dispose();
    super.dispose();
  }

  // Availability flips optimistically: the list updates first and rolls
  // back if the server rejects it. Always an explicit value: a server-side
  // "toggle" default could drift from what the switch shows.
  Future<void> _setAvailable(CatalogItem item, bool isAvailable) async {
    final ok = await ref.read(catalogItemsProvider.notifier).setAvailability(item.id, isAvailable);
    if (!ok && mounted) showPosToast(context, PosToastType.error, AppLocalizations.of(context)!.failedToUpdateAvailability);
  }

  void _pick(_Entry entry) {
    setState(() {
      _picked = entry.id;
      _pickedOff = entry.id == null;
    });
    _term.clear();
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final categories = [...ref.watch(catalogCategoriesProvider).value ?? const <CatalogCategory>[]]
      ..sort((a, b) => a.displayOrder.compareTo(b.displayOrder));
    final itemsAsync = ref.watch(catalogItemsProvider);
    final items = itemsAsync.value ?? const <CatalogItem>[];
    final wide = MediaQuery.sizeOf(context).width >= _twoColumns;
    final rule = BorderSide(color: theme.colors.border);
    final muted = theme.colors.mutedForeground;
    final red = theme.colors.destructive;

    final offCount = items.where((item) => !item.isAvailable).length;
    // The list's entries: what is off first, then the categories in the menu's order
    final entries = <_Entry>[
      (id: null, name: l10n.availabilityOffNow, off: offCount, all: offCount),
      for (final category in categories)
        (
          id: category.id,
          name: category.name.localized(context),
          off: items.where((item) => item.catalogTypeId == category.id && !item.isAvailable).length,
          all: items.where((item) => item.catalogTypeId == category.id).length,
        ),
    ];
    // Opened on what is off, when anything is; otherwise on the first category
    final search = _term.text.trim().toLowerCase();
    final activeOff = _pickedOff || (_picked == null && (offCount > 0 || categories.isEmpty));
    final activeId = activeOff ? null : (_picked ?? categories.first.id);
    final active = entries.firstWhere((entry) => entry.id == activeId, orElse: () => entries.first);
    final visible = [
      for (final item in items)
        if (search.isNotEmpty
            ? item.name.contains(search)
            : activeOff
                ? !item.isAvailable
                : item.catalogTypeId == activeId)
          item,
    ]..sort((a, b) => a.displayOrder.compareTo(b.displayOrder));

    final back = SizedBox.square(
      dimension: Sizes.control,
      child: FButton.icon(
        variant: FButtonVariant.ghost,
        onPress: () => context.go('/'),
        child: Icon(FIcons.arrowLeft, size: Sizes.iconNav),
      ),
    );
    final find = Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(border: Border(bottom: rule)),
      child: FTextField(
        control: FTextFieldControl.managed(controller: _term),
        hint: l10n.searchItems,
        prefixBuilder: (context, style, _) => Padding(
          padding: const EdgeInsetsDirectional.only(start: 12),
          child: Icon(FIcons.search, size: Sizes.icon, color: muted),
        ),
        maxLines: 1,
      ),
    );

    // How many are off, as a red count; a category with none off says how many it holds, quietly
    Widget? count(_Entry entry, {bool lit = false}) {
      const tabular = [FontFeature.tabularFigures()];
      if (entry.off > 0) {
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 10),
          decoration: BoxDecoration(
            color: lit ? theme.colors.primaryForeground.withValues(alpha: 0.2) : red.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(999),
          ),
          child: Text('${entry.off}',
              style: theme.type.caption.copyWith(
                  fontWeight: FontWeight.w600,
                  color: lit ? theme.colors.primaryForeground : red,
                  fontFeatures: tabular)),
        );
      }
      if (entry.id == null) return null;
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10),
        child: Text('${entry.all}', style: theme.type.caption.copyWith(color: muted, fontFeatures: tabular)),
      );
    }

    // The items under thin rules: two to a row beside the categories, one to a row on a narrow screen
    final Widget body = itemsAsync.when(
      skipLoadingOnReload: true,
      skipLoadingOnRefresh: true,
      loading: () => Skeleton(
        child: Column(
          children: [
            for (var i = 0; i < 8; i++)
              Container(
                height: Sizes.header,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                decoration: BoxDecoration(border: Border(bottom: rule)),
                child: Row(
                  children: [
                    Expanded(child: skeletonBar(context, widthFactor: 0.5, height: 14)),
                    const SizedBox(width: 12),
                    skeletonBox(context, width: 48, height: 28, radius: 14),
                  ],
                ),
              ),
          ],
        ),
      ),
      error: (_, _) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 64, horizontal: 16),
        child: Text(l10n.somethingWentWrong,
            textAlign: TextAlign.center, style: theme.type.body.copyWith(color: muted)),
      ),
      data: (_) {
        if (visible.isEmpty) {
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 64, horizontal: 16),
            child: Text(
                search.isNotEmpty
                    ? l10n.noItemsMatch
                    : activeOff
                        ? l10n.availabilityAllOn
                        : l10n.noItemsInCategory,
                textAlign: TextAlign.center,
                style: theme.type.body.copyWith(color: muted)),
          );
        }
        if (!wide) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (final item in visible) _ItemRow(item: item, rule: rule, onChange: (on) => _setAvailable(item, on)),
            ],
          );
        }
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (var i = 0; i < visible.length; i += 2)
              // Both of a row are as tall as the taller: the rule between them runs its whole height
              IntrinsicHeight(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Expanded(
                      child: _ItemRow(
                          item: visible[i], rule: rule, divided: true, onChange: (on) => _setAvailable(visible[i], on)),
                    ),
                    Expanded(
                      child: i + 1 < visible.length
                          ? _ItemRow(
                              item: visible[i + 1], rule: rule, onChange: (on) => _setAvailable(visible[i + 1], on))
                          : DecoratedBox(decoration: BoxDecoration(border: Border(bottom: rule))),
                    ),
                  ],
                ),
              ),
          ],
        );
      },
    );

    final tally = Text(offCount > 0 ? l10n.availabilityOffCount(offCount) : l10n.availabilityAllOn,
        style: theme.type.detail.copyWith(color: muted, fontFeatures: const [FontFeature.tabularFigures()]));

    if (!wide) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsetsDirectional.only(start: 12, end: 16, top: 8, bottom: 8),
            decoration: BoxDecoration(border: Border(bottom: rule)),
            child: Row(
              children: [
                back,
                const SizedBox(width: 8),
                Expanded(
                    child: Text(l10n.availability, maxLines: 1, overflow: TextOverflow.ellipsis, style: theme.type.title)),
                const SizedBox(width: 8),
                tally,
              ],
            ),
          ),
          find,
          // The categories as one row that slides sideways, as the sale pad's do
          if (search.isEmpty)
            Container(
              height: Sizes.controlSmall + 16,
              decoration: BoxDecoration(border: Border(bottom: rule)),
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                itemCount: entries.length,
                separatorBuilder: (_, _) => const SizedBox(width: 8),
                itemBuilder: (context, index) {
                  final entry = entries[index];
                  final on = entry.id == active.id;
                  return FButton(
                    variant: on ? null : FButtonVariant.outline,
                    mainAxisSize: MainAxisSize.min,
                    onPress: () => _pick(entry),
                    suffix: entry.off > 0 ? count(entry, lit: on) : null,
                    child: Text(entry.name, style: theme.type.button),
                  );
                },
              ),
            ),
          Expanded(child: SingleChildScrollView(child: body)),
        ],
      );
    }

    final width = MediaQuery.sizeOf(context).width;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // The categories down the side: built like the receipts list beside its receipt
        Container(
          width: (width * 0.28).clamp(288.0, 384.0),
          decoration: BoxDecoration(border: BorderDirectional(end: rule)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(border: Border(bottom: rule)),
                child: Row(
                  children: [
                    back,
                    const SizedBox(width: 8),
                    Expanded(
                        child: Text(l10n.availability,
                            maxLines: 1, overflow: TextOverflow.ellipsis, style: theme.type.title)),
                  ],
                ),
              ),
              find,
              Expanded(
                child: ListView(
                  children: [
                    for (final entry in entries)
                      Builder(builder: (context) {
                        final on = search.isEmpty && entry.id == active.id;
                        final tail = count(entry);
                        return FTappable(
                          onPress: () => _pick(entry),
                          builder: (context, states, child) => Container(
                            constraints: const BoxConstraints(minHeight: Sizes.controlLarge),
                            padding: const EdgeInsetsDirectional.only(start: 13, end: 16, top: 8, bottom: 8),
                            // The one picked: tinted, and marked down its start edge
                            decoration: BoxDecoration(
                              color: on
                                  ? theme.colors.secondary
                                  : states.contains(FTappableVariant.pressed)
                                      ? theme.colors.secondary.withValues(alpha: 0.5)
                                      : null,
                              border: BorderDirectional(
                                start: BorderSide(color: on ? theme.colors.primary : Colors.transparent, width: 3),
                                bottom: rule,
                              ),
                            ),
                            child: child,
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                child: Text(entry.name,
                                    style: theme.type.heading
                                        .copyWith(color: entry.id == null && entry.off > 0 ? red : null)),
                              ),
                              if (tail != null) ...[const SizedBox(width: 12), tail],
                            ],
                          ),
                        );
                      }),
                  ],
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // As tall as the list's head beside it (8 + 48 + 8), so the two rules under them meet
              Container(
                constraints: const BoxConstraints(minHeight: Sizes.header + 1),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                decoration: BoxDecoration(border: Border(bottom: rule)),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(search.isNotEmpty ? l10n.searchResults : active.name, style: theme.type.title),
                    ),
                    const SizedBox(width: 12),
                    tally,
                  ],
                ),
              ),
              Expanded(child: SingleChildScrollView(child: body)),
            ],
          ),
        ),
      ],
    );
  }
}

/// The whole row is the label, so a tap anywhere on it flips the switch:
/// no hunting for the control with a wet thumb
class _ItemRow extends StatelessWidget {
  final CatalogItem item;
  final BorderSide rule;

  /// A rule down its end edge: the first of two on a row
  final bool divided;
  final ValueChanged<bool> onChange;

  const _ItemRow({required this.item, required this.rule, required this.onChange, this.divided = false});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final available = item.isAvailable;
    return FTappable(
      onPress: () => onChange(!available),
      builder: (context, states, child) => Container(
        constraints: const BoxConstraints(minHeight: Sizes.header),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: states.contains(FTappableVariant.pressed) ? theme.colors.secondary.withValues(alpha: 0.5) : null,
          border: BorderDirectional(bottom: rule, end: divided ? rule : BorderSide.none),
        ),
        child: child,
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // The name whole: it wraps, it is never cut
                Text(
                  item.name.localized(context),
                  style: theme.type.heading.copyWith(
                    color: available ? null : theme.colors.mutedForeground,
                    decoration: available ? null : TextDecoration.lineThrough,
                  ),
                ),
                // Off is said under the name
                if (!available)
                  Text(l10n.soldOut, style: theme.type.detail.copyWith(color: theme.colors.destructive)),
              ],
            ),
          ),
          const SizedBox(width: 12),
          FSwitch(value: available, onChange: onChange),
        ],
      ),
    );
  }
}

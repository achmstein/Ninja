import 'dart:ui' show ImageFilter;
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/brand/brand_style.dart';
import '../../../core/motion/motion.dart';
import '../../../core/providers/branch_provider.dart';
import '../../../core/providers/locale_provider.dart';
import '../../../core/theme/theme_provider.dart';
import '../../../core/ui/ui.dart';
import '../../../core/utils/money.dart';
import '../../../l10n/app_localizations.dart';
import '../../cart/models/cart_item.dart';
import '../../cart/services/cart_service.dart';
import '../../cart/widgets/tray_flights.dart';
import '../models/menu_item.dart';
import '../models/user_preference.dart';
import '../paired_items.dart';
import '../services/menu_service.dart';

/// Where each dish's photo is on screen, so a dish opened from it grows out
/// of it and closes back into it; and which one is hidden while its copy is
/// in the air, so there are never two
abstract final class DishPhotos {
  static final _anchors = <int, _DishPhotoAnchorState>{};

  /// The dish whose photo is out (its copy flying)
  static final hidden = ValueNotifier<int?>(null);

  /// The photo of [id] on screen now, where it is and its corners; null when it is not in view
  static ({Rect rect, double radius})? find(int id) {
    final anchor = _anchors[id];
    if (anchor == null || !anchor.mounted) return null;
    final box = anchor.context.findRenderObject() as RenderBox?;
    if (box == null || !box.attached || !box.hasSize) return null;
    final rect = box.localToGlobal(Offset.zero) & box.size;
    final screen = Offset.zero & MediaQuery.sizeOf(anchor.context);
    if (!screen.overlaps(rect)) return null;
    return (rect: rect, radius: anchor.widget.radius);
  }
}

/// A dish's photo, known to [DishPhotos] by its dish
class DishPhotoAnchor extends StatefulWidget {
  final int id;
  final double radius;
  final Widget child;

  const DishPhotoAnchor({super.key, required this.id, required this.radius, required this.child});

  @override
  State<DishPhotoAnchor> createState() => _DishPhotoAnchorState();
}

class _DishPhotoAnchorState extends State<DishPhotoAnchor> {
  @override
  void initState() {
    super.initState();
    DishPhotos._anchors[widget.id] = this;
  }

  @override
  void didUpdateWidget(DishPhotoAnchor old) {
    super.didUpdateWidget(old);
    if (old.id != widget.id) {
      if (DishPhotos._anchors[old.id] == this) DishPhotos._anchors.remove(old.id);
      DishPhotos._anchors[widget.id] = this;
    }
  }

  @override
  void dispose() {
    if (DishPhotos._anchors[widget.id] == this) DishPhotos._anchors.remove(widget.id);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ValueListenableBuilder<int?>(
    valueListenable: DishPhotos.hidden,
    child: widget.child,
    builder: (context, hidden, child) => Opacity(opacity: hidden == widget.id ? 0 : 1, child: child),
  );
}

/// The spring a dish opens and closes on (the web's springOpen)
final _openSpring = SpringCurve(Motion.springOpen);

/// Opens [item] over the app (client_web's tune.tsx): its photo leaves the
/// dish ([DishPhotos]) and becomes the view's banner, the page coming up
/// round it, and closing takes it back. Added, the view fades instead: the
/// dish is in the tray. [suggestion] says the dish was suggested
/// ('Pairing'), which its line keeps saying.
Future<void> showDishView(BuildContext context, MenuItem item, {String? suggestion}) {
  final from = DishPhotos.find(item.id);
  return Navigator.of(context, rootNavigator: true).push(DishRoute(item: item, from: from, suggestion: suggestion));
}

class DishRoute extends PageRoute<void> {
  final MenuItem item;
  final ({Rect rect, double radius})? from;
  final String? suggestion;

  /// Leaving without going back into its dish: added to the tray, or handing over to another dish
  bool quiet = false;

  DishRoute({required this.item, this.from, this.suggestion});

  @override
  bool get opaque => false;

  @override
  Color? get barrierColor => null;

  @override
  String? get barrierLabel => null;

  @override
  bool get maintainState => true;

  @override
  Duration get transitionDuration => _openSpring.duration;

  @override
  Duration get reverseTransitionDuration => quiet ? const Duration(milliseconds: 180) : _openSpring.duration;

  @override
  Widget buildPage(BuildContext context, Animation<double> animation, Animation<double> secondaryAnimation) => DishView(route: this);

  @override
  Widget buildTransitions(BuildContext context, Animation<double> animation, Animation<double> secondaryAnimation, Widget child) => child;
}

/// A dish open: its banner, its name and what it is, its questions (the
/// ones that must be answered first, every one the same pills), what goes
/// well with it and a note, over the one action: how many, and add at a
/// price that rolls as the choices change; until the answers are in, the
/// button names the one left and goes to it.
class DishView extends ConsumerStatefulWidget {
  final DishRoute route;

  const DishView({super.key, required this.route});

  @override
  ConsumerState<DishView> createState() => _DishViewState();
}

class _DishViewState extends ConsumerState<DishView> {
  MenuItem get item => widget.route.item;

  final _banner = GlobalKey();
  final _scroll = ScrollController();
  late final List<GlobalKey> _questionKeys = [for (final _ in _steps) GlobalKey()];

  /// customization → the options picked
  Map<int, List<int>> _picked = {};
  bool _loadingPreference = true;
  int _quantity = 1;
  bool _noteOpen = false;
  final _note = TextEditingController();
  ({int index, int n})? _flash;

  /// The copy of the photo in the air, and where from and to
  bool _flying = false;
  ({Rect rect, double radius})? _flightFrom;
  late final Animation<double> _progress;

  /// The questions in the business's order, the ones that must be answered first
  late final List<ItemCustomization> _steps = [...item.customizations.where((c) => c.isRequired), ...item.customizations.where((c) => !c.isRequired)];

  @override
  void initState() {
    super.initState();
    _picked = _defaults();
    _loadPreference();
    final animation = widget.route.animation!;
    _progress = CurvedAnimation(parent: animation, curve: _openSpring, reverseCurve: _openSpring.flipped);
    animation.addStatusListener(_onStatus);
    _flightFrom = widget.route.from;
    if (_flightFrom != null) {
      _flying = true;
      DishPhotos.hidden.value = item.id;
    }
  }

  @override
  void dispose() {
    widget.route.animation?.removeStatusListener(_onStatus);
    if (DishPhotos.hidden.value == item.id) DishPhotos.hidden.value = null;
    _scroll.dispose();
    _note.dispose();
    super.dispose();
  }

  void _onStatus(AnimationStatus status) {
    // Back in its dish (or gone): the dish shows its own photo again
    if (status == AnimationStatus.dismissed) {
      if (DishPhotos.hidden.value == item.id) DishPhotos.hidden.value = null;
      return;
    }
    if (!mounted) return;
    if (status == AnimationStatus.completed && _flying) {
      // Landed: the banner is the photo now, and the dish shows its own again
      setState(() => _flying = false);
      if (DishPhotos.hidden.value == item.id) DishPhotos.hidden.value = null;
    } else if (status == AnimationStatus.reverse) {
      if (widget.route.quiet) return;
      // Going back: measured again (the page may have scrolled, the dish moved), then the same spring back
      final back = reduceMotion(context) ? null : DishPhotos.find(item.id);
      setState(() {
        _flightFrom = back;
        _flying = back != null;
      });
      if (back != null) DishPhotos.hidden.value = item.id;
    }
  }

  /// The business's defaults, nothing sold out
  Map<int, List<int>> _defaults() => {
    for (final c in item.customizations)
      c.id: [
        for (final o in c.options)
          if (o.isDefault && !o.isOutOfStock) o.id,
      ],
  };

  Future<void> _loadPreference() async {
    UserItemPreference? preference;
    try {
      preference = await ref.read(menuRepositoryProvider).getUserPreference(item.id);
    } catch (_) {
      // No saved picks: the defaults stand
    }
    if (!mounted) return;
    setState(() {
      _loadingPreference = false;
      if (preference == null) return;
      final saved = <int, List<int>>{};
      for (final option in preference.selectedOptions) {
        saved.putIfAbsent(option.customizationId, () => []).add(option.optionId);
      }
      for (final c in item.customizations) {
        final valid = [
          for (final id in saved[c.id] ?? const <int>[])
            if (c.options.any((o) => o.id == id && !o.isOutOfStock)) id,
        ];
        if (valid.isNotEmpty) _picked[c.id] = valid;
      }
    });
  }

  void _pick(ItemCustomization c, int optionId) {
    final current = _picked[c.id] ?? const <int>[];
    setState(() {
      if (c.allowMultiple) {
        _picked[c.id] = current.contains(optionId) ? [...current.where((id) => id != optionId)] : [...current, optionId];
      } else {
        // One choice: tapping it again clears it only when the question is optional
        _picked[c.id] = current.contains(optionId) && !c.isRequired ? [] : [optionId];
      }
    });
  }

  List<SelectedCustomization> get _chosen => [
    for (final c in item.customizations)
      for (final o in c.options)
        if ((_picked[c.id] ?? const <int>[]).contains(o.id))
          SelectedCustomization(customizationId: c.id, customizationName: c.name, optionId: o.id, optionName: o.name, priceAdjustment: o.priceAdjustment),
  ];

  double get _unitPrice => item.effectivePrice + _chosen.fold(0.0, (sum, c) => sum + c.priceAdjustment);

  int get _missing => _steps.indexWhere((c) => c.isRequired && (_picked[c.id] ?? const <int>[]).isEmpty);

  /// Sends the eye to a question still to answer: it scrolls into view and glows a moment
  void _show(int index) {
    final context = _questionKeys[index].currentContext;
    if (context != null) Scrollable.ensureVisible(context, alignment: 0.5, duration: Motion.slow, curve: Motion.move);
    setState(() => _flash = (index: index, n: (_flash?.n ?? 0) + 1));
  }

  void _add() {
    HapticFeedback.selectionClick();
    final note = _note.text.trim();
    final line = CartItem.fromMenuItem(
      item,
      customizations: _chosen,
      instructions: note.isEmpty ? null : note,
    ).copyWith(quantity: _quantity, suggestion: widget.route.suggestion);
    // The banner's photo itself goes to the tray: the view lets go of it and fades, rather than
    // folding back into the dish, which is back at once
    final media = MediaQuery.of(context);
    final banner = _bannerRect(media);
    final cart = ref.read(cartProvider.notifier);
    trayFlights.fly(
      from: banner.bottom > media.padding.top ? banner : null,
      radius: 0,
      photo: item.pictureUri,
      reduced: reduceMotion(context),
      land: () => cart.addItem(line),
    );
    if (DishPhotos.hidden.value == item.id) DishPhotos.hidden.value = null;
    widget.route.quiet = true;
    Navigator.of(context).pop();
  }

  void _close() => Navigator.of(context).pop();

  /// A suggestion tapped: in with its defaults when nothing needs choosing, else it opens in this one's place
  void _suggest(MenuItem suggested) {
    if (canQuickAdd(suggested)) {
      HapticFeedback.selectionClick();
      final cart = ref.read(cartProvider.notifier);
      trayFlights.fly(from: null, land: () => cart.addItem(suggestedLine(suggested, 'Pairing')));
      return;
    }
    widget.route.quiet = true;
    Navigator.of(context).pushReplacement(DishRoute(item: suggested, suggestion: 'Pairing'));
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final theme = context.theme;
    final c = theme.colors;
    final locale = ref.watch(localeProvider);
    final money = ref.watch(moneyProvider);
    final canOrder = ref.watch(branchProvider).selectedBranch?.isOrderingEnabled ?? true;
    final soldOut = !item.isAvailable;
    final missing = _missing;
    final ready = missing < 0;
    final media = MediaQuery.of(context);
    final reduced = reduceMotion(context);
    final bannerHeight = (media.size.width * 7 / 16).clamp(0.0, 180.0);
    final description = item.description.getText(locale);
    // None on a dish that was itself a suggestion: taking one never brings on the next
    final suggestions = widget.route.suggestion != null || !canOrder || soldOut
        ? const <MenuItem>[]
        : pairedFor(item, ref.watch(menuByIdProvider), ref.watch(cartProvider).items).take(maxOnSheet).toList();

    final banner = SizedBox(
      key: _banner,
      height: bannerHeight,
      width: double.infinity,
      child: _Photo(item: item, iconSize: 48),
    );

    final body = Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          BrandHeading(item.name.getText(locale), style: theme.typography.headline.copyWith(color: c.foreground)),
          if (description.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              description,
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
              style: context.localeText(theme.typography.note.copyWith(color: c.mutedForeground)),
            ),
          ],
          if (_loadingPreference && _steps.isNotEmpty) ...[
            const SizedBox(height: 20),
            Container(
              height: 160,
              decoration: BoxDecoration(color: c.muted, borderRadius: BorderRadius.circular(Ninja.panelRadius)),
            ),
          ] else
            for (final (i, step) in _steps.indexed) ...[
              const SizedBox(height: 20),
              _Question(
                key: _questionKeys[i],
                customization: step,
                picked: _picked[step.id] ?? const [],
                flash: _flash?.index == i ? _flash!.n : 0,
                onPick: (id) => _pick(step, id),
              ),
            ],
          if (suggestions.isNotEmpty) ...[const SizedBox(height: 20), _GoesWellWith(items: suggestions, onPick: _suggest)],
          const SizedBox(height: 20),
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: _noteOpen
                ? NinjaField(controller: _note, autofocus: true, hint: l10n.anySpecialRequestsOptional)
                : GestureDetector(
                    onTap: () => setState(() => _noteOpen = true),
                    child: Text(
                      l10n.ninjaAddNote,
                      style: context.localeText(theme.typography.note.copyWith(color: c.mutedForeground, fontWeight: FontWeight.w500)),
                    ),
                  ),
          ),
        ],
      ),
    );

    final label = soldOut
        ? l10n.unavailable
        : ready
        ? l10n.addToCart
        : l10n.ninjaChoose(_steps[missing].name.getText(locale));
    final footer = Container(
      decoration: BoxDecoration(
        color: c.background,
        border: Border(top: BorderSide(color: c.border)),
      ),
      padding: EdgeInsets.fromLTRB(16, 12, 16, 12 + media.viewPadding.bottom),
      child: Row(
        children: [
          NinjaIconButton(
            onPress: _quantity > 1 ? () => setState(() => _quantity--) : null,
            semanticLabel: l10n.ninjaLess,
            child: const Icon(LucideIcons.minus),
          ),
          SizedBox(
            width: 28,
            child: Text(
              '$_quantity',
              textAlign: TextAlign.center,
              style: theme.typography.headline.copyWith(fontWeight: FontWeight.w700, color: c.foreground, fontFeatures: NinjaTypography.tabular),
            ),
          ),
          NinjaIconButton(onPress: () => setState(() => _quantity++), semanticLabel: l10n.ninjaMore, child: const Icon(LucideIcons.plus)),
          const SizedBox(width: 12),
          Expanded(
            child: _AddButton(
              label: label,
              total: !soldOut && ready ? money(_unitPrice * _quantity) : null,
              value: _unitPrice * _quantity,
              onPress: !canOrder || soldOut || _loadingPreference ? null : () => ready ? _add() : _show(missing),
            ),
          ),
        ],
      ),
    );

    return AnimatedBuilder(
      animation: _progress,
      builder: (context, _) {
        final animation = widget.route.animation!;
        final quietly = widget.route.quiet && animation.status == AnimationStatus.reverse;
        final p = reduced ? animation.value : _progress.value;
        double between(double from, double to) => ((p - from) / (to - from)).clamp(0.0, 1.0);

        final page = Material(
          type: MaterialType.transparency,
          child: Stack(
            children: [
              // The page comes up early, so the photo travels over it
              Positioned.fill(
                child: ColoredBox(color: c.background.withValues(alpha: quietly ? 1 : between(0, 0.3))),
              ),
              Positioned.fill(
                top: media.padding.top,
                child: Column(
                  children: [
                    Expanded(
                      child: SingleChildScrollView(
                        controller: _scroll,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            // Shown once the copy has landed on it; with nothing to grow out of, it fades in with the page
                            Opacity(opacity: _flying ? 0 : (_flightFrom == null && !quietly ? between(0, 0.5) : 1), child: banner),
                            Opacity(
                              opacity: quietly ? 1 : between(0.4, 1),
                              child: Transform.translate(offset: Offset(0, reduced || quietly ? 0 : 28 * (1 - p)), child: body),
                            ),
                          ],
                        ),
                      ),
                    ),
                    Opacity(
                      opacity: quietly ? 1 : between(0.2, 0.7),
                      child: Transform.translate(offset: Offset(0, reduced || quietly ? 0 : 72 * (1 - p)), child: footer),
                    ),
                  ],
                ),
              ),
              // The photo on its way: a copy, clipped to the frame it is passing through
              if (_flying && _flightFrom != null) _flight(context, p, media),
              PositionedDirectional(
                top: media.padding.top + 12,
                end: 12,
                child: Opacity(
                  opacity: quietly ? 1 : between(0.6, 1),
                  child: _CloseButton(label: l10n.close, onTap: _close),
                ),
              ),
            ],
          ),
        );
        // Added (or handing over to another dish): it fades off the dish, a touch smaller
        if (quietly) {
          final v = animation.value;
          return Opacity(
            opacity: v,
            child: Transform.scale(scale: 0.97 + 0.03 * v, child: page),
          );
        }
        return page;
      },
    );
  }

  Widget _flight(BuildContext context, double p, MediaQueryData media) {
    final from = _flightFrom!;
    final banner = _bannerRect(media);
    final rect = Rect.lerp(from.rect, banner, p)!;
    final radius = from.radius * (1 - p).clamp(0.0, 1.0);
    return Positioned.fromRect(
      rect: rect,
      child: IgnorePointer(
        child: ClipRRect(
          borderRadius: BorderRadius.circular(radius),
          child: _Photo(item: item, iconSize: 48),
        ),
      ),
    );
  }

  /// Where the banner is now: its own place when laid out, else where it opens
  Rect _bannerRect(MediaQueryData media) {
    final box = _banner.currentContext?.findRenderObject() as RenderBox?;
    if (box != null && box.attached && box.hasSize) return box.localToGlobal(Offset.zero) & box.size;
    return Rect.fromLTWH(0, media.padding.top, media.size.width, (media.size.width * 7 / 16).clamp(0.0, 180.0));
  }
}

/// A dish's photo filling its frame, or the plate on the business's colour
class _Photo extends StatelessWidget {
  final MenuItem item;
  final double iconSize;

  const _Photo({required this.item, required this.iconSize});

  @override
  Widget build(BuildContext context) {
    final c = context.theme.colors;
    final plate = ColoredBox(
      color: c.primary,
      child: Center(
        child: Icon(LucideIcons.utensilsCrossed, size: iconSize, color: c.primaryForeground.withValues(alpha: 0.5)),
      ),
    );
    Widget photo = item.pictureUri == null
        ? plate
        : CachedNetworkImage(
            imageUrl: item.pictureUri!,
            fit: BoxFit.cover,
            errorWidget: (_, _, _) => plate,
            placeholder: (_, _) => ColoredBox(color: c.muted),
          );
    if (!item.isAvailable) {
      photo = ColorFiltered(
        colorFilter: const ColorFilter.matrix([0.2126, 0.7152, 0.0722, 0, 0, 0.2126, 0.7152, 0.0722, 0, 0, 0.2126, 0.7152, 0.0722, 0, 0, 0, 0, 0, 1, 0]),
        child: photo,
      );
    }
    return SizedBox.expand(child: photo);
  }
}

class _CloseButton extends StatelessWidget {
  final String label;
  final VoidCallback onTap;

  const _CloseButton({required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) => Pressable(
    onTap: onTap,
    scale: 0.92,
    semanticLabel: label,
    child: ClipOval(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 4, sigmaY: 4),
        child: Container(
          width: 40,
          height: 40,
          color: const Color(0x73000000),
          child: const Icon(LucideIcons.x, size: 20, color: Colors.white),
        ),
      ),
    ),
  );
}

/// The main button: Add at the price, or the question still to answer; its words swap with a short blur
class _AddButton extends StatelessWidget {
  final String label;
  final String? total;
  final double value;
  final VoidCallback? onPress;

  const _AddButton({required this.label, required this.total, required this.value, required this.onPress});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final c = theme.colors;
    final style = context.localeText(theme.typography.body.copyWith(color: c.primaryForeground, fontWeight: FontWeight.w700));
    return Pressable(
      onTap: onPress,
      scale: 0.98,
      child: AnimatedOpacity(
        opacity: onPress == null ? 0.5 : 1,
        duration: Motion.fast,
        child: Container(
          height: 48,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          decoration: ShapeDecoration(color: c.primary, shape: const StadiumBorder()),
          child: Row(
            children: [
              Expanded(
                child: BlurSwap(
                  child: Text(label, key: ValueKey(label), maxLines: 1, overflow: TextOverflow.ellipsis, style: style),
                ),
              ),
              if (total != null) ...[const SizedBox(width: 8), RollingNumber(total!, value: value, style: style)],
            ],
          ),
        ),
      ),
    );
  }
}

/// One question: its name (and whether it must be answered) over its
/// options as pills that fill when picked, with what each adds. Sent to by
/// the button, it glows a moment.
class _Question extends ConsumerWidget {
  final ItemCustomization customization;
  final List<int> picked;
  final int flash;
  final ValueChanged<int> onPick;

  const _Question({super.key, required this.customization, required this.picked, required this.flash, required this.onPick});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final theme = context.theme;
    final c = theme.colors;
    final locale = ref.watch(localeProvider);
    final money = ref.watch(moneyProvider);
    final unanswered = customization.isRequired && picked.isEmpty;
    final nameStyle = BrandStyle.of(context).heading(context, theme.typography.name.copyWith(color: c.foreground));

    final block = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Expanded(
              child: Text(customization.name.getText(locale), style: nameStyle.copyWith(fontSize: theme.typography.name.fontSize)),
            ),
            const SizedBox(width: 12),
            Text(
              customization.isRequired ? l10n.required : l10n.ninjaOptional,
              style: context.localeText(theme.typography.caption.copyWith(fontWeight: FontWeight.w500, color: unanswered ? c.destructive : c.mutedForeground)),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final option in customization.options)
              _OptionPill(
                name: option.name.getText(locale),
                extra: option.isOutOfStock
                    ? l10n.outOfStock
                    : option.priceAdjustment > 0
                    ? '+${money(option.priceAdjustment)}'
                    : null,
                on: picked.contains(option.id),
                onTap: option.isOutOfStock ? null : () => onPick(option.id),
              ),
          ],
        ),
      ],
    );

    return Stack(
      clipBehavior: Clip.none,
      children: [
        block,
        // The glow: a ring that lights and fades, keyed so each send lights it again
        if (flash > 0)
          Positioned(
            left: -8,
            right: -8,
            top: -8,
            bottom: -8,
            child: IgnorePointer(
              child: _Glow(key: ValueKey(flash), color: c.primary),
            ),
          ),
      ],
    );
  }
}

class _Glow extends StatefulWidget {
  final Color color;

  const _Glow({super.key, required this.color});

  @override
  State<_Glow> createState() => _GlowState();
}

class _GlowState extends State<_Glow> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1550))..forward();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: _c,
    builder: (context, _) {
      // Lit for a beat, then fading
      final t = ((_c.value * 1550 - 350) / 1200).clamp(0.0, 1.0);
      return DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(Ninja.panelRadius),
          border: Border.all(color: widget.color.withValues(alpha: 1 - Motion.exit.transform(t)), width: 2),
        ),
      );
    },
  );
}

class _OptionPill extends StatelessWidget {
  final String name;
  final String? extra;
  final bool on;
  final VoidCallback? onTap;

  const _OptionPill({required this.name, required this.extra, required this.on, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final c = theme.colors;
    final ink = on ? c.primaryForeground : c.foreground;
    return Pressable(
      onTap: onTap,
      scale: 0.97,
      child: Opacity(
        opacity: onTap == null ? 0.4 : 1,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          constraints: const BoxConstraints(minHeight: 40),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
          decoration: BoxDecoration(color: on ? c.primary : c.muted, borderRadius: BorderRadius.circular(Ninja.tileRadius)),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Flexible(
                child: Text(
                  name,
                  style: context.localeText(theme.typography.note.copyWith(fontWeight: FontWeight.w600, color: ink, height: 1.3)),
                ),
              ),
              if (extra != null) ...[
                const SizedBox(width: 6),
                Text(
                  extra!,
                  style: context.localeText(theme.typography.caption.copyWith(color: ink.withValues(alpha: 0.75), fontFeatures: NinjaTypography.tabular)),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// What goes well with the dish: a small card each, in the business's
/// order, sideways when there are more than fit
class _GoesWellWith extends ConsumerWidget {
  final List<MenuItem> items;
  final ValueChanged<MenuItem> onPick;

  const _GoesWellWith({required this.items, required this.onPick});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final theme = context.theme;
    final c = theme.colors;
    final locale = ref.watch(localeProvider);
    final money = ref.watch(moneyProvider);
    final nameStyle = BrandStyle.of(context).heading(context, theme.typography.name.copyWith(color: c.foreground));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(l10n.goesWellWith, style: nameStyle.copyWith(fontSize: theme.typography.name.fontSize)),
        const SizedBox(height: 10),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          clipBehavior: Clip.none,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (final (i, item) in items.indexed) ...[
                if (i > 0) const SizedBox(width: 10),
                Pressable(
                  onTap: () => onPick(item),
                  scale: 0.98,
                  semanticLabel: l10n.addSuggestion(item.name.getText(locale)),
                  child: Container(
                    width: 144,
                    clipBehavior: Clip.antiAlias,
                    decoration: BoxDecoration(color: c.muted.withValues(alpha: 0.6), borderRadius: BorderRadius.circular(Ninja.tileRadius)),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        AspectRatio(
                          aspectRatio: 4 / 3,
                          child: _Photo(item: item, iconSize: 24),
                        ),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          child: Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      item.name.getText(locale),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: context.localeText(theme.typography.note.copyWith(fontWeight: FontWeight.w500, color: c.foreground)),
                                    ),
                                    Text(
                                      money(item.effectivePrice),
                                      style: context.localeText(
                                        theme.typography.caption.copyWith(color: c.mutedForeground, fontFeatures: NinjaTypography.tabular),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 8),
                              Container(
                                width: 28,
                                height: 28,
                                decoration: BoxDecoration(color: c.primary, shape: BoxShape.circle),
                                child: Icon(LucideIcons.plus, size: 16, color: c.primaryForeground),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

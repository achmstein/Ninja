import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/physics.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/models/localized_text.dart';
import '../../../core/motion/motion.dart';
import '../../../core/providers/branch_provider.dart';
import '../../../core/providers/current_place_provider.dart';
import '../../../core/providers/locale_provider.dart';
import '../../../core/theme/theme_provider.dart';
import '../../../core/ui/ui.dart';
import '../../../core/utils/money.dart';
import '../../../l10n/app_localizations.dart';
import '../../orders/services/order_service.dart';
import '../models/cart_item.dart';
import '../services/cart_service.dart';
import '../services/checkout_flow.dart';
import '../services/promo_service.dart';
import '../../delivery/services/delivery_service.dart';
import '../../delivery/widgets/delivery_choice.dart';
import 'cart_nudge.dart';
import 'tray_extras.dart';
import 'tray_flights.dart';
import 'tray_hint.dart';
import 'tray_model.dart';
import 'tray_seats.dart';

/// The order stands open over the page (the shell's [TrayMotion] set
/// open): the menu's first-visit cues wait while it is (client_web's
/// `expanded`). One flag for the app, kept by the shell.
class OrderOpen extends Notifier<bool> {
  @override
  bool build() => false;

  void set(bool open) {
    if (state != open) state = open;
  }
}

final orderOpenProvider = NotifierProvider<OrderOpen, bool>(OrderOpen.new);

/// How far the order is open, 0 shut to 1 open, and the way it moves: under
/// a finger it follows the finger, let go it springs open or back down by
/// how far and how fast it was pulled (client_web's tray.tsx). The shell
/// owns it: the dimming behind the order reads it too.
class TrayMotion extends ChangeNotifier {
  final AnimationController _open;
  bool _expanded = false;
  bool _dragging = false;
  double _dragged = 0;

  /// The order sheet's height, measured once it is laid out
  double sheetHeight = 0;

  /// The order peeking out of the dock once, after the first dish
  bool _peeking = false;

  TrayMotion(TickerProvider vsync) : _open = AnimationController.unbounded(vsync: vsync) {
    _open.addListener(notifyListeners);
    traySeats.attach(this);
  }

  Animation<double> get openness => _open;
  double get value => _open.value.clamp(0.0, 1.0);
  bool get expanded => _expanded;

  /// Mounted while open, opening, closing, peeking or under a finger
  bool get sheetShown => _expanded || _dragging || _peeking || _open.value > 0.001;

  void setExpanded(bool expanded, {bool reduced = false}) {
    _expanded = expanded;
    _settle(0, reduced);
  }

  void toggle() => setExpanded(!_expanded);

  /// The first dish in: the order peeks out of the dock and tucks back, twice
  /// and smaller the second time (client_web's tray.tsx peek). A tap or a
  /// finger takes over from it at once.
  void peek() {
    if (_expanded || _dragging || _peeking) return;
    _peeking = true;
    notifyListeners();
    _open.animateWith(_PeekSimulation(() => sheetHeight > 0 ? sheetHeight : 320)).whenCompleteOrCancel(() {
      _peeking = false;
      notifyListeners();
    });
  }

  void dragStart() {
    _dragging = true;
    _dragged = 0;
    _open.stop();
    notifyListeners();
  }

  void dragUpdate(double dy) {
    if (!_dragging) return;
    _dragged += dy;
    final h = sheetHeight > 0 ? sheetHeight : 320;
    _open.value = (_open.value - dy / h).clamp(0.0, 1.0);
  }

  void dragEnd(double velocityY, {bool reduced = false}) {
    if (!_dragging) return;
    _dragging = false;
    _expanded = trayOpensAfterDrag(_expanded, _dragged, velocityY);
    final h = sheetHeight > 0 ? sheetHeight : 320;
    _settle(-velocityY / h, reduced);
  }

  void _settle(double velocity, bool reduced) {
    final target = _expanded ? 1.0 : 0.0;
    if (reduced) {
      _open.value = target;
      notifyListeners();
      return;
    }
    _open.animateWith(SpringSimulation(Motion.springTray, _open.value, target, velocity, tolerance: const Tolerance(distance: 0.001, velocity: 0.01)));
  }

  @override
  void dispose() {
    traySeats.detach(this);
    _open.dispose();
    super.dispose();
  }
}

/// The peek as how far the order is open: up 56 px, back, up 28 px, back,
/// over 1.1 s after a 150 ms pause, each step eased out (client_web's
/// keyframes `[h, h - 56, h, h - 28, h]`). Pixels over the sheet's height,
/// read as it goes, since the sheet is measured only once it is mounted.
class _PeekSimulation extends Simulation {
  final double Function() height;

  _PeekSimulation(this.height);

  static const _delay = 0.15, _length = 1.1;
  static const _rises = [0.0, 56.0, 0.0, 28.0, 0.0];

  @override
  double x(double time) {
    final u = ((time - _delay) / _length).clamp(0.0, 1.0);
    final step = (u * 4).floor().clamp(0, 3);
    final s = Curves.easeOut.transform((u * 4 - step).clamp(0.0, 1.0));
    final px = _rises[step] + (_rises[step + 1] - _rises[step]) * s;
    return px / height();
  }

  @override
  double dx(double time) => 0;

  @override
  bool isDone(double time) => time >= _delay + _length;
}

/// The tray's row of the dock: the dishes' photos, how many, the total that
/// rolls, and the way to the order where the thumb is. Dragged up or tapped
/// it opens the order; the button beside it opens it too, and in the open
/// order the same button places it. The first dish to land lets the order
/// peek out once, with a word on dragging it up ([trayHint]).
class TrayRow extends ConsumerStatefulWidget {
  final TrayMotion motion;
  final double height;

  const TrayRow({super.key, required this.motion, required this.height});

  @override
  ConsumerState<TrayRow> createState() => _TrayRowState();
}

class _TrayRowState extends ConsumerState<TrayRow> {
  TrayMotion get motion => widget.motion;

  @override
  void initState() {
    super.initState();
    trayHint.addListener(_hinted);
    motion.addListener(_moved);
  }

  @override
  void didUpdateWidget(TrayRow old) {
    super.didUpdateWidget(old);
    if (old.motion == motion) return;
    old.motion.removeListener(_moved);
    motion.addListener(_moved);
  }

  @override
  void dispose() {
    trayHint.removeListener(_hinted);
    motion.removeListener(_moved);
    super.dispose();
  }

  /// The cue came up: the order peeks out of the dock with it, unless it is open, empty, or motion is unwelcome
  void _hinted() {
    if (!trayHint.showing || !mounted) return;
    if (reduceMotion(context) || motion.expanded || ref.read(cartProvider).isEmpty) return;
    motion.peek();
  }

  /// Opening the order, shown the cue or not, is the end of it
  void _moved() {
    if (motion.expanded && trayHint.pending) trayHint.done();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final theme = context.theme;
    final c = theme.colors;
    final money = ref.watch(moneyProvider);
    final cart = ref.watch(cartProvider);
    final summary = traySummary(cart.items);
    final saved = _saved(ref);
    // What the customer pays, the delivery fee on top once the branch has quoted it
    final total = (summary.total - saved).clamp(0.0, double.infinity) + ref.watch(deliveryStateProvider.select((d) => d.fee));
    final canOrder = ref.watch(branchProvider).selectedBranch?.isOrderingEnabled ?? true;
    final reduced = reduceMotion(context);
    // The photos fly to their rows as the order opens: they leave the dock at once, and come back as it shuts
    final seats = !reduced && traySeats.flies;
    final height = widget.height;

    return SizedBox(
      key: trayHint.anchor,
      height: height,
      child: Padding(
        padding: const EdgeInsetsDirectional.only(start: 24, end: 12),
        child: Row(
          children: [
            Expanded(
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: motion.toggle,
                onVerticalDragStart: (_) => motion.dragStart(),
                onVerticalDragUpdate: (d) => motion.dragUpdate(d.delta.dy),
                onVerticalDragEnd: (d) => motion.dragEnd(d.primaryVelocity ?? 0, reduced: reduced),
                child: Semantics(
                  button: true,
                  label: l10n.ninjaYourOrder,
                  child: AnimatedBuilder(
                    animation: motion,
                    builder: (context, _) {
                      final open = reduced ? (motion.expanded ? 1.0 : 0.0) : motion.value;
                      return Row(
                        children: [
                          // Open, the dock is just the total: the photos' place closes up
                          ClipRect(
                            child: Align(
                              alignment: AlignmentDirectional.centerStart,
                              widthFactor: 1 - open,
                              child: Opacity(
                                opacity: seats ? (open <= 0.001 ? 1 : 0) : (1 - open * 2).clamp(0.0, 1.0),
                                child: Padding(
                                  padding: const EdgeInsetsDirectional.only(end: 12),
                                  // Where a dish's photo lands, nudged as each does; a first dish lands on its empty place
                                  child: KeyedSubtree(
                                    key: trayFlights.target,
                                    child: TrayBump(child: summary.thumbs.isEmpty ? const SizedBox.square(dimension: 44) : _Thumbs(summary: summary)),
                                  ),
                                ),
                              ),
                            ),
                          ),
                          Expanded(
                            // A first dish still on its way: the empty order says what it is for
                            child: summary.count == 0
                                ? Text(
                                    l10n.ninjaEmptyTray,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: context.localeText(theme.typography.caption.copyWith(color: c.foreground.withValues(alpha: 0.7))),
                                  )
                                : Column(
                                    mainAxisSize: MainAxisSize.min,
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      ClipRect(
                                        child: Align(
                                          alignment: AlignmentDirectional.topStart,
                                          heightFactor: 1 - open,
                                          child: Opacity(
                                            opacity: (1 - open * 2.5).clamp(0.0, 1.0),
                                            child: Text(
                                              l10n.trayItemCount(summary.count),
                                              style: context.localeText(theme.typography.caption.copyWith(color: c.foreground.withValues(alpha: 0.7))),
                                            ),
                                          ),
                                        ),
                                      ),
                                      Transform.scale(
                                        scale: 1 + 0.3 * open,
                                        alignment: Directionality.of(context) == TextDirection.rtl ? Alignment.centerRight : Alignment.centerLeft,
                                        child: RollingNumber(
                                          money(total),
                                          value: total,
                                          style: context.localeText(theme.typography.name.copyWith(fontWeight: FontWeight.w700, color: c.foreground)),
                                        ),
                                      ),
                                      // What the code and the points take off, under the total they took it from
                                      AnimatedSize(
                                        duration: Motion.base,
                                        curve: Motion.enter,
                                        child: saved > 0
                                            ? Text(
                                                '−${money(saved)}',
                                                style: context.localeText(
                                                  theme.typography.micro.copyWith(
                                                    color: NinjaColors.success,
                                                    fontWeight: FontWeight.w600,
                                                    fontFeatures: NinjaTypography.tabular,
                                                  ),
                                                ),
                                              )
                                            : const SizedBox(width: double.infinity),
                                      ),
                                    ],
                                  ),
                          ),
                        ],
                      );
                    },
                  ),
                ),
              ),
            ),
            if (canOrder && summary.count > 0) OrderButton(motion: motion),
          ],
        ),
      ),
    );
  }
}

/// What the code and the points take off the order
double _saved(WidgetRef ref) {
  final promo = ref.watch(promoProvider);
  final points = ref.watch(loyaltyRedemptionProvider).serverDiscount ?? 0;
  return (promo.applied ? promo.discount : 0) + points;
}

class _Thumbs extends StatelessWidget {
  final TraySummary summary;

  const _Thumbs({required this.summary});

  @override
  Widget build(BuildContext context) {
    final c = context.theme.colors;
    // The newest at the front: drawn last, at the start
    final thumbs = summary.thumbs;
    const size = 44.0, overlap = 12.0;
    final width = size + (thumbs.length - 1) * (size - overlap);
    return SizedBox(
      width: width + (summary.more > 0 ? 6 : 0),
      height: size,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          for (var i = thumbs.length - 1; i >= 0; i--)
            PositionedDirectional(
              start: i * (size - overlap),
              // The ring, then the photo clipped to the circle inside it: clipped to the
              // outer circle, the photo's square corners would cover the ring
              child: TraySeat(
                kind: SeatKind.dock,
                item: thumbs[i],
                index: i,
                child: Container(
                  width: size,
                  height: size,
                  padding: const EdgeInsets.all(2),
                  decoration: BoxDecoration(shape: BoxShape.circle, color: c.background),
                  child: ClipOval(
                    child: ColoredBox(
                      color: c.foreground.withValues(alpha: 0.15),
                      child: SizedBox.expand(child: DishPhoto(url: thumbs[i].pictureUri)),
                    ),
                  ),
                ),
              ),
            ),
          if (summary.more > 0)
            PositionedDirectional(
              end: -2,
              bottom: -4,
              child: Container(
                constraints: const BoxConstraints(minWidth: 20),
                height: 20,
                padding: const EdgeInsets.symmetric(horizontal: 4),
                alignment: Alignment.center,
                decoration: ShapeDecoration(
                  color: context.theme.colors.primary,
                  shape: StadiumBorder(side: BorderSide(color: c.background, width: 2)),
                ),
                child: Text(
                  '+${summary.more}',
                  style: context.theme.typography.micro.copyWith(color: context.theme.colors.primaryForeground, fontWeight: FontWeight.w700),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// A dish's photo filling its box, or a quiet fill where there is none
class DishPhoto extends StatelessWidget {
  final String? url;

  const DishPhoto({super.key, this.url});

  @override
  Widget build(BuildContext context) {
    final muted = context.theme.colors.foreground.withValues(alpha: 0.12);
    final blank = ColoredBox(
      color: muted,
      child: Icon(LucideIcons.utensils, size: 16, color: context.theme.colors.foreground.withValues(alpha: 0.5)),
    );
    if (url == null) return blank;
    return CachedNetworkImage(
      imageUrl: url!,
      fit: BoxFit.cover,
      placeholder: (_, _) => ColoredBox(color: muted),
      errorWidget: (_, _, _) => blank,
    );
  }
}

/// The dock's way to the order, where the thumb is. Shut, it opens the order
/// to look over; open, the same button places it, so nothing is sent unseen.
class OrderButton extends ConsumerWidget {
  final TrayMotion motion;

  const OrderButton({super.key, required this.motion});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final theme = context.theme;
    final c = theme.colors;
    final busy = ref.watch(checkoutProvider.select((s) => s.isLoading));
    // A delivery waits for its address, the branch's yes and the minimum: the open tray says which
    final held = ref.watch(deliveryStateProvider.select((d) => d.active && !d.ready));
    return ListenableBuilder(
      listenable: motion,
      builder: (context, _) {
        final open = motion.expanded;
        final state = busy
            ? 'busy'
            : open
            ? 'place'
            : 'order';
        final ink = c.primaryForeground;
        final label = context.localeText(theme.typography.body.copyWith(color: ink, fontWeight: FontWeight.w700));
        return Pressable(
          onTap: busy || (open && held)
              ? null
              : open
              ? () async {
                  HapticFeedback.mediumImpact();
                  final placed = await placeTrayOrder(context, ref);
                  if (placed) motion.setExpanded(false);
                }
              : () => motion.setExpanded(true),
          child: AnimatedSize(
            duration: Motion.base,
            curve: Motion.enter,
            child: AnimatedOpacity(
              duration: Motion.base,
              opacity: open && held ? 0.45 : 1,
              child: Container(
              height: 48,
              padding: const EdgeInsets.symmetric(horizontal: 20),
              alignment: Alignment.center,
              decoration: ShapeDecoration(color: c.primary, shape: const StadiumBorder(), shadows: Ninja.ctaShadow),
              child: BlurSwap(
                alignment: Alignment.center,
                child: Row(
                  key: ValueKey(state),
                  mainAxisSize: MainAxisSize.min,
                  children: switch (state) {
                    'busy' => [
                      SizedBox.square(dimension: 16, child: CircularProgressIndicator(strokeWidth: 2, color: ink)),
                      const SizedBox(width: 8),
                      Text(l10n.ninjaSending, style: label),
                    ],
                    'place' => [Icon(LucideIcons.check, size: 16, color: ink), const SizedBox(width: 8), Text(l10n.placeOrder, style: label)],
                    _ => [Text(l10n.ninjaOrder, style: label)],
                  },
                ),
              ),
            ),
            ),
          ),
        );
      },
    );
  }
}

/// The order, open: its lines, the one suggestion, the note, the code and
/// the points, and where it goes. Set in the slab's inks.
class TraySheet extends ConsumerWidget {
  const TraySheet({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final theme = context.theme;
    final c = theme.colors;
    final cart = ref.watch(cartProvider);
    final canOrder = ref.watch(branchProvider).selectedBranch?.isOrderingEnabled ?? true;
    final destination = ref.watch(orderDestinationProvider);

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(padding: const EdgeInsets.fromLTRB(20, 0, 20, 8), child: BrandHeadingText(l10n.ninjaYourOrder)),
        Flexible(
          child: SingleChildScrollView(
            // Its edges say which rows the open order shows, and so which circles fly to them
            key: traySeats.list,
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (final (i, item) in cart.items.indexed) _SwipeLine(key: ObjectKey(item), item: item, index: i),
                // What goes well with what is in it: one suggestion, waved away or added in a tap
                if (canOrder) const CartNudge(),
                const SizedBox(height: 12),
                const Padding(padding: EdgeInsets.symmetric(horizontal: 8), child: TrayExtras()),
                // Where the order goes, or why it cannot go now
                if (!canOrder)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(8, 12, 8, 0),
                    child: Row(
                      children: [
                        Icon(LucideIcons.circlePause, size: 16, color: NinjaColors.warning),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            l10n.orderingUnavailable,
                            style: context.localeText(theme.typography.note.copyWith(color: c.foreground.withValues(alpha: 0.8))),
                          ),
                        ),
                      ],
                    ),
                  )
                // Not at a table: collect it or have it brought, where the branch delivers
                else if (destination == null && ref.watch(deliveryStateProvider.select((d) => d.offered)))
                  const Padding(padding: EdgeInsets.fromLTRB(8, 12, 8, 0), child: DeliveryChoiceView())
                else if (destination != null)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(8, 12, 8, 0),
                    child: Row(
                      children: [
                        Icon(destination.placeKind.icon, size: 16, color: c.foreground.withValues(alpha: 0.7)),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            destination.name.localized(context),
                            style: context.localeText(theme.typography.note.copyWith(color: c.foreground.withValues(alpha: 0.7))),
                          ),
                        ),
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

/// A heading set as the style sets headings, the size of a sheet's title
class BrandHeadingText extends StatelessWidget {
  final String text;

  const BrandHeadingText(this.text, {super.key});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final size = theme.typography.headline.fontSize ?? 20;
    return Text(
      text,
      style: context.localeText(theme.typography.headline.copyWith(fontWeight: FontWeight.w800, letterSpacing: -0.02 * size, color: theme.colors.foreground)),
    );
  }
}

/// One line of the order: swipe it either way to take it off, or step it up
/// and down. Gone with a flick is easy to regret: the island puts it back.
class _SwipeLine extends ConsumerWidget {
  final CartItem item;
  final int index;

  const _SwipeLine({super.key, required this.item, required this.index});

  void _removed(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final name = item.productName.getText(ref.read(localeProvider));
    ref.read(cartProvider.notifier).removeItem(index);
    showIsland(
      title: Text(l10n.ninjaRemoved(name)),
      icon: const Icon(LucideIcons.trash2),
      actionLabel: l10n.ninjaUndo,
      onAction: () => ref.read(cartProvider.notifier).addItem(item),
      duration: const Duration(seconds: 5),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final theme = context.theme;
    final c = theme.colors;
    final locale = ref.watch(localeProvider);
    final money = ref.watch(moneyProvider);
    final options = item.selectedCustomizations.map((s) => s.optionName.getText(locale)).join('، ');
    final bin = Icon(LucideIcons.trash2, size: 20, color: c.destructiveForeground);

    return Padding(
      padding: const EdgeInsets.only(bottom: 2),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Dismissible(
          key: ObjectKey(item),
          dismissThresholds: const {DismissDirection.horizontal: swipeRemoveShare},
          resizeDuration: const Duration(milliseconds: 240),
          background: Container(
            color: c.destructive,
            padding: const EdgeInsets.symmetric(horizontal: 20),
            alignment: AlignmentDirectional.centerStart,
            child: bin,
          ),
          secondaryBackground: Container(
            color: c.destructive,
            padding: const EdgeInsets.symmetric(horizontal: 20),
            alignment: AlignmentDirectional.centerEnd,
            child: bin,
          ),
          onDismissed: (_) => _removed(context, ref),
          child: ColoredBox(
            color: c.background,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
              child: Row(
                children: [
                  // Where its circle from the dock lands as the order opens
                  TraySeat(
                    kind: SeatKind.row,
                    item: item,
                    index: index,
                    child: ClipOval(
                      child: Container(
                        width: 48,
                        height: 48,
                        color: c.foreground.withValues(alpha: 0.10),
                        child: DishPhoto(url: item.pictureUri),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item.productName.getText(locale),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: context.localeText(theme.typography.note.copyWith(fontWeight: FontWeight.w600, color: c.foreground)),
                        ),
                        if (options.isNotEmpty)
                          Text(
                            options,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: context.localeText(theme.typography.caption.copyWith(color: c.foreground.withValues(alpha: 0.6))),
                          ),
                        if (item.specialInstructions != null)
                          Text(
                            '"${item.specialInstructions}"',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: context.localeText(
                              theme.typography.caption.copyWith(fontStyle: FontStyle.italic, color: c.foreground.withValues(alpha: 0.6)),
                            ),
                          ),
                        Text(
                          money(item.totalPrice),
                          style: context.localeText(
                            theme.typography.note.copyWith(fontWeight: FontWeight.w700, color: c.foreground, fontFeatures: NinjaTypography.tabular),
                          ),
                        ),
                      ],
                    ),
                  ),
                  _Step(
                    icon: item.quantity == 1 ? LucideIcons.trash2 : LucideIcons.minus,
                    label: item.quantity == 1 ? l10n.ninjaRemove : l10n.ninjaLess,
                    onTap: () => item.quantity == 1 ? _removed(context, ref) : ref.read(cartProvider.notifier).updateQuantity(index, item.quantity - 1),
                  ),
                  SizedBox(
                    width: 24,
                    child: Text(
                      '${item.quantity}',
                      textAlign: TextAlign.center,
                      style: theme.typography.note.copyWith(fontWeight: FontWeight.w700, color: c.foreground, fontFeatures: NinjaTypography.tabular),
                    ),
                  ),
                  _Step(icon: LucideIcons.plus, label: l10n.ninjaMore, onTap: () => ref.read(cartProvider.notifier).updateQuantity(index, item.quantity + 1)),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Step extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _Step({required this.icon, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final ink = context.theme.colors.foreground;
    return Pressable(
      onTap: onTap,
      scale: 0.9,
      semanticLabel: label,
      child: Container(
        width: 32,
        height: 32,
        decoration: BoxDecoration(color: ink.withValues(alpha: 0.10), shape: BoxShape.circle),
        child: Icon(icon, size: 14, color: ink),
      ),
    );
  }
}

/// Watches the order's lines while the tray is open: an order emptied
/// closes it, and a fresh order puts the old code and points away
void trayKeepsOrder(WidgetRef ref, TrayMotion motion) {
  ref.listen<double>(cartTotalProvider, (_, total) => ref.read(promoProvider.notifier).requote(total));
  ref.listen(cartProvider, (before, cart) {
    if (cart.isEmpty && motion.expanded) motion.setExpanded(false);
  });
}

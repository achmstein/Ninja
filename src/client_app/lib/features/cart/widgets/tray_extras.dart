import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/brand/brand_provider.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme_provider.dart';
import '../../../core/ui/ui.dart';
import '../../../core/widgets/app_text.dart';
import '../../../l10n/app_localizations.dart';
import '../../profile/providers/loyalty_provider.dart';
import '../services/cart_service.dart';
import '../services/checkout_flow.dart';
import '../services/promo_service.dart';

/// Points go on and off the order in steps of this many
const pointsStep = 50;

const _emerald = NinjaColors.successOnSlab;
final _emeraldFill = NinjaColors.successSolid.withValues(alpha: 0.2);
const _redInk = NinjaColors.errorOnSlab;

enum _Open { note, promo, points }

/// The extras of an order, quiet until wanted (client_web's tray-extras.tsx):
/// a row of small pills in the tray's own colours (a note, a code, points),
/// each saying what it holds once set. A tap opens only that one's field
/// under the row, and a tap again (or on another) closes it.
class TrayExtras extends ConsumerStatefulWidget {
  const TrayExtras({super.key});

  @override
  ConsumerState<TrayExtras> createState() => _TrayExtrasState();
}

class _TrayExtrasState extends ConsumerState<TrayExtras> {
  _Open? _open;
  final _note = TextEditingController();
  final _promo = TextEditingController();

  @override
  void initState() {
    super.initState();
    _note.text = ref.read(orderNoteProvider);
  }

  @override
  void dispose() {
    _note.dispose();
    _promo.dispose();
    super.dispose();
  }

  void _toggle(_Open which) => setState(() => _open = _open == which ? null : which);

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final note = ref.watch(orderNoteProvider).trim();
    final promo = ref.watch(promoProvider);
    final subtotal = ref.watch(cartTotalProvider);
    final redemption = ref.watch(loyaltyRedemptionProvider);
    final loyalty = ref.watch(featuresProvider).loyalty ? ref.watch(loyaltyProvider).loyaltyInfo : null;
    final maxPoints = loyalty == null ? 0 : ref.read(loyaltyProvider.notifier).getMaxRedeemablePoints(subtotal);
    final pointsOffered = !redemption.loyaltyError && maxPoints > 0;
    final pointsOn = (redemption.serverDiscount ?? 0) > 0;

    // Opened: the note's field follows what is typed into the order's note
    ref.listen(orderNoteProvider, (_, next) {
      if (next != _note.text) _note.text = next;
    });

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            _Pill(
              icon: LucideIcons.notebookPen,
              on: _open == _Open.note,
              set: note.isNotEmpty,
              onTap: () => _toggle(_Open.note),
              child: note.isNotEmpty
                  ? ConstrainedBox(constraints: const BoxConstraints(maxWidth: 112), child: Text(note, overflow: TextOverflow.ellipsis))
                  : Text(l10n.ninjaAddNote),
            ),
            _Pill(
              icon: LucideIcons.tag,
              on: _open == _Open.promo,
              set: promo.applied,
              onTap: () => _toggle(_Open.promo),
              child: promo.code != null
                  ? Text(promo.code!, style: TextStyle(letterSpacing: 0.6, color: promo.reason != null ? _redInk : null))
                  : Text(l10n.promoCode),
            ),
            if (pointsOffered)
              _Pill(
                icon: LucideIcons.award,
                on: _open == _Open.points,
                set: pointsOn,
                onTap: () => _toggle(_Open.points),
                child: Text(pointsOn ? '${redemption.pointsToRedeem} ${l10n.pts}' : l10n.useLoyaltyPoints),
              ),
          ],
        ),
        // One panel: moving to another pill swaps what is in it rather than closing and opening again
        AnimatedSize(
          duration: Motion.slow,
          curve: Motion.enter,
          alignment: Alignment.topCenter,
          child: _open == null
              ? const SizedBox(width: double.infinity)
              : Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: BlurSwap(
                    duration: const Duration(milliseconds: 140),
                    child: KeyedSubtree(
                      key: ValueKey(_open),
                      child: switch (_open!) {
                        _Open.note => _NoteField(controller: _note),
                        _Open.promo => _PromoField(controller: _promo, onDone: () => setState(() => _open = null)),
                        _Open.points => _PointsField(max: maxPoints, balance: loyalty?.pointsBalance ?? 0),
                      },
                    ),
                  ),
                ),
        ),
        // Why a code does not apply, whether its field is open or not
        if (promo.code != null && promo.reason != null)
          Padding(
            padding: const EdgeInsetsDirectional.only(start: 4, top: 8),
            child: AppText(_promoReason(l10n, promo.reason!), style: context.theme.typography.caption.copyWith(color: _redInk)),
          ),
      ],
    );
  }
}

String _promoReason(AppLocalizations l10n, String reason) => switch (reason) {
      'NotFound' => l10n.promoNotFound,
      'UsedUp' => l10n.promoUsedUp,
      'AlreadyUsed' => l10n.promoAlreadyUsed,
      'BelowMinimum' => l10n.promoBelowMinimum,
      _ => l10n.promoNotValidNow,
    };

class _Pill extends StatelessWidget {
  final IconData icon;

  /// Its field is open
  final bool on;

  /// It holds something that goes with the order
  final bool set;
  final VoidCallback onTap;
  final Widget child;

  const _Pill({required this.icon, required this.on, required this.set, required this.onTap, required this.child});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final ink = theme.colors.foreground;
    final fill = set ? _emeraldFill : ink.withValues(alpha: on ? 0.20 : 0.10);
    final text = set ? _emerald : ink.withValues(alpha: on ? 1 : 0.8);
    return Pressable(
      onTap: onTap,
      scale: 0.96,
      child: AnimatedContainer(
        duration: Motion.base,
        height: 36,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: ShapeDecoration(color: fill, shape: const StadiumBorder()),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: text),
            const SizedBox(width: 6),
            DefaultTextStyle.merge(
              style: context.localeText(theme.typography.caption.copyWith(color: text, fontWeight: FontWeight.w600)),
              maxLines: 1,
              child: child,
            ),
          ],
        ),
      ),
    );
  }
}

BoxDecoration _well(BuildContext context) =>
    BoxDecoration(color: context.theme.colors.foreground.withValues(alpha: 0.10), borderRadius: BorderRadius.circular(16));

class _NoteField extends ConsumerWidget {
  final TextEditingController controller;

  const _NoteField({required this.controller});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.theme.colors;
    return Container(
      decoration: _well(context),
      child: TextField(
        controller: controller,
        autofocus: true,
        minLines: 2,
        maxLines: 4,
        onChanged: (value) => ref.read(orderNoteProvider.notifier).set(value),
        style: context.localeText(TextStyle(fontSize: 16, color: c.foreground)),
        cursorColor: c.foreground,
        decoration: InputDecoration(
          hintText: AppLocalizations.of(context)!.orderNoteOptional,
          hintStyle: context.localeText(TextStyle(fontSize: 16, color: c.foreground.withValues(alpha: 0.5))),
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        ),
      ),
    );
  }
}

/// The code, typed and applied in one line; applied, the pill carries it and here it can be taken off
class _PromoField extends ConsumerStatefulWidget {
  final TextEditingController controller;
  final VoidCallback onDone;

  const _PromoField({required this.controller, required this.onDone});

  @override
  ConsumerState<_PromoField> createState() => _PromoFieldState();
}

class _PromoFieldState extends ConsumerState<_PromoField> {
  void _apply() {
    final typed = widget.controller.text.trim().toUpperCase();
    if (typed.isEmpty) return;
    FocusScope.of(context).unfocus();
    ref.read(promoProvider.notifier).apply(typed, ref.read(cartTotalProvider));
    widget.onDone();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final theme = context.theme;
    final c = theme.colors;
    final promo = ref.watch(promoProvider);
    if (promo.code != null) {
      return Container(
        padding: const EdgeInsetsDirectional.fromSTEB(16, 6, 8, 6),
        decoration: _well(context),
        child: Row(
          children: [
            Expanded(
              child: Text(promo.code!, style: theme.typography.note.copyWith(fontWeight: FontWeight.w700, letterSpacing: 0.6, color: c.foreground)),
            ),
            if (promo.checking)
              SizedBox.square(dimension: 16, child: CircularProgressIndicator(strokeWidth: 2, color: c.foreground.withValues(alpha: 0.6)))
            else
              _Round(
                icon: LucideIcons.x,
                label: l10n.removePromo,
                onTap: () {
                  ref.read(promoProvider.notifier).clear();
                  widget.controller.clear();
                },
              ),
          ],
        ),
      );
    }
    return Container(
      padding: const EdgeInsetsDirectional.fromSTEB(16, 6, 6, 6),
      decoration: _well(context),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: widget.controller,
              autofocus: true,
              textCapitalization: TextCapitalization.characters,
              autocorrect: false,
              onSubmitted: (_) => _apply(),
              onChanged: (_) => setState(() {}),
              style: context.localeText(TextStyle(fontSize: 16, color: c.foreground)),
              cursorColor: c.foreground,
              decoration: InputDecoration(
                hintText: l10n.promoCode,
                hintStyle: context.localeText(TextStyle(fontSize: 16, color: c.foreground.withValues(alpha: 0.5))),
                border: InputBorder.none,
                isDense: true,
              ),
            ),
          ),
          _InkPill(label: l10n.apply, onTap: widget.controller.text.trim().isEmpty ? null : _apply),
        ],
      ),
    );
  }
}

/// Points off the order, in steps: less and more either side of how many,
/// and a way to use as many as the order takes. None is the same as not using them.
class _PointsField extends ConsumerWidget {
  final int max;
  final int balance;

  const _PointsField({required this.max, required this.balance});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final theme = context.theme;
    final c = theme.colors;
    final count = ref.watch(loyaltyRedemptionProvider).pointsToRedeem;
    final redemption = ref.read(loyaltyRedemptionProvider.notifier);
    void set(int next) {
      final clamped = next.clamp(0, max);
      if (clamped == 0) {
        redemption.toggleUsePoints(false, max);
      } else {
        if (!ref.read(loyaltyRedemptionProvider).usePoints) redemption.toggleUsePoints(true, clamped);
        redemption.setPointsToRedeem(clamped);
      }
    }

    final all = count >= max;
    return Container(
      padding: const EdgeInsets.all(6),
      decoration: _well(context),
      child: Row(
        children: [
          _Round(icon: LucideIcons.minus, label: l10n.ninjaLess, onTap: count <= 0 ? null : () => set(count - pointsStep)),
          Expanded(
            child: Column(
              children: [
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    RollingNumber('$count', style: theme.typography.note.copyWith(fontWeight: FontWeight.w700, color: c.foreground)),
                    Text(' ${l10n.pts}', style: context.localeText(theme.typography.note.copyWith(fontWeight: FontWeight.w700, color: c.foreground))),
                  ],
                ),
                Text(
                  l10n.ninjaPointsOf('$balance'),
                  style: context.localeText(theme.typography.micro.copyWith(color: c.foreground.withValues(alpha: 0.6))),
                ),
              ],
            ),
          ),
          _Round(icon: LucideIcons.plus, label: l10n.ninjaMore, onTap: all ? null : () => set(count + pointsStep)),
          const SizedBox(width: 8),
          _InkPill(label: l10n.ninjaUseAllPoints, onTap: all ? null : () => set(max)),
        ],
      ),
    );
  }
}

class _Round extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  const _Round({required this.icon, required this.label, this.onTap});

  @override
  Widget build(BuildContext context) {
    final ink = context.theme.colors.foreground;
    return Pressable(
      onTap: onTap,
      scale: 0.92,
      semanticLabel: label,
      child: Opacity(
        opacity: onTap == null ? 0.3 : 1,
        child: Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(color: ink.withValues(alpha: 0.15), shape: BoxShape.circle),
          child: Icon(icon, size: 16, color: ink),
        ),
      ),
    );
  }
}

/// The ink's own pill: the slab's ink as the fill, the slab as the text
class _InkPill extends StatelessWidget {
  final String label;
  final VoidCallback? onTap;

  const _InkPill({required this.label, this.onTap});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final c = theme.colors;
    return Pressable(
      onTap: onTap,
      child: Opacity(
        opacity: onTap == null ? 0.4 : 1,
        child: Container(
          height: 36,
          padding: const EdgeInsets.symmetric(horizontal: 14),
          alignment: Alignment.center,
          decoration: ShapeDecoration(color: c.foreground, shape: const StadiumBorder()),
          child: Text(label, style: context.localeText(theme.typography.caption.copyWith(color: c.background, fontWeight: FontWeight.w700))),
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/models/localized_text.dart';
import '../../../core/models/money.dart';
import 'package:ninja_app_core/theme/app_theme.dart';
import 'package:ninja_app_core/theme/text_styles.dart';
import 'package:ninja_app_core/widgets/confirm_dialog.dart';
import '../../../core/widgets/pos_dialog.dart';
import '../../../core/widgets/pos_toast.dart';
import '../../../l10n/app_localizations.dart';
import '../../orders/models/order.dart';
import '../delivery_errors.dart';
import '../models/delivery_order.dart';
import '../providers/deliveries_provider.dart';
import 'delivery_details.dart';

/// One delivery: where it goes and what is in it, who has it, and the cash.
/// Reads the board live, so a rider's step lands while it is open.
Future<void> showDeliveryDialog(BuildContext context, int orderNumber) =>
    showPosDialog<void>(context, builder: (_) => DeliveryDialog(orderNumber: orderNumber));

/// The reasons a delivery could not be handed over, as the server keeps them
const failReasonCodes = ['NoAnswer', 'Refused', 'WrongAddress', 'Other'];

class DeliveryDialog extends ConsumerStatefulWidget {
  final int orderNumber;

  const DeliveryDialog({super.key, required this.orderNumber});

  @override
  ConsumerState<DeliveryDialog> createState() => _DeliveryDialogState();
}

class _DeliveryDialogState extends ConsumerState<DeliveryDialog> {
  bool _busy = false;

  /// One move through [DeliveryActions], with the buttons held while it runs
  /// and the reason said (in the till's language) when it does not go through
  Future<void> _run(Future<void> Function(DeliveryActions actions) move, {String? done, bool close = false}) async {
    final l10n = AppLocalizations.of(context)!;
    setState(() => _busy = true);
    try {
      await move(ref.read(deliveryActionsProvider));
      if (!mounted) return;
      if (done != null) showPosToast(context, PosToastType.success, done);
      if (close) Navigator.of(context, rootNavigator: true).pop();
    } catch (e) {
      if (mounted) showPosToast(context, PosToastType.error, describeDeliveryError(e, l10n));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _delivered(DeliveryOrder order) async {
    final l10n = AppLocalizations.of(context)!;
    // Saying it arrived is what lets the cash in: asked once
    final yes = await showConfirmDialog(
      context,
      title: l10n.deliveryDeliveredConfirm(_name(l10n, order)),
      description: money(context, order.total),
      cancelLabel: l10n.cancel,
      actionLabel: l10n.deliveryMarkDelivered,
    );
    if (yes && mounted) await _run((a) => a.markDelivered(order.orderNumber));
  }

  Future<void> _failed(DeliveryOrder order) async {
    final reason = await showFailReasonPicker(context);
    if (reason != null && mounted) await _run((a) => a.markFailed(order.orderNumber, reason));
  }

  Future<void> _cancelReturned(DeliveryOrder order) async {
    final l10n = AppLocalizations.of(context)!;
    final yes = await showConfirmDialog(
      context,
      title: l10n.deliveryCancelReturnedConfirm,
      cancelLabel: l10n.cancel,
      actionLabel: l10n.deliveryCancelReturned,
      destructive: true,
    );
    if (yes && mounted) await _run((a) => a.cancelReturned(order.orderNumber), close: true);
  }

  Future<void> _cashIn(DeliveryOrder order) async {
    final l10n = AppLocalizations.of(context)!;
    final amount = await showCashInDialog(context, order: order);
    if (amount != null && mounted) {
      await _run((a) => a.cashIn(order.orderNumber, amount), done: l10n.deliveryCashTaken, close: true);
    }
  }

  static String _name(AppLocalizations l10n, DeliveryOrder order) => (order.customerName ?? '').isEmpty ? l10n.guest : order.customerName!;

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final order = (ref.watch(deliveriesProvider).value ?? const <DeliveryOrder>[])
        .where((d) => d.orderNumber == widget.orderNumber)
        .firstOrNull;
    // Settled (or gone from the board) while open: nothing left to do here
    if (order == null) {
      return DialogScroll(child: Center(child: Text(l10n.orderNumber(widget.orderNumber), style: theme.typography.lg)));
    }
    final lane = order.lane;
    final d = order.delivery;
    final out = order.isOut;
    final choosing = lane == DeliveryLane.waiting || (lane == DeliveryLane.withRider && !out);
    final id = order.orderNumber;
    final rider = d.riderName ?? '';

    Widget action(String label, IconData icon, VoidCallback onPress, {bool primary = false, bool destructive = false}) => Padding(
          padding: const EdgeInsets.only(top: 8),
          child: SizedBox(
            height: primary ? 52 : 48,
            child: FButton(
              variant: primary ? null : destructive ? FButtonVariant.ghost : FButtonVariant.outline,
              onPress: _busy ? null : onPress,
              prefix: Icon(icon, size: primary ? 20 : 16, color: destructive ? theme.colors.destructive : null),
              child: Text(label,
                  style: theme.typography.base.forButton.copyWith(color: destructive ? theme.colors.destructive : null)),
            ),
          ),
        );

    return DialogScroll(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(l10n.orderNumber(id), style: theme.typography.xl.copyWith(fontWeight: FontWeight.w700)),
          const SizedBox(height: 2),
          Text('${_name(l10n, order)} · ${money(context, order.total)}',
              style: theme.typography.base.copyWith(color: theme.colors.mutedForeground)),
          const SizedBox(height: 16),
          DeliveryDetails(delivery: d),
          const SizedBox(height: 12),
          // The count and the name apart, so an English dish name in Arabic still reads count first
          for (final item in order.items)
            Padding(
              padding: const EdgeInsets.only(bottom: 2),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('${item.units}×', style: theme.typography.sm.copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      [item.name.localized(context), if (item.options != null) item.options!.localized(context)].join(' · '),
                      style: theme.typography.sm,
                    ),
                  ),
                ],
              ),
            ),
          if (choosing) ...[
            const SizedBox(height: 16),
            Text(l10n.deliveryGiveTo, style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground)),
            const SizedBox(height: 8),
            RiderPicker(
              currentRiderId: d.riderUserId,
              busy: _busy,
              onPick: (picked) => _run((a) => a.assign(id, picked)),
            ),
            if (lane == DeliveryLane.withRider) action(l10n.deliveryTakeBack, FIcons.x, () => _run((a) => a.takeBack(id))),
          ],
          // For a rider whose phone cannot say it (a flat battery, no app):
          // the till says it left, then that it arrived (or did not)
          if (lane == DeliveryLane.withRider) ...[
            const SizedBox(height: 16),
            Container(height: 1, color: theme.colors.border),
            const SizedBox(height: 12),
            Text(l10n.deliveryForRider(rider), style: theme.typography.xs.copyWith(color: theme.colors.mutedForeground)),
            if (out) ...[
              action(l10n.deliveryMarkDelivered, FIcons.check, () => _delivered(order)),
              action(l10n.deliveryMarkFailed, FIcons.undo2, () => _failed(order), destructive: true),
            ] else
              action(l10n.deliveryMarkOut, FIcons.bike, () => _run((a) => a.markOut(id))),
          ],
          // The rider is bringing the bag back: the till says when it is in
          if (lane == DeliveryLane.failed) action(l10n.deliveryMarkReturned, FIcons.packageCheck, () => _run((a) => a.markReturned(id)), primary: true),
          // Back at the branch: nobody will have it, the order is called off
          if (lane == DeliveryLane.returned) action(l10n.deliveryCancelReturned, FIcons.ban, () => _cancelReturned(order), destructive: true),
          if (lane == DeliveryLane.cashDue) ...[
            const SizedBox(height: 8),
            action(l10n.deliveryTakeCash(money(context, order.total), rider), FIcons.banknote, () => _cashIn(order), primary: true),
          ],
        ],
      ),
    );
  }
}

/// Why it could not be handed over: one button per reason. Resolves to the code, or null
Future<String?> showFailReasonPicker(BuildContext context) {
  final l10n = AppLocalizations.of(context)!;
  return showPosDialog<String>(
    context,
    builder: (dialogContext) {
      final theme = dialogContext.theme;
      return DialogScroll(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(l10n.deliveryFailReasonTitle, style: theme.typography.xl.copyWith(fontWeight: FontWeight.w600)),
            const SizedBox(height: 12),
            for (final code in failReasonCodes)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: SizedBox(
                  height: 48,
                  child: FButton(
                    variant: FButtonVariant.outline,
                    onPress: () => Navigator.of(dialogContext, rootNavigator: true).pop(code),
                    child: Text(failReasonLabel(l10n, code), style: theme.typography.base.forButton),
                  ),
                ),
              ),
          ],
        ),
      );
    },
  );
}

/// What the till counted in from the rider, prefilled with the bill; the
/// difference is said before it is taken. Resolves to the amount, or null.
Future<double?> showCashInDialog(BuildContext context, {required DeliveryOrder order}) =>
    showPosDialog<double>(context, builder: (_) => CashInDialog(order: order));

class CashInDialog extends StatefulWidget {
  final DeliveryOrder order;

  const CashInDialog({super.key, required this.order});

  @override
  State<CashInDialog> createState() => _CashInDialogState();
}

class _CashInDialogState extends State<CashInDialog> {
  late final TextEditingController _amount = TextEditingController(text: widget.order.total.toStringAsFixed(2));

  @override
  void dispose() {
    _amount.dispose();
    super.dispose();
  }

  double? get _counted => double.tryParse(_amount.text.trim().replaceAll(',', '.'));

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final counted = _counted;
    final difference = counted == null ? null : counted - widget.order.total;
    final rider = widget.order.delivery.riderName ?? '';
    final (note, color) = switch (difference) {
      null => (l10n.deliveryCashInvalid, theme.colors.destructive),
      final d when d.abs() < 0.005 => (l10n.deliveryCashExact, AppColors.emerald(theme.colors.brightness)),
      final d when d < 0 => (l10n.deliveryCashShort(money(context, -d)), AppColors.amber(theme.colors.brightness)),
      final d => (l10n.deliveryCashOver(money(context, d)), AppColors.amber(theme.colors.brightness)),
    };

    return DialogScroll(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(l10n.deliveryCashCountTitle(rider), style: theme.typography.xl.copyWith(fontWeight: FontWeight.w600)),
          const SizedBox(height: 4),
          Text(l10n.deliveryCashBill(money(context, widget.order.total)),
              style: theme.typography.base.copyWith(color: theme.colors.mutedForeground)),
          const SizedBox(height: 16),
          FTextField(
            control: FTextFieldControl.managed(controller: _amount, onChange: (_) => setState(() {})),
            label: Text(l10n.deliveryCashCounted),
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]'))],
          ),
          const SizedBox(height: 8),
          // Said in words, never colour alone
          Text(note, style: theme.typography.sm.copyWith(fontWeight: FontWeight.w600, color: color)),
          const SizedBox(height: 16),
          SizedBox(
            height: 52,
            child: FButton(
              onPress: counted == null || counted < 0 ? null : () => Navigator.of(context, rootNavigator: true).pop(counted),
              prefix: const Icon(FIcons.banknote, size: 20),
              child: Text(l10n.deliveryCashTakeAction, style: theme.typography.base.forButton),
            ),
          ),
        ],
      ),
    );
  }
}

/// The branch's riders, as Ordering lists them: on duty first, then those
/// who have not opened the rider app yet; the one that has it is ticked
class RiderPicker extends ConsumerWidget {
  final String? currentRiderId;
  final bool busy;
  final void Function(TillRider rider) onPick;

  const RiderPicker({super.key, required this.currentRiderId, required this.busy, required this.onPick});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final riders = ref.watch(tillRidersProvider);
    return riders.when(
      loading: () => const SizedBox(height: 56, child: Center(child: FCircularProgress())),
      error: (e, _) => Text(describeDeliveryError(e, l10n), style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground)),
      data: (riders) {
        if (riders.isEmpty) {
          return Text(l10n.deliveryNoRiders, style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground));
        }
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (final rider in riders)
              Padding(
                key: ValueKey(rider.userId),
                padding: const EdgeInsets.only(bottom: 8),
                child: _RiderRow(
                  rider: rider,
                  current: rider.userId == currentRiderId,
                  disabled: busy,
                  onTap: () => onPick(rider),
                  status: !rider.signedIn
                      ? l10n.riderNotSignedIn
                      : rider.onDuty
                          ? (rider.out > 0 ? l10n.riderOut(rider.out) : l10n.riderFree)
                          : l10n.riderOffDuty,
                ),
              ),
          ],
        );
      },
    );
  }
}

class _RiderRow extends StatelessWidget {
  final TillRider rider;
  final bool current;
  final bool disabled;
  final String status;
  final VoidCallback onTap;

  const _RiderRow({required this.rider, required this.current, required this.disabled, required this.status, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final dot = rider.onDuty ? AppColors.emerald500 : theme.colors.mutedForeground;
    // Off duty reads in the status line and a grey dot, not in a faded row
    return Semantics(
      button: true,
      selected: current,
      enabled: !(disabled || current),
      label: '${rider.name}, $status',
      excludeSemantics: true,
      child: InkWell(
        onTap: disabled || current ? null : onTap,
        borderRadius: BorderRadius.circular(10),
        child: Container(
          height: 56,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            color: current ? theme.colors.primary.withValues(alpha: 0.05) : null,
            border: Border.all(color: current ? theme.colors.primary : theme.colors.border),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Row(
            children: [
              Stack(
                clipBehavior: Clip.none,
                children: [
                  const Icon(FIcons.userRound, size: 20),
                  PositionedDirectional(
                    end: -2,
                    bottom: -2,
                    child: Container(
                      width: 10,
                      height: 10,
                      decoration: BoxDecoration(
                        color: dot,
                        shape: BoxShape.circle,
                        border: Border.all(color: theme.colors.background, width: 2),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(rider.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: theme.typography.base.copyWith(fontWeight: FontWeight.w500)),
                    Text(status, style: theme.typography.xs.copyWith(color: theme.colors.mutedForeground)),
                  ],
                ),
              ),
              if (current) Icon(FIcons.check, size: 20, color: theme.colors.primary),
            ],
          ),
        ),
      ),
    );
  }
}

/// The delivery a stage stands for, in words, for the board's cards
String stageText(AppLocalizations l10n, DeliveryOrder order) {
  final d = order.delivery;
  final rider = d.riderName ?? '';
  return switch (order.lane) {
    DeliveryLane.waiting => order.readyAt != null ? l10n.deliveryReadyNoRider : l10n.deliveryNoRider,
    DeliveryLane.cashDue => l10n.deliveryCashWith(rider),
    DeliveryLane.failed => l10n.deliveryComingBack(rider),
    DeliveryLane.returned => l10n.deliveryBackAtBranch,
    DeliveryLane.done => l10n.deliveryCashTaken,
    DeliveryLane.withRider => d.stage == DeliveryStage.onTheWay ? l10n.deliveryOnTheWayWith(rider) : l10n.deliveryWith(rider),
  };
}

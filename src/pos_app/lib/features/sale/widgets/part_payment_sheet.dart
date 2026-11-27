import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/theme/app_theme.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import 'package:uuid/uuid.dart';
import '../../../core/models/money.dart';
import '../../../core/network/api_errors.dart';
import '../../../core/printing/print_service.dart';
import '../../../core/utils/bidi.dart';
import '../../../core/widgets/numeric_keypad.dart';
import '../../../core/widgets/pos_dialog.dart';
import '../../../core/widgets/pos_toast.dart';
import '../../../l10n/app_localizations.dart';
import '../../shifts/providers/shifts_provider.dart';
import '../../ticket/tenders.dart';
import '../../tickets/models/enums.dart';
import '../../tickets/providers/tickets_provider.dart';
import '../../tickets/services/tickets_service.dart';
import '../bill_payers.dart';
import '../../../core/theme/type_roles.dart';

/// What is being paid apart from the rest of the bill: whose it is, which
/// lines, and what those come to. No lines and nothing owed is an amount on
/// account of the bill, from someone who had nothing of their own on it
typedef PartToPay = ({String? name, List<int> lineIds, double amount});

/// Takes one person's part of a bill. True once the money is taken; the bill
/// stays open for the rest either way
Future<bool> showPartPayment(
  BuildContext context, {
  required int ticketId,
  required String title,
  required PartToPay part,
  required double left,
  bool clockRunning = false,
}) async {
  final taken = await showPosDialog<bool>(
    context,
    builder: (context) =>
        PartPaymentSheet(ticketId: ticketId, title: title, part: part, left: left, clockRunning: clockRunning),
  );
  return taken ?? false;
}

/// Taking one person's part of a bill, the bill staying open for the rest.
/// The customer says what they pay: exactly what they had, or more, the rest
/// going on account of the bill (a player leaving a room pays towards its
/// time, and how much is theirs to say, never the till's to work out). The
/// amount on the sheet is the amount taken; it goes into this shift's drawer
/// at once. The body of a dialog, which it closes once the money is taken.
/// The web till's PartPaymentSheet is the same.
class PartPaymentSheet extends ConsumerStatefulWidget {
  final int ticketId;

  /// The bill's own name, said when the part is nobody's by name
  final String title;
  final PartToPay part;

  /// What is still to pay on the bill as it stands
  final double left;

  /// The room's clock is running: its time is not on the bill yet
  final bool clockRunning;

  const PartPaymentSheet({
    super.key,
    required this.ticketId,
    required this.title,
    required this.part,
    required this.left,
    this.clockRunning = false,
  });

  @override
  ConsumerState<PartPaymentSheet> createState() => _PartPaymentSheetState();
}

class _PartPaymentSheetState extends ConsumerState<PartPaymentSheet> {
  PaymentTender _tender = baseTenders.first;

  /// What they pay, as typed; empty is exactly what their items come to
  String _typed = '';

  /// An amount on account has nothing to start from: the keypad is what the hand is after
  late bool _keypad = widget.part.amount <= 0;
  bool _taking = false;

  // One request id per opening: a second press, or a retry on a poor line, takes the money once
  final String _requestId = const Uuid().v4();

  double get _items => widget.part.amount;

  double get _amount => _typed.isEmpty ? _items : ((double.tryParse(_typed) ?? 0) * 100).round() / 100;

  // Cash opens the drawer, as it does at the settle: the cashier makes
  // change. Quiet with no printer (the drawer kicks through it) or one that
  // cannot be reached
  Future<void> _openDrawer() async {
    try {
      final service = ref.read(printServiceProvider);
      if (service.isConfigured) await service.kickDrawer();
    } catch (_) {}
  }

  Future<void> _take() async {
    final l10n = AppLocalizations.of(context)!;
    final part = widget.part;
    final amount = _amount;
    final said = money(context, amount);
    setState(() => _taking = true);
    try {
      await ref.read(ticketsRepositoryProvider).takePartPayment(
            widget.ticketId,
            tender: _tender,
            amount: amount,
            payerName: part.name,
            lineIds: part.lineIds,
            requestId: _requestId,
          );
      if (_tender == PaymentTender.cash) _openDrawer();
      ref.invalidate(ticketProvider(widget.ticketId));
      ref.read(openTicketsProvider.notifier).refresh();
      // The drawer's expected cash just moved
      ref.read(currentShiftProvider.notifier).refresh();
      if (!mounted) return;
      showPosToast(context, PosToastType.success, l10n.partPaymentTaken(said));
      Navigator.of(context, rootNavigator: true).pop(true);
    } catch (e) {
      if (!mounted) return;
      showPosToast(context, PosToastType.error, describeError(e, l10n));
      setState(() => _taking = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    const tabular = [FontFeature.tabularFigures()];
    final muted = theme.type.detail.copyWith(color: theme.colors.mutedForeground);
    final emerald = AppColors.emerald(theme.colors.brightness);
    final items = _items;
    final onAccount = items <= 0;
    final amount = _amount;
    final extra = ((amount - items) * 100).round() / 100;
    final problem = partAmountProblem(amount, items, widget.left, clockRunning: widget.clockRunning);
    final sums = partAmounts(items);
    final name = widget.part.name ?? widget.title;

    // Four to a row whatever there are, so each is the same width
    Widget choice({required String label, required bool picked, required VoidCallback onPress}) => Expanded(
          child: SizedBox(
            height: Sizes.control,
            child: FButton(
              variant: picked ? null : FButtonVariant.outline,
              onPress: onPress,
              child: Flexible(
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Text(label, maxLines: 1, style: theme.type.button.copyWith(fontFeatures: tabular)),
                ),
              ),
            ),
          ),
        );

    return DialogScroll(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(onAccount ? l10n.partPayOnAccount : l10n.partPayTitle(bidiIsolate(name)),
              maxLines: 2, overflow: TextOverflow.ellipsis, style: theme.type.title),
          const SizedBox(height: 16),
          if (!onAccount) ...[
            Row(
              children: [
                Expanded(child: Text(l10n.partPayItems, style: muted)),
                Text(money(context, items),
                    style: theme.type.detail.copyWith(fontWeight: FontWeight.w500, fontFeatures: tabular)),
              ],
            ),
            const SizedBox(height: 12),
          ],
          Text(l10n.partPayPays, style: muted),
          Text(money(context, amount),
              style: theme.type.figure.copyWith(color: amount <= 0 ? theme.colors.mutedForeground : null)),
          const SizedBox(height: 12),
          // What they pay, one tap: exactly their own, a round sum, or any amount
          Row(
            children: [
              for (final sum in sums) ...[
                choice(
                  label: sum == items ? l10n.partPayExact : sum.toStringAsFixed(0),
                  picked: !_keypad && amount == sum,
                  onPress: () => setState(() {
                    _keypad = false;
                    _typed = sum == sum.roundToDouble() ? sum.toStringAsFixed(0) : sum.toString();
                  }),
                ),
                const SizedBox(width: 8),
              ],
              choice(
                label: l10n.partPayOther,
                picked: _keypad,
                onPress: () => setState(() {
                  _keypad = true;
                  _typed = '';
                }),
              ),
            ],
          ),
          if (_keypad) ...[
            const SizedBox(height: 12),
            NumericKeypad(value: _typed, onChange: (value) => setState(() => _typed = value)),
          ],
          // Said before the tap: what is theirs, and what goes towards the rest of the bill
          if (problem == PartAmountProblem.none && !onAccount && extra > 0) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: emerald.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(Sizes.radius),
              ),
              child: Text(l10n.partPaySplit(money(context, items), money(context, extra)),
                  style: theme.type.detail.copyWith(color: emerald)),
            ),
          ],
          if (problem == PartAmountProblem.belowItems) ...[
            const SizedBox(height: 12),
            Text(l10n.partPayBelowItems(money(context, items)),
                style: theme.type.detail.copyWith(color: theme.colors.destructive)),
          ],
          if (problem == PartAmountProblem.paysAll) ...[
            const SizedBox(height: 12),
            Text(l10n.partPayPaysAll, style: theme.type.detail.copyWith(color: theme.colors.destructive)),
          ],
          const SizedBox(height: 16),
          // The ways of one choice, the same width
          Row(
            children: [
              for (final (index, tender) in baseTenders.indexed) ...[
                if (index > 0) const SizedBox(width: 8),
                Expanded(
                  child: Semantics(
                    inMutuallyExclusiveGroup: true,
                    checked: tender == _tender,
                    child: SizedBox(
                      height: Sizes.control,
                      child: FButton(
                        variant: tender == _tender ? null : FButtonVariant.outline,
                        onPress: () => setState(() => _tender = tender),
                        child: Flexible(
                          child: FittedBox(
                            fit: BoxFit.scaleDown,
                            child: Text(tenderLabel(l10n, tender), maxLines: 1, style: theme.type.button),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 16),
          Text(widget.clockRunning ? l10n.partPayHintClock : l10n.partPayHint, style: muted),
          const SizedBox(height: 16),
          SizedBox(
            height: Sizes.controlLarge,
            child: FButton(
              onPress: _taking || problem != PartAmountProblem.none ? null : _take,
              prefix: _taking
                  ? SizedBox.square(
                      dimension: Sizes.icon,
                      child: CircularProgressIndicator(strokeWidth: 2, color: theme.colors.primaryForeground),
                    )
                  : null,
              child: Expanded(
                child: Row(
                  children: [
                    Expanded(
                      child: Text(l10n.partPayTakeWith(tenderLabel(l10n, _tender)),
                          maxLines: 1, overflow: TextOverflow.ellipsis, style: theme.type.mainAction),
                    ),
                    const SizedBox(width: 8),
                    Text(money(context, amount), style: theme.type.mainAction.copyWith(fontFeatures: tabular)),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

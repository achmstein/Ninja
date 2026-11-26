import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import 'package:uuid/uuid.dart';
import '../../../core/models/money.dart';
import '../../../core/network/api_errors.dart';
import '../../../core/printing/print_service.dart';
import '../../../core/utils/bidi.dart';
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
/// lines, and what it comes to
typedef PartToPay = ({String? name, List<int> lineIds, double amount});

/// Takes one person's part of a bill. True once the money is taken; the bill
/// stays open for the rest either way
Future<bool> showPartPayment(
  BuildContext context, {
  required int ticketId,
  required String title,
  required PartToPay part,
}) async {
  final taken = await showPosDialog<bool>(
    context,
    builder: (context) => PartPaymentSheet(ticketId: ticketId, title: title, part: part),
  );
  return taken ?? false;
}

/// Taking one person's part of a bill, the bill staying open for the rest:
/// what they owe, how they pay it (cash, card or InstaPay; a tab is for the
/// bill's last payment), and for cash what they handed over, with the change.
/// The money is in this shift's drawer from this moment. The body of a
/// dialog, which it closes once the money is taken. The web till's
/// PartPaymentSheet is the same.
class PartPaymentSheet extends ConsumerStatefulWidget {
  final int ticketId;

  /// The bill's own name, said when the part is nobody's by name
  final String title;
  final PartToPay part;

  const PartPaymentSheet({super.key, required this.ticketId, required this.title, required this.part});

  @override
  ConsumerState<PartPaymentSheet> createState() => _PartPaymentSheetState();
}

class _PartPaymentSheetState extends ConsumerState<PartPaymentSheet> {
  PaymentTender _tender = baseTenders.first;

  /// Cash handed over, when it is more than what is owed: only for the change
  double? _received;
  bool _taking = false;

  // One request id per opening: a second press, or a retry on a poor line, takes the money once
  final String _requestId = const Uuid().v4();

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
    final amount = money(context, part.amount);
    setState(() => _taking = true);
    try {
      await ref.read(ticketsRepositoryProvider).takePartPayment(
            widget.ticketId,
            tender: _tender,
            amount: part.amount,
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
      showPosToast(context, PosToastType.success, l10n.partPaymentTaken(amount));
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
    final due = widget.part.amount;
    final notes = cashNotes(due);
    final handed = _received ?? due;
    final change = changeFor(handed, due);
    final name = widget.part.name ?? widget.title;

    return DialogScroll(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(l10n.partPayTitle(bidiIsolate(name)),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: theme.type.title),
          const SizedBox(height: 16),
          Text(l10n.partPayDue, style: muted),
          Text(money(context, due),
              style: theme.type.figure),
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
          if (_tender == PaymentTender.cash) ...[
            const SizedBox(height: 16),
            Text(l10n.partPayReceived, style: muted),
            const SizedBox(height: 8),
            // Four to a row whatever there are, so each is the same width
            Row(
              children: [
                for (var index = 0; index < 4; index++) ...[
                  if (index > 0) const SizedBox(width: 8),
                  Expanded(
                    child: index >= notes.length
                        ? const SizedBox.shrink()
                        : SizedBox(
                            height: Sizes.control,
                            child: FButton(
                              variant: handed == notes[index] ? null : FButtonVariant.outline,
                              onPress: () => setState(() => _received = notes[index]),
                              child: Flexible(
                                child: FittedBox(
                                  fit: BoxFit.scaleDown,
                                  child: Text(
                                    notes[index] == due ? l10n.partPayExact : notes[index].toStringAsFixed(0),
                                    maxLines: 1,
                                    style: theme.type.button.copyWith(fontFeatures: tabular),
                                  ),
                                ),
                              ),
                            ),
                          ),
                  ),
                ],
              ],
            ),
            if (change > 0) ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  Text('${l10n.changeDue}: ', style: theme.type.body),
                  Text(money(context, change),
                      style: theme.type.heading.copyWith(fontFeatures: tabular)),
                ],
              ),
            ],
          ],
          const SizedBox(height: 16),
          Text(l10n.partPayHint, style: muted),
          const SizedBox(height: 16),
          SizedBox(
            height: Sizes.controlLarge,
            child: FButton(
              onPress: _taking || due <= 0 ? null : _take,
              prefix: _taking
                  ? SizedBox.square(
                      dimension: Sizes.icon,
                      child: CircularProgressIndicator(strokeWidth: 2, color: theme.colors.primaryForeground),
                    )
                  : null,
              child: Text(l10n.partPayTake(money(context, due)), style: theme.type.mainAction),
            ),
          ),
        ],
      ),
    );
  }
}

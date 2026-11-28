import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import 'package:uuid/uuid.dart';
import '../../../core/models/money.dart';
import '../../../core/network/api_errors.dart';
import '../../../core/widgets/pos_dialog.dart';
import '../../../core/widgets/pos_toast.dart';
import '../../../l10n/app_localizations.dart';
import '../../shifts/providers/shifts_provider.dart';
import '../../tickets/models/enums.dart';
import '../../tickets/models/ticket_detail.dart';
import '../../tickets/providers/tickets_provider.dart';
import '../../tickets/services/tickets_service.dart';
import '../tenders.dart';
import '../../../core/theme/type_roles.dart';

/// A settled bill's payment recorded under the wrong tender — Cash typed
/// in when the customer paid by InstaPay — put right: the other two of
/// Cash, Card and InstaPay, one tap each. The server refuses once the
/// bill's shift has closed, and says why.
Future<bool?> showChangeTenderDialog(BuildContext context, TicketDetail ticket, PaymentView payment) {
  return showPosDialog<bool>(
    context,
    size: DialogSize.sm,
    builder: (context) => _ChangeTenderDialog(ticket: ticket, payment: payment),
  );
}

IconData tenderIcon(PaymentTender tender) => switch (tender) {
      PaymentTender.cash => FIcons.banknote,
      PaymentTender.card => FIcons.creditCard,
      PaymentTender.instaPay => FIcons.smartphone,
      _ => FIcons.wallet,
    };

class _ChangeTenderDialog extends ConsumerStatefulWidget {
  final TicketDetail ticket;
  final PaymentView payment;

  const _ChangeTenderDialog({required this.ticket, required this.payment});

  @override
  ConsumerState<_ChangeTenderDialog> createState() => _ChangeTenderDialogState();
}

class _ChangeTenderDialogState extends ConsumerState<_ChangeTenderDialog> {
  PaymentTender? _pending;

  Future<void> _choose(PaymentTender tender) async {
    if (_pending != null) return;
    final l10n = AppLocalizations.of(context)!;
    setState(() => _pending = tender);
    try {
      // A fresh id per attempt: a refused try is not replayed by the next
      await ref.read(ticketsRepositoryProvider).changePaymentTender(
            widget.ticket.id,
            widget.payment.id,
            tender,
            requestId: const Uuid().v4(),
          );
      ref.invalidate(ticketProvider(widget.ticket.id));
      // The drawer's expected cash moves with a Cash payment
      unawaited(ref.read(currentShiftProvider.notifier).refresh());
      if (!mounted) return;
      showPosToast(context, PosToastType.success, l10n.tenderChangedToast);
      Navigator.of(context, rootNavigator: true).pop(true);
    } catch (e) {
      if (!mounted) return;
      setState(() => _pending = null);
      showPosToast(context, PosToastType.error, describeError(e, l10n));
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final payment = widget.payment;
    final choices = [for (final t in baseTenders) if (t != payment.tender) t];

    return DialogScroll(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(l10n.changeTenderTitle, style: theme.type.title),
          const SizedBox(height: 4),
          Text(l10n.changeTenderHint(money(context, payment.amount), tenderLabel(l10n, payment.tender)),
              style: theme.type.body.copyWith(color: theme.colors.mutedForeground)),
          const SizedBox(height: 16),
          Row(
            children: [
              for (final (index, tender) in choices.indexed) ...[
                if (index > 0) const SizedBox(width: 8),
                Expanded(
                  child: SizedBox(
                    height: Sizes.control,
                    child: FButton(
                      variant: FButtonVariant.outline,
                      onPress: _pending != null ? null : () => _choose(tender),
                      prefix: _pending == tender
                          ? const SizedBox.square(dimension: Sizes.icon, child: CircularProgressIndicator(strokeWidth: 2))
                          : Icon(tenderIcon(tender), size: Sizes.icon),
                      child: Text(tenderLabel(l10n, tender), style: theme.type.button),
                    ),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              SizedBox(
                height: Sizes.control,
                child: FButton(
                  variant: FButtonVariant.outline,
                  mainAxisSize: MainAxisSize.min,
                  onPress: _pending != null ? null : () => Navigator.of(context, rootNavigator: true).pop(),
                  child: Text(l10n.cancel, style: theme.type.button),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:uuid/uuid.dart';
import '../../../core/models/localized_text.dart';
import '../../../core/network/api_errors.dart';
import '../../../core/theme/text_styles.dart';
import '../../../core/widgets/pos_toast.dart';
import '../../../core/widgets/pos_dialog.dart';
import '../widgets/bill_card.dart';
import '../../../l10n/app_localizations.dart';
import '../../places/providers/places_provider.dart';
import '../../sale/models/sale_line.dart';
import '../../sale/pending_ticket_customer.dart';
import '../../sale/widgets/customer_dialog.dart';
import '../../sale/widgets/customer_field.dart';
import '../../tickets/busy_customers.dart';
import '../../tickets/models/enums.dart';
import '../../tickets/models/open_ticket.dart';
import '../../tickets/providers/tickets_provider.dart';
import '../../tickets/services/tickets_service.dart';

/// Opens a counter tab: a bill with no place, for whoever it is for. The
/// customer is chosen exactly as on the sale pad — the same picker (search
/// by name or number, a walk-in's typed name, a new counter customer with
/// its duplicate check) and the same card once picked — so the round goes
/// on their tab. With nobody picked, the tab can still carry a name, or
/// none. Accounts that already have a bill running (on a tab, at a table,
/// in a room) show greyed out in the picker with the bill they are on, so
/// the cashier sees they exist but cannot open a second one: one person,
/// one bill.
///
/// Resolves to the new ticket's id; the caller goes there.
Future<int?> showNewTicketDialog(BuildContext context) {
  return showPosDialog<int>(
    context,
    builder: (context) => const _NewTicketDialog(),
  );
}

class _NewTicketDialog extends ConsumerStatefulWidget {
  const _NewTicketDialog();

  @override
  ConsumerState<_NewTicketDialog> createState() => _NewTicketDialogState();
}

class _NewTicketDialogState extends ConsumerState<_NewTicketDialog> {
  final _label = TextEditingController();
  bool _pending = false;
  final String _requestId = const Uuid().v4();

  // Who this tab is being opened for, once picked: an account, or a
  // walk-in's name from the picker
  SaleCustomer? _customer;

  @override
  void initState() {
    super.initState();
    _label.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _label.dispose();
    super.dispose();
  }

  Future<void> _chooseCustomer() async {
    final l10n = AppLocalizations.of(context)!;
    // Who already has a bill, and where, titled the way the floor titles it
    final busy = customersOnOpenBills(
      openTickets: ref.read(openTicketsProvider).value ?? const [],
      openStays: ref.read(placesProvider).openStays,
      pending: pendingTicketCustomer,
    ).map((id, place) => MapEntry(
          id,
          place.name?.localized(context).isNotEmpty == true
              ? place.name!.localized(context)
              : (place.label?.isNotEmpty == true ? place.label! : ticketTypeLabel(l10n, place.type)),
        ));
    final picked = await showCustomerDialog(context, busy: busy);
    if (picked == null || !mounted) return;
    setState(() => _customer = picked);
  }

  Future<void> _open() async {
    if (_pending) return;
    final l10n = AppLocalizations.of(context)!;
    setState(() => _pending = true);
    try {
      final label = _customer?.name ?? _label.text.trim();
      final ticketId = await ref.read(ticketsRepositoryProvider).openTicket(
            OpenTicketRequest(type: TicketType.counter, label: label.isEmpty ? null : label),
            requestId: _requestId,
          );
      // Client-side link: remember the account so the sale pad pre-selects it
      final picked = _customer;
      if (picked?.id != null && picked!.id!.isNotEmpty) {
        pendingTicketCustomer[ticketId] = picked;
      }
      ref.read(openTicketsProvider.notifier).refresh();
      if (!mounted) return;
      Navigator.of(context, rootNavigator: true).pop(ticketId);
    } catch (e) {
      if (!mounted) return;
      setState(() => _pending = false);
      showPosToast(context, PosToastType.error, describeError(e, l10n));
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final customer = _customer;

    return DialogScroll(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(l10n.newTab, style: theme.typography.xl.copyWith(fontWeight: FontWeight.w600)),
          const SizedBox(height: 20),
          if (customer != null)
            SelectedCustomerChip(customer: customer, onRemove: () => setState(() => _customer = null))
          else ...[
            ChooseCustomerButton(onPress: _chooseCustomer),
            const SizedBox(height: 16),
            // Nobody picked: the tab can still carry a name
            FTextField(
              control: FTextFieldControl.managed(controller: _label),
              label: Text.rich(
                TextSpan(
                  text: l10n.tabName,
                  children: [
                    TextSpan(
                      text: ' (${l10n.optional})',
                      style: TextStyle(fontWeight: FontWeight.w400, color: theme.colors.mutedForeground),
                    ),
                  ],
                ),
              ),
              // No autofocus: the name is optional; the keyboard waits for a tap.
              maxLines: 1,
              textInputAction: TextInputAction.done,
              onSubmit: (_) => _open(),
              suffixBuilder: _label.text.isEmpty
                  ? null
                  : (context, style, _) => FTappable(
                        onPress: _label.clear,
                        child: Padding(
                          padding: const EdgeInsetsDirectional.only(end: 12),
                          child: Icon(FIcons.x, size: 18, color: theme.colors.mutedForeground),
                        ),
                      ),
            ),
          ],
          const SizedBox(height: 20),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              SizedBox(
                height: 48,
                child: FButton(
                  variant: FButtonVariant.outline,
                  mainAxisSize: MainAxisSize.min,
                  onPress: _pending ? null : () => Navigator.of(context, rootNavigator: true).pop(),
                  child: Text(l10n.cancel, style: theme.typography.base.forButton),
                ),
              ),
              const SizedBox(width: 8),
              SizedBox(
                height: 48,
                child: FButton(
                  mainAxisSize: MainAxisSize.min,
                  onPress: _pending ? null : _open,
                  prefix: _pending
                      ? const SizedBox.square(dimension: 20, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(FIcons.shoppingBag, size: 20),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: Text(l10n.openTicketAction, style: theme.typography.base.forButton),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

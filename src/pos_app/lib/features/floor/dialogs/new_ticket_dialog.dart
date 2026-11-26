import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import 'package:uuid/uuid.dart';
import 'package:ninja_app_core/models/localized_text.dart';
import '../../../core/network/api_errors.dart';
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
import '../../../core/theme/type_roles.dart';

/// Opens a counter tab: a bill with no place, for whoever it is for. The
/// customer is chosen exactly as on the sale pad — the same picker (search
/// by name, a walk-in's typed name, a new counter customer with its
/// duplicate check) — and picking opens their bill at once, so the round
/// goes on their tab. With nobody picked, the tab can still carry a name, or
/// none: that is what Open is for. Accounts that already have a bill running (on a tab, at a table,
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
    // Picking who it is for opens their bill at once: there is nothing left to say
    await _open(picked);
  }

  /// Opens the tab: for the customer given, else the one picked, else under the name typed
  Future<void> _open([SaleCustomer? who]) async {
    if (_pending) return;
    final l10n = AppLocalizations.of(context)!;
    who ??= _customer;
    setState(() => _pending = true);
    try {
      final label = who?.name ?? _label.text.trim();
      final ticketId = await ref.read(ticketsRepositoryProvider).openTicket(
            OpenTicketRequest(type: TicketType.counter, label: label.isEmpty ? null : label),
            requestId: _requestId,
          );
      // Client-side link: remember the account so the sale pad pre-selects it
      if (who?.id != null && who!.id!.isNotEmpty) {
        pendingTicketCustomer[ticketId] = who;
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
          Text(l10n.newTab, style: theme.type.title),
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
                          child: Icon(FIcons.x, size: Sizes.icon, color: theme.colors.mutedForeground),
                        ),
                      ),
            ),
          ],
          const SizedBox(height: 20),
          DialogActions(
            children: [
              SizedBox(
                height: Sizes.control,
                child: FButton(
                  variant: FButtonVariant.outline,
                  mainAxisSize: MainAxisSize.min,
                  onPress: _pending ? null : () => Navigator.of(context, rootNavigator: true).pop(),
                  child: Text(l10n.cancel, style: theme.type.button),
                ),
              ),
              SizedBox(
                height: Sizes.control,
                child: FButton(
                  mainAxisSize: MainAxisSize.min,
                  onPress: _pending ? null : () => _open(),
                  prefix: _pending
                      ? const SizedBox.square(dimension: Sizes.icon, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(FIcons.shoppingBag, size: Sizes.icon),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: Text(l10n.openTicketAction, style: theme.type.button),
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

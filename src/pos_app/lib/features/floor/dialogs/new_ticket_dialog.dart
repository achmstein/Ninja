import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:uuid/uuid.dart';
import '../../../core/models/localized_text.dart';
import '../../../core/network/api_errors.dart';
import '../../../core/theme/text_styles.dart';
import '../../../core/utils/highlight.dart';
import '../../../core/widgets/pos_toast.dart';
import '../../../core/widgets/pos_dialog.dart';
import '../widgets/bill_card.dart';
import '../../../l10n/app_localizations.dart';
import '../../customers/services/customer_search_service.dart';
import '../../places/providers/places_provider.dart';
import '../../sale/models/sale_line.dart';
import '../../sale/pending_ticket_customer.dart';
import '../../tickets/busy_customers.dart';
import '../../tickets/models/enums.dart';
import '../../tickets/models/open_ticket.dart';
import '../../tickets/providers/tickets_provider.dart';
import '../../tickets/services/tickets_service.dart';

const _searchDebounce = Duration(milliseconds: 300);
const _minSearchLength = 2;

/// Opens a counter tab: a bill with no place, named after whoever it is
/// for. Typing looks up accounts — pick one to open the tab for them so the
/// round goes on their tab, or just use the typed name for a walk-in. The
/// name is optional; leave it blank for an unnamed tab. Accounts that already
/// have a bill running (on a tab, at a table, in a room) show greyed out with
/// the bill they are on, so the cashier sees they exist but cannot open a
/// second one: one person, one bill.
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

  // The account this tab is being opened for, once one is picked
  SaleCustomer? _picked;
  Timer? _debounce;
  String _search = '';
  List<IdentityUser> _users = const [];
  // Who already has a bill, and where, as of the last search
  Map<String, BillPlace> _busy = const {};

  @override
  void initState() {
    super.initState();
    _label.addListener(_onLabelChanged);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _label.dispose();
    super.dispose();
  }

  void _onLabelChanged() {
    // Typing after a pick means the cashier is choosing someone else (the
    // pick itself writes the name into the field, which is not typing)
    if (_picked != null && _label.text != _picked!.name) setState(() => _picked = null);
    _debounce?.cancel();
    _debounce = Timer(_searchDebounce, _runSearch);
  }

  Future<void> _runSearch() async {
    final term = _label.text.trim();
    final search = term.length >= _minSearchLength ? term : '';
    if (search == _search) return;
    _search = search;
    if (search.isEmpty) {
      if (mounted) setState(() => _users = const []);
      return;
    }
    try {
      final users = await ref.read(customerSearchServiceProvider).search(search);
      if (!mounted || _search != search) return;
      final busy = customersOnOpenBills(
        openTickets: ref.read(openTicketsProvider).value ?? const [],
        openStays: ref.read(placesProvider).openStays,
        pending: pendingTicketCustomer,
      );
      setState(() {
        _users = users;
        _busy = busy;
      });
    } catch (_) {
      if (mounted) setState(() => _users = const []);
    }
  }

  void _pickAccount(IdentityUser user) {
    setState(() {
      _picked = SaleCustomer(id: user.id, name: user.displayName, phone: user.phoneNumber);
      _users = const [];
      _search = user.displayName;
    });
    _label.text = user.displayName;
    // The name is settled; the keyboard was covering the Open button
    FocusManager.instance.primaryFocus?.unfocus();
  }

  void _clear() {
    _label.clear();
    setState(() {
      _picked = null;
      _users = const [];
      _search = '';
    });
  }

  Future<void> _open() async {
    if (_pending) return;
    final l10n = AppLocalizations.of(context)!;
    setState(() => _pending = true);
    try {
      final label = _picked?.name ?? _label.text.trim();
      final ticketId = await ref.read(ticketsRepositoryProvider).openTicket(
            OpenTicketRequest(type: TicketType.counter, label: label.isEmpty ? null : label),
            requestId: _requestId,
          );
      // Client-side link: remember the account so the sale pad pre-selects it
      final picked = _picked;
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
    final mark = TextStyle(
      backgroundColor: theme.colors.primary.withValues(alpha: 0.15),
      fontWeight: FontWeight.w700,
    );
    final muted = theme.typography.sm.copyWith(color: theme.colors.mutedForeground);

    return DialogScroll(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(l10n.newTab, style: theme.typography.xl.copyWith(fontWeight: FontWeight.w600)),
          const SizedBox(height: 20),
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
                      onPress: _clear,
                      child: Padding(
                        padding: const EdgeInsetsDirectional.only(end: 12),
                        child: Icon(FIcons.x, size: 18, color: theme.colors.mutedForeground),
                      ),
                    ),
          ),
          // The account this round will go on, once picked
          if (_picked?.id != null) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(color: theme.colors.secondary.withValues(alpha: 0.5), borderRadius: BorderRadius.circular(10)),
              child: Row(
                children: [
                  Icon(FIcons.user, size: 16, color: theme.colors.mutedForeground),
                  const SizedBox(width: 8),
                  Expanded(child: Text(l10n.onCustomerTabHint(_picked!.name), maxLines: 1, overflow: TextOverflow.ellipsis)),
                ],
              ),
            ),
          ] else if (_users.isNotEmpty) ...[
            const SizedBox(height: 8),
            ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 240),
              child: ListView.builder(
                shrinkWrap: true,
                itemCount: _users.length,
                itemBuilder: (context, index) {
                  final user = _users[index];
                  final contact = user.contact;
                  final onBill = _busy[user.id];
                  final where = onBill == null
                      ? null
                      : onBill.name?.localized(context).isNotEmpty == true
                          ? onBill.name!.localized(context)
                          : (onBill.label?.isNotEmpty == true ? onBill.label! : ticketTypeLabel(l10n, onBill.type));
                  return FTappable(
                    onPress: onBill == null ? () => _pickAccount(user) : null,
                    builder: (context, states, child) => Opacity(
                      opacity: onBill == null ? 1 : 0.6,
                      child: Container(
                        constraints: const BoxConstraints(minHeight: 52),
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: states.contains(FTappableVariant.pressed) ? theme.colors.secondary : null,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: child,
                      ),
                    ),
                    child: Row(
                      children: [
                        Icon(FIcons.userPlus, size: 20, color: theme.colors.mutedForeground),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text.rich(
                                TextSpan(children: highlightSpans(user.displayName, matchRanges(user.displayName, _search), mark)),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: theme.typography.base.copyWith(fontWeight: FontWeight.w500),
                              ),
                              if (where != null)
                                Text(
                                  l10n.alreadyOnBill(where),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: muted,
                                )
                              else if (contact != null)
                                Text.rich(
                                  TextSpan(
                                    children: highlightSpans(
                                      contact,
                                      user.phoneNumber?.isNotEmpty == true ? phoneRanges(contact, _search) : matchRanges(contact, _search),
                                      mark,
                                    ),
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: muted,
                                ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  );
                },
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

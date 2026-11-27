import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import 'package:ninja_app_core/widgets/confirm_dialog.dart';
import 'package:uuid/uuid.dart';
import '../../../core/auth/auth_service.dart';
import '../../../core/models/money.dart';
import '../../../core/network/api_errors.dart';
import '../../../core/printing/print_service.dart';
import '../../../core/utils/bidi.dart';
import '../../../core/widgets/pos_toast.dart';
import '../../../l10n/app_localizations.dart';
import '../../places/models/place.dart';
import '../../ticket/dialogs/discard_dialog.dart';
import '../../ticket/dialogs/discount_dialog.dart';
import '../../ticket/dialogs/kitchen_reprint_dialog.dart';
import '../../ticket/dialogs/void_dialog.dart';
import '../../shifts/providers/shifts_provider.dart';
import '../../tickets/models/ticket_detail.dart';
import '../../tickets/providers/tickets_provider.dart';
import '../../tickets/services/tickets_service.dart';
import '../bill_actions.dart';
import '../../../core/theme/type_roles.dart';

/// The rest a bill can do, from the order screen it is rung up on: a
/// discount, the bill on paper, the kitchen's tickets again, picking lines to
/// split, move or name, an owner giving a part payment back, and taking the
/// bill off the floor (discarded while empty, voided by an owner once
/// something is on it). Each opens here, over the order, under the same rules
/// as the bill's own page. The web till's BillMenu is the same.
class BillMenu extends ConsumerStatefulWidget {
  final TicketDetail ticket;

  /// The room's clock, while it runs: a void waits for it to end
  final Stay? runningStay;

  /// Lines charged here are still on their way: nothing empties the bill under them
  final bool sending;

  /// Turns the order's sent lines into boxes to tick
  final VoidCallback onSelectLines;

  const BillMenu({
    super.key,
    required this.ticket,
    required this.runningStay,
    required this.sending,
    required this.onSelectLines,
  });

  @override
  ConsumerState<BillMenu> createState() => _BillMenuState();
}

class _BillMenuState extends ConsumerState<BillMenu> with SingleTickerProviderStateMixin {
  late final FPopoverController _menu = FPopoverController(vsync: this);

  @override
  void dispose() {
    _menu.dispose();
    super.dispose();
  }

  void _pick(VoidCallback action) {
    _menu.hide();
    action();
  }

  Future<void> _printBill() async {
    final l10n = AppLocalizations.of(context)!;
    try {
      await ref.read(printServiceProvider).printBill(widget.ticket, l10n: l10n, locale: Localizations.localeOf(context));
      if (mounted) showPosToast(context, PosToastType.success, l10n.printed);
    } catch (e) {
      if (mounted) showPosToast(context, PosToastType.error, describePrintError(e, l10n));
    }
  }

  Future<void> _discard() async {
    final discarded = await showDiscardDialog(context, widget.ticket.id);
    if (discarded && mounted) context.go('/');
  }

  Future<void> _void() async {
    if (!await clearToVoid(context, ref, widget.runningStay) || !mounted) return;
    // The orders on the bill took their ingredients when they were confirmed
    final orderIds = {for (final line in widget.ticket.lines) ?line.orderId}.toList();
    final voided = await showVoidDialog(context, widget.ticket.id, orderIds: orderIds);
    if (voided && mounted) context.go('/');
  }

  /// A part payment given back, an owner's to do: the money leaves this
  /// shift's drawer, and what it paid for is to pay again
  Future<void> _giveBack(PartPayment part) async {
    final l10n = AppLocalizations.of(context)!;
    final amount = money(context, part.amount);
    final payer = part.payerName ?? '';
    final sure = await showConfirmDialog(
      context,
      title: l10n.partGiveBackTitle(amount, bidiIsolate(payer.isEmpty ? l10n.guest : payer)),
      description: l10n.partGiveBackHint,
      cancelLabel: l10n.goBack,
      actionLabel: l10n.partGiveBack(amount),
      destructive: true,
    );
    if (!sure || !mounted) return;
    try {
      await ref
          .read(ticketsRepositoryProvider)
          .returnPartPayment(widget.ticket.id, part.id, requestId: const Uuid().v4());
      ref.invalidate(ticketProvider(widget.ticket.id));
      ref.read(openTicketsProvider.notifier).refresh();
      ref.read(currentShiftProvider.notifier).refresh();
      if (mounted) showPosToast(context, PosToastType.success, l10n.partGivenBack);
    } catch (e) {
      if (mounted) showPosToast(context, PosToastType.error, describeError(e, l10n));
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final ticket = widget.ticket;
    final lines = ticket.lines;
    final rowStyle = theme.type.body;
    final destructiveStyle = rowStyle.copyWith(color: theme.colors.destructive);
    // Voiding is Owner-only (the server enforces the same rule)
    final isOwner = ref.watch(authServiceProvider.select((s) => s.isOwner));
    // The same rules as the bill's own page: an empty bill is anyone's to
    // discard (a room's only once its clock has stopped); with lines on it,
    // only an owner's void, with its reason, takes it off the floor
    final canDiscard = lines.isEmpty && !widget.sending && (ticket.sessionId == null || ticket.sessionEndedAt != null);
    final canVoid = !canDiscard && isOwner;

    final canDiscount = lines.isNotEmpty && (ticket.subtotal > 0 || ticket.discount > 0);
    final items = [
      FItem(
        prefix: const Icon(FIcons.badgePercent, size: Sizes.icon),
        title: Text(l10n.discount, style: rowStyle),
        // Greyed where there is nothing to take it off (no items, or a bill that comes to
        // nothing): it did nothing when pressed, and looked as if it would. A bill a discount
        // already brought to nothing keeps it, to change or take away
        enabled: canDiscount,
        onPress: canDiscount ? () => _pick(() => showDiscountDialog(context, ticket)) : null,
      ),
      // The bill on paper before it is paid: the customer looks it over, then says how they pay
      if (lines.isNotEmpty)
        FItem(
          prefix: const Icon(FIcons.printer, size: Sizes.icon),
          title: Text(l10n.printBill, style: rowStyle),
          onPress: () => _pick(_printBill),
        ),
      if (canReprintKitchen(ref, ticket))
        FItem(
          prefix: const Icon(FIcons.printer, size: Sizes.icon),
          title: Text(l10n.kitchenTickets, style: rowStyle),
          onPress: () => _pick(() => showKitchenReprint(context, ticket)),
        ),
      // Picking lines to split, move or name: the order's own list turns into boxes to tick
      if (lines.isNotEmpty)
        FItem(
          prefix: const Icon(FIcons.listChecks, size: Sizes.icon),
          title: Text(l10n.splitOrMove, style: rowStyle),
          onPress: () => _pick(widget.onSelectLines),
        ),
      // What was taken in parts, each to give back: an owner's to do, as a void is
      if (isOwner)
        for (final part in ticket.partPayments)
          FItem(
            prefix: const Icon(FIcons.undo2, size: Sizes.icon),
            title: Text(l10n.partGiveBack(money(context, part.amount)), maxLines: 1, style: rowStyle),
            // Who paid it, on a line of their own in the name's own script: beside the
            // amount it was cut to its first letters
            subtitle: (part.payerName ?? '').isEmpty
                ? null
                : Text(
                    part.payerName!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textDirection: textDirectionFor(part.payerName!),
                    textAlign: textAlignFor(context),
                    style: theme.type.detail.copyWith(color: theme.colors.mutedForeground),
                  ),
            onPress: () => _pick(() => _giveBack(part)),
          ),
      if (canDiscard)
        FItem(
          prefix: Icon(FIcons.trash2, size: Sizes.icon, color: theme.colors.destructive),
          title: Text(l10n.discardTicket, style: destructiveStyle),
          onPress: () => _pick(_discard),
        )
      else if (canVoid)
        FItem(
          prefix: Icon(FIcons.ban, size: Sizes.icon, color: theme.colors.destructive),
          title: Text(l10n.voidTicket, style: destructiveStyle),
          onPress: () => _pick(_void),
        ),
    ];

    return FPopoverMenu(
      control: FPopoverControl.managed(controller: _menu),
      menuAnchor: AlignmentDirectional.topEnd,
      childAnchor: AlignmentDirectional.bottomEnd,
      menu: [FItemGroup(children: items)],
      builder: (context, controller, _) => SizedBox.square(
        dimension: Sizes.control,
        child: Semantics(
          label: l10n.moreActions,
          child: FButton.icon(
            variant: FButtonVariant.ghost,
            onPress: controller.toggle,
            child: const Icon(FIcons.ellipsis, size: Sizes.icon),
          ),
        ),
      ),
    );
  }
}

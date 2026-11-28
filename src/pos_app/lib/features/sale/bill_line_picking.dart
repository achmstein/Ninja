import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import 'package:go_router/go_router.dart';
import '../../core/auth/auth_service.dart';
import '../../l10n/app_localizations.dart';
import '../ticket/dialogs/cancel_lines_dialog.dart';
import '../tickets/models/ticket_detail.dart';
import '../tickets/providers/tickets_provider.dart';
import 'bill_lines.dart';
import 'bill_people_state.dart';
import 'bill_route.dart';
import '../../core/theme/type_roles.dart';

/// Lines already on the bill, picked to be told whose they are or moved to
/// another bill: which are ticked, and what is done with them. The web
/// till's `useBillLines` is the same.
mixin BillLinePicking<W extends ConsumerStatefulWidget> on ConsumerState<W>, BillPeopleState<W> {
  void closeOrderSheet();

  /// The sent lines turn into boxes to tick
  void startPicking() => setState(() => picked = {});

  /// Sent lines being picked, to split off, move to another bill or name:
  /// null when they are not
  Set<int>? picked;

  /// The picked lines are being moved or named
  bool _lineBusy = false;

  void _stopPicking() {
    if (mounted) setState(() => picked = null);
  }

  void togglePicked(int lineId) => setState(() {
        final picked = this.picked ??= {};
        if (!picked.remove(lineId)) picked.add(lineId);
      });

  /// What is picked and still on the bill to pick: a line may have gone
  /// (moved from another till, paid for) while its box was ticked
  Set<int> pickedOn(TicketDetail ticket) {
    final picked = this.picked ?? const <int>{};
    return {for (final line in ticket.lines) if (pickableLine(line) && picked.contains(line.id)) line.id};
  }

  void _setLineBusy(bool busy) {
    if (mounted) setState(() => _lineBusy = busy);
  }

  /// The picked lines are told whose they are (bill_lines)
  Future<void> _assignPicked() async {
    final ticketId = billId;
    final ticket = ticketId == null ? null : ref.read(ticketProvider(ticketId)).value;
    if (ticket == null) return;
    final named = await assignPickedLines(context, ref, ticket, pickedOn(ticket), onBusy: _setLineBusy);
    if (named) _stopPicking();
  }

  /// The picked lines go to another bill; the till follows them there
  Future<void> _movePicked() async {
    final ticketId = billId;
    final ticket = ticketId == null ? null : ref.read(ticketProvider(ticketId)).value;
    if (ticket == null) return;
    final to = await movePickedLines(context, ref, ticket, pickedOn(ticket), onBusy: _setLineBusy);
    if (to == null || !mounted) return;
    _stopPicking();
    closeOrderSheet();
    context.go(billRoute(to.ticketId, label: to.label));
  }

  /// The picked items are cancelled, the bill staying open: an owner's to do,
  /// as a void is
  Future<void> _cancelPicked() async {
    final ticketId = billId;
    final ticket = ticketId == null ? null : ref.read(ticketProvider(ticketId)).value;
    if (ticket == null) return;
    final cancelled = await showCancelLinesDialog(context, ticket, pickedOn(ticket));
    if (cancelled) _stopPicking();
  }

  /// What stands in the order's button's place while lines are picked: how
  /// many, the way out, and the two things done with them (say whose they
  /// are, or move them), side by side at the same width. An owner also has
  /// cancelling them under those, once every picked line is an item that can be
  Widget pickingFoot(BuildContext context, TicketDetail ticket) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final chosen = pickedOn(ticket);
    final count = chosen.length;
    final none = count == 0 || _lineBusy;
    // Cancelling an item is Owner-only (the server enforces the same rule)
    final isOwner = ref.watch(authServiceProvider.select((s) => s.isOwner));
    final canCancel = !none && ticket.lines.where((line) => chosen.contains(line.id)).every((line) => line.cancellable);

    // The words shrink to their half of the order's column before they are cut
    Widget action(String label, IconData icon, {required VoidCallback onPress, FButtonVariant? variant}) => Expanded(
          child: SizedBox(
            height: Sizes.controlLarge,
            child: FButton(
              variant: variant,
              onPress: none ? null : onPress,
              prefix: Icon(icon, size: Sizes.icon),
              child: Flexible(
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Text(label, maxLines: 1, style: theme.type.button),
                ),
              ),
            ),
          ),
        );

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(l10n.selectedLinesCount(count),
                  style: theme.type.detail.copyWith(fontWeight: FontWeight.w500)),
            ),
            SizedBox(
              height: Sizes.control,
              child: FButton(
                variant: FButtonVariant.ghost,
                mainAxisSize: MainAxisSize.min,
                onPress: _stopPicking,
                // "Back", as the mock-up has it: "Cancel" read as cancelling the items below it
                child: Text(l10n.goBack, style: theme.type.button),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            action(l10n.assignCustomer, FIcons.userPlus, onPress: _assignPicked, variant: FButtonVariant.outline),
            const SizedBox(width: 8),
            action(l10n.moveItems, FIcons.arrowRightLeft, onPress: _movePicked),
          ],
        ),
        if (isOwner) ...[
          const SizedBox(height: 8),
          SizedBox(
            height: Sizes.controlLarge,
            child: FButton(
              variant: FButtonVariant.outline,
              onPress: canCancel ? _cancelPicked : null,
              prefix: Icon(FIcons.x, size: Sizes.icon, color: canCancel ? theme.colors.destructive : null),
              child: Flexible(
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Text(l10n.cancelItemsAction(count),
                      maxLines: 1,
                      style: theme.type.button.copyWith(
                          fontWeight: FontWeight.w600, color: canCancel ? theme.colors.destructive : null)),
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }
}

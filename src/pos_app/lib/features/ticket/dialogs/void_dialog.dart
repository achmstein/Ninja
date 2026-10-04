import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:uuid/uuid.dart';
import '../../../core/network/api_errors.dart';
import 'package:ninja_app_core/theme/text_styles.dart';
import '../../../core/widgets/pos_toast.dart';
import '../../../core/widgets/pos_dialog.dart';
import '../../../core/widgets/stock_disposition_choice.dart';
import '../../../l10n/app_localizations.dart';
import '../../orders/models/stock_disposition.dart';
import '../../orders/services/order_service.dart';
import '../../tickets/providers/tickets_provider.dart';
import '../../tickets/services/tickets_service.dart';

/// Owner-only: voids an open ticket. The reason is mandatory — a voided
/// ticket disappears from the floor, and the reason is the only audit
/// trail left behind (the server refuses to void settled tickets). A bill
/// with orders on it ([orderIds]) also says what becomes of their food:
/// waste if the kitchen made it, back to stock if not, starting from what
/// Ordering knows. Resolves to true once voided; the caller leaves the screen.
Future<bool> showVoidDialog(BuildContext context, int ticketId, {List<int> orderIds = const []}) async {
  final voided = await showPosDialog<bool>(
    context,
    builder: (context) => VoidDialog(ticketId: ticketId, orderIds: orderIds),
  );
  return voided ?? false;
}

class VoidDialog extends ConsumerStatefulWidget {
  final int ticketId;
  final List<int> orderIds;
  const VoidDialog({super.key, required this.ticketId, this.orderIds = const []});

  @override
  ConsumerState<VoidDialog> createState() => _VoidDialogState();
}

class _VoidDialogState extends ConsumerState<VoidDialog> {
  final _reason = TextEditingController();
  bool _pending = false;
  final String _requestId = const Uuid().v4();

  /// Whether each order on the bill was made, as Ordering says; empty until it does
  List<bool> _prepared = const [];

  /// What the cashier picked; until they pick, the orders' own state decides
  StockDisposition? _picked;

  StockDisposition get _disposition => _picked ?? StockDisposition.defaultForAll(_prepared);

  bool get _hasFood => widget.orderIds.isNotEmpty;

  @override
  void initState() {
    super.initState();
    _reason.addListener(() => setState(() {}));
    if (_hasFood) _readOrders();
  }

  /// An order Ordering cannot answer for counts as not made: the cashier sees
  /// the choice either way and says otherwise when it was
  Future<void> _readOrders() async {
    final orders = ref.read(orderRepositoryProvider);
    final prepared = await Future.wait(widget.orderIds.map((id) async {
      try {
        return (await orders.getOrderDetails(id)).wasPrepared;
      } catch (_) {
        return false;
      }
    }));
    if (mounted) setState(() => _prepared = prepared);
  }

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  bool get _canVoid => _reason.text.trim().isNotEmpty && !_pending;

  Future<void> _void() async {
    if (!_canVoid) return;
    final l10n = AppLocalizations.of(context)!;
    setState(() => _pending = true);
    try {
      await ref.read(ticketsRepositoryProvider).voidTicket(
            widget.ticketId,
            _reason.text.trim(),
            requestId: _requestId,
            // Only orders took stock; a bill of manual lines says nothing
            stockDisposition: _hasFood ? _disposition.wire : null,
          );
      ref.read(openTicketsProvider.notifier).refresh();
      ref.invalidate(ticketProvider(widget.ticketId));
      if (!mounted) return;
      showPosToast(context, PosToastType.success, l10n.ticketVoided);
      Navigator.of(context, rootNavigator: true).pop(true);
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
    // Scrolls when the keyboard squeezes it: on a landscape tablet the
    // keyboard leaves less height than even this dialog needs
    return DialogScroll(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(l10n.voidTicket, style: theme.typography.xl.copyWith(fontWeight: FontWeight.w600)),
          const SizedBox(height: 16),
          FTextField(
            control: FTextFieldControl.managed(controller: _reason),
            label: Text(l10n.reason),
            autofocus: true,
            maxLines: 1,
            textInputAction: TextInputAction.done,
            onSubmit: (_) => _void(),
          ),
          if (_hasFood) ...[
            const SizedBox(height: 16),
            StockDispositionChoice(
              value: _disposition,
              onChanged: (v) => setState(() => _picked = v),
              enabled: !_pending,
            ),
          ],
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              SizedBox(
                height: 48,
                child: FButton(
                  variant: FButtonVariant.outline,
                  mainAxisSize: MainAxisSize.min,
                  onPress: _pending ? null : () => Navigator.of(context, rootNavigator: true).pop(false),
                  child: Text(l10n.cancel, style: theme.typography.base.forButton),
                ),
              ),
              const SizedBox(width: 8),
              SizedBox(
                height: 48,
                child: FButton(
                  variant: FButtonVariant.destructive,
                  mainAxisSize: MainAxisSize.min,
                  onPress: _canVoid ? _void : null,
                  child: Text(l10n.confirmVoid, style: theme.typography.base.forButton),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

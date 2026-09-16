import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:uuid/uuid.dart';
import '../../../core/network/api_errors.dart';
import '../../../core/theme/text_styles.dart';
import '../../../core/widgets/pos_toast.dart';
import '../../../core/widgets/pos_dialog.dart';
import '../../../l10n/app_localizations.dart';
import '../../tickets/models/ticket_detail.dart';
import '../../tickets/providers/tickets_provider.dart';
import '../../tickets/services/tickets_service.dart';

/// Money off the whole bill: a percent or an amount, with a reason. The
/// server holds a cashier to the branch's cap and lets an owner past it;
/// its refusal is the only message the till shows. Given again it replaces
/// the earlier discount; Remove takes it off.
Future<void> showDiscountDialog(BuildContext context, TicketDetail ticket) =>
    showPosDialog<void>(context, builder: (context) => _DiscountDialog(ticket: ticket));

enum _Kind { percent, amount }

class _DiscountDialog extends ConsumerStatefulWidget {
  final TicketDetail ticket;
  const _DiscountDialog({required this.ticket});

  @override
  ConsumerState<_DiscountDialog> createState() => _DiscountDialogState();
}

class _DiscountDialogState extends ConsumerState<_DiscountDialog> {
  final _value = TextEditingController();
  final _reason = TextEditingController();
  late _Kind _kind;
  bool _pending = false;
  final String _requestId = const Uuid().v4();

  bool get _hasDiscount => widget.ticket.discountRate != null || widget.ticket.discount > 0;

  @override
  void initState() {
    super.initState();
    // Reopening shows what is on the bill now, so a change starts from it
    final t = widget.ticket;
    if (t.discountRate != null) {
      _kind = _Kind.percent;
      _value.text = _trim((t.discountRate! * 10000).roundToDouble() / 100);
    } else {
      _kind = t.discount > 0 ? _Kind.amount : _Kind.percent;
      if (t.discount > 0) _value.text = _trim(t.discount);
    }
    _reason.text = t.discountReason ?? '';
    _value.addListener(() => setState(() {}));
    _reason.addListener(() => setState(() {}));
  }

  static String _trim(double v) => v == v.roundToDouble() ? v.toStringAsFixed(0) : v.toString();

  @override
  void dispose() {
    _value.dispose();
    _reason.dispose();
    super.dispose();
  }

  double? get _number => double.tryParse(_value.text.trim());

  bool get _canApply => (_number ?? 0) > 0 && !_pending;

  Future<void> _run(Future<void> Function() action) async {
    final l10n = AppLocalizations.of(context)!;
    setState(() => _pending = true);
    try {
      await action();
      ref.read(openTicketsProvider.notifier).refresh();
      ref.invalidate(ticketProvider(widget.ticket.id));
      if (!mounted) return;
      Navigator.of(context, rootNavigator: true).pop();
    } catch (e) {
      if (!mounted) return;
      setState(() => _pending = false);
      showPosToast(context, PosToastType.error, describeError(e, l10n));
    }
  }

  Future<void> _apply() async {
    if (!_canApply) return;
    final n = _number!;
    await _run(() => ref.read(ticketsRepositoryProvider).applyDiscount(
          widget.ticket.id,
          rate: _kind == _Kind.percent ? n / 100 : null,
          amount: _kind == _Kind.amount ? n : null,
          reason: _reason.text.trim(),
          requestId: _requestId,
        ));
  }

  Future<void> _remove() => _run(() => ref.read(ticketsRepositoryProvider).removeDiscount(widget.ticket.id));

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;

    Widget kind(_Kind k, String label) => SizedBox(
          height: 48,
          child: FButton(
            variant: _kind == k ? null : FButtonVariant.outline,
            mainAxisSize: MainAxisSize.min,
            onPress: () => setState(() => _kind = k),
            child: Text(label, style: theme.typography.base.forButton),
          ),
        );

    return DialogScroll(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(l10n.discount, style: theme.typography.xl.copyWith(fontWeight: FontWeight.w600)),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: FTextField(
                  control: FTextFieldControl.managed(controller: _value),
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  autofocus: true,
                  maxLines: 1,
                  textInputAction: TextInputAction.next,
                ),
              ),
              const SizedBox(width: 8),
              kind(_Kind.percent, '%'),
              const SizedBox(width: 4),
              kind(_Kind.amount, l10n.currency),
            ],
          ),
          const SizedBox(height: 12),
          FTextField(
            control: FTextFieldControl.managed(controller: _reason),
            label: Text(l10n.reason),
            maxLines: 1,
            textInputAction: TextInputAction.done,
            onSubmit: (_) => _apply(),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              if (_hasDiscount)
                SizedBox(
                  height: 48,
                  child: FButton(
                    variant: FButtonVariant.ghost,
                    mainAxisSize: MainAxisSize.min,
                    onPress: _pending ? null : _remove,
                    child: Text(l10n.remove,
                        style: theme.typography.base.forButton.copyWith(color: theme.colors.destructive)),
                  ),
                ),
              const Spacer(),
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
                  onPress: _canApply ? _apply : null,
                  child: Text(l10n.apply, style: theme.typography.base.forButton),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

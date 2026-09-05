import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:uuid/uuid.dart';
import '../../../core/network/api_errors.dart';
import '../../../core/theme/text_styles.dart';
import '../../../core/widgets/pos_toast.dart';
import '../../../l10n/app_localizations.dart';
import '../../tickets/providers/tickets_provider.dart';
import '../../tickets/services/tickets_service.dart';

/// Owner-only: voids an open ticket. The reason is mandatory — a voided
/// ticket disappears from the floor, and the reason is the only audit
/// trail left behind (the server refuses to void settled tickets).
/// Resolves to true once voided; the caller leaves the screen.
Future<bool> showVoidDialog(BuildContext context, int ticketId) async {
  final voided = await showFDialog<bool>(
    context: context,
    useRootNavigator: true,
    builder: (context, style, animation) => FDialog.raw(
      style: style,
      animation: animation,
      constraints: const BoxConstraints(maxWidth: 448),
      builder: (context, _) => _VoidDialog(ticketId: ticketId),
    ),
  );
  return voided ?? false;
}

class _VoidDialog extends ConsumerStatefulWidget {
  final int ticketId;
  const _VoidDialog({required this.ticketId});

  @override
  ConsumerState<_VoidDialog> createState() => _VoidDialogState();
}

class _VoidDialogState extends ConsumerState<_VoidDialog> {
  final _reason = TextEditingController();
  bool _pending = false;
  final String _requestId = const Uuid().v4();

  @override
  void initState() {
    super.initState();
    _reason.addListener(() => setState(() {}));
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
      await ref.read(ticketsRepositoryProvider).voidTicket(widget.ticketId, _reason.text.trim(), requestId: _requestId);
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
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(l10n.voidTicket, style: theme.typography.xl.copyWith(fontWeight: FontWeight.w600)),
          const SizedBox(height: 16),
          FTextField(
            control: FTextFieldControl.managed(controller: _reason),
            label: Text(l10n.reason),
            description: Text(l10n.voidReasonHint),
            autofocus: true,
            maxLines: 1,
            textInputAction: TextInputAction.done,
            onSubmit: (_) => _void(),
          ),
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

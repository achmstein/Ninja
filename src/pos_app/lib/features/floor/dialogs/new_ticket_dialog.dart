import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:uuid/uuid.dart';
import '../../../core/network/api_errors.dart';
import '../../../core/theme/text_styles.dart';
import '../../../core/widgets/pos_toast.dart';
import '../../../l10n/app_localizations.dart';
import '../../tickets/models/enums.dart';
import '../../tickets/models/open_ticket.dart';
import '../../tickets/providers/tickets_provider.dart';
import '../../tickets/services/tickets_service.dart';

/// Opens a counter tab: a bill with no place, named after whoever it is
/// for. Tables open from their own row on the floor and rooms follow their
/// sessions, so this is the one kind of bill that needs asking about.
///
/// Resolves to the new ticket's id; the caller goes there.
Future<int?> showNewTicketDialog(BuildContext context) {
  return showFDialog<int>(
    context: context,
    useRootNavigator: true,
    builder: (context, style, animation) => FDialog.raw(
      style: style,
      animation: animation,
      constraints: const BoxConstraints(maxWidth: 448),
      builder: (context, _) => const _NewTicketDialog(),
    ),
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
  // A retry on café Wi-Fi must not become a second command
  final String _requestId = const Uuid().v4();

  @override
  void dispose() {
    _label.dispose();
    super.dispose();
  }

  Future<void> _open() async {
    if (_pending) return;
    final l10n = AppLocalizations.of(context)!;
    setState(() => _pending = true);
    try {
      final label = _label.text.trim();
      final ticketId = await ref.read(ticketsRepositoryProvider).openTicket(
            OpenTicketRequest(type: TicketType.counter, label: label.isEmpty ? null : label),
            requestId: _requestId,
          );
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
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(l10n.newTab, style: theme.typography.xl.copyWith(fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          Text(l10n.newTabHint, style: theme.typography.base.copyWith(color: theme.colors.mutedForeground)),
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
            autofocus: true,
            maxLines: 1,
            textInputAction: TextInputAction.done,
            onSubmit: (_) => _open(),
          ),
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

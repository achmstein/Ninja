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

/// Throws away an open ticket nothing ever landed on — opened for the wrong
/// table, or for a walk-in who changed their mind at the counter. Unlike a
/// void there is no reason to type and no owner to fetch: the server deletes
/// the row (it refuses once a line exists) and the floor forgets the tile.
///
/// Resolves to true once the ticket is gone; the caller leaves the screen.
Future<bool> showDiscardDialog(BuildContext context, int ticketId) async {
  final discarded = await showFDialog<bool>(
    context: context,
    useRootNavigator: true,
    builder: (context, style, animation) => FDialog.raw(
      style: style,
      animation: animation,
      constraints: const BoxConstraints(maxWidth: 448),
      builder: (context, _) => _DiscardDialog(ticketId: ticketId),
    ),
  );
  return discarded ?? false;
}

class _DiscardDialog extends ConsumerStatefulWidget {
  final int ticketId;
  const _DiscardDialog({required this.ticketId});

  @override
  ConsumerState<_DiscardDialog> createState() => _DiscardDialogState();
}

class _DiscardDialogState extends ConsumerState<_DiscardDialog> {
  bool _pending = false;
  // A retry on café Wi-Fi must not become a second command
  final String _requestId = const Uuid().v4();

  Future<void> _discard() async {
    final l10n = AppLocalizations.of(context)!;
    setState(() => _pending = true);
    try {
      await ref.read(ticketsRepositoryProvider).discard(widget.ticketId, requestId: _requestId);
      ref.read(openTicketsProvider.notifier).refresh();
      if (!mounted) return;
      showPosToast(context, PosToastType.success, l10n.ticketDiscarded);
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
          Text(l10n.discardTicketTitle, style: theme.typography.xl.copyWith(fontWeight: FontWeight.w600)),
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
                  onPress: _pending ? null : _discard,
                  child: Text(l10n.confirmDiscard, style: theme.typography.base.forButton),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

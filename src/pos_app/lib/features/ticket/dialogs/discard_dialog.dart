import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import 'package:uuid/uuid.dart';
import '../../../core/network/api_errors.dart';
import '../../../core/widgets/pos_dialog.dart';
import '../../../core/widgets/pos_toast.dart';
import '../../../l10n/app_localizations.dart';
import '../../tickets/providers/tickets_provider.dart';
import '../../tickets/services/tickets_service.dart';
import '../../../core/theme/type_roles.dart';

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
    builder: (context, style, animation) => DialogPanel(
      style: style,
      animation: animation,
      builder: (context) => _DiscardDialog(ticketId: ticketId),
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
  // A retry on business Wi-Fi must not become a second command
  final String _requestId = const Uuid().v4();

  Future<void> _discard() async {
    final l10n = AppLocalizations.of(context)!;
    setState(() => _pending = true);
    try {
      await ref.read(ticketsRepositoryProvider).discard(widget.ticketId, requestId: _requestId);
      unawaited(ref.read(openTicketsProvider.notifier).refresh());
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
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(l10n.discardTicketTitle, style: theme.type.title),
          const SizedBox(height: 16),
          DialogActions(
            children: [
              SizedBox(
                height: Sizes.control,
                child: FButton(
                  variant: FButtonVariant.outline,
                  mainAxisSize: MainAxisSize.min,
                  onPress: _pending ? null : () => Navigator.of(context, rootNavigator: true).pop(false),
                  child: Text(l10n.cancel, style: theme.type.button),
                ),
              ),
              SizedBox(
                height: Sizes.control,
                child: FButton(
                  variant: FButtonVariant.destructive,
                  mainAxisSize: MainAxisSize.min,
                  onPress: _pending ? null : _discard,
                  child: Text(l10n.confirmDiscard, style: theme.type.button),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

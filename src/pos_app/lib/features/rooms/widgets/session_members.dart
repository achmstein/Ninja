import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/text_styles.dart';
import '../../../l10n/app_localizations.dart';
import '../../sale/widgets/customer_dialog.dart';
import '../models/room.dart';
import '../session_actions.dart';

/// Who is in the room: the owner starred, members removable, and a dashed
/// chip to add the next one. Members' phone orders land on the bill and
/// earn their points, and at settle each member is a tab the bill can go
/// on — which is why the till keeps naming people after the time has
/// landed: someone who never scanned the QR still owes their share.
/// Mirrors pos_web's SessionMembers.
class SessionMembers extends ConsumerStatefulWidget {
  final RoomSession session;

  const SessionMembers({super.key, required this.session});

  @override
  ConsumerState<SessionMembers> createState() => _SessionMembersState();
}

class _SessionMembersState extends ConsumerState<SessionMembers> {
  bool _busy = false;

  Future<void> _guarded(Future<bool> Function(SessionActions actions) call) async {
    if (_busy) return;
    setState(() => _busy = true);
    await call(SessionActions(ref, context));
    if (mounted) setState(() => _busy = false);
  }

  Future<void> _addMember() async {
    final picked = await showCustomerDialog(context, accountsOnly: true);
    final id = picked?.id;
    if (picked == null || id == null || id.isEmpty || !mounted) return;
    await _guarded((a) => a.addMember(widget.session.id, id, picked.name));
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final session = widget.session;
    final muted = theme.typography.sm.copyWith(color: theme.colors.mutedForeground);

    return Wrap(
      crossAxisAlignment: WrapCrossAlignment.center,
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final member in session.members)
          Container(
            padding: EdgeInsetsDirectional.fromSTEB(12, 6, member.isOwner ? 12 : 4, 6),
            decoration: BoxDecoration(border: Border.all(color: theme.colors.border), borderRadius: BorderRadius.circular(999)),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(member.isOwner ? FIcons.star : FIcons.user, size: 14, color: member.isOwner ? AppColors.amber500 : null),
                const SizedBox(width: 6),
                Text((member.customerName ?? '').isNotEmpty ? member.customerName! : l10n.guest, style: theme.typography.sm),
                if (!member.isOwner) ...[
                  const SizedBox(width: 4),
                  SizedBox.square(
                    dimension: 24,
                    child: FButton.icon(
                      variant: FButtonVariant.ghost,
                      onPress: _busy ? null : () => _guarded((a) => a.removeMember(session.id, member.customerId)),
                      child: Icon(FIcons.x, size: 14, color: theme.colors.mutedForeground),
                    ),
                  ),
                ],
              ],
            ),
          ),
        if (session.members.isEmpty && (session.userName ?? '').isNotEmpty)
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(FIcons.user, size: 16, color: theme.colors.mutedForeground),
              const SizedBox(width: 4),
              Text(session.userName!, style: muted),
            ],
          ),
        SizedBox(
          height: 36,
          child: FButton(
            variant: FButtonVariant.outline,
            mainAxisSize: MainAxisSize.min,
            onPress: _busy ? null : _addMember,
            prefix: Icon(FIcons.userPlus, size: 16, color: theme.colors.mutedForeground),
            child: Text(l10n.addCustomer, style: theme.typography.sm.forButton.copyWith(color: theme.colors.mutedForeground)),
          ),
        ),
      ],
    );
  }
}

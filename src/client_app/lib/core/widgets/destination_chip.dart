import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import '../models/localized_text.dart';
import '../providers/current_table_provider.dart';
import 'app_text.dart';

/// Standing reminder of where the order is going, mirroring the web client's
/// top-bar chip.
///
/// Scanning a table drops the customer straight on the menu, so without this
/// the only confirmation is a toast that disappears. A table can be dismissed
/// here if they moved or scanned the wrong sticker; a room cannot - you leave a
/// room by ending the session, not by dismissing a chip.
class DestinationChip extends ConsumerWidget {
  const DestinationChip({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final destination = ref.watch(orderDestinationProvider);
    if (destination == null) return const SizedBox.shrink();

    final theme = context.theme;
    final isRoom = destination.isRoom;

    return Padding(
      padding: const EdgeInsetsDirectional.only(end: 12, top: 8),
      child: Container(
        padding: EdgeInsetsDirectional.only(
          start: 8,
          end: isRoom ? 8 : 4,
          top: 3,
          bottom: 3,
        ),
        decoration: BoxDecoration(
          color: theme.colors.muted,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              isRoom ? FIcons.gamepad2 : FIcons.armchair,
              size: 13,
              color: theme.colors.mutedForeground,
            ),
            const SizedBox(width: 4),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 110),
              child: AppText(
                destination.name.localized(context),
                overflow: TextOverflow.ellipsis,
                style: theme.typography.xs.copyWith(
                  color: theme.colors.mutedForeground,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            if (!isRoom)
              GestureDetector(
                onTap: () => ref.read(currentTableProvider.notifier).clear(),
                behavior: HitTestBehavior.opaque,
                child: Padding(
                  padding: const EdgeInsets.all(4),
                  child: Icon(
                    FIcons.x,
                    size: 12,
                    color: theme.colors.mutedForeground,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

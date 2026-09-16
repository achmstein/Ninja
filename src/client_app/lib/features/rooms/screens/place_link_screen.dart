import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import '../../../core/auth/auth_service.dart';
import '../../../core/models/localized_text.dart';
import '../../../core/providers/branch_provider.dart';
import '../../../core/providers/current_table_provider.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_text.dart';
import '../../../l10n/app_localizations.dart';
import '../models/room.dart';
import '../services/room_service.dart';
import 'rooms_screen.dart';

/// Landing for a place QR that opened the app as an App Link
/// (https://chillax.site/p/{id}; the older /room and /table stickers resolve
/// into it).
///
/// A place that only takes orders is a detour, not a destination: it is
/// remembered as where the customer sits and they go to the menu with a
/// toast. A timed place is a page: already in the party, join the clock
/// running there, or hold it. A timed table is both.
class PlaceLinkScreen extends ConsumerStatefulWidget {
  final int placeId;

  const PlaceLinkScreen({super.key, required this.placeId});

  @override
  ConsumerState<PlaceLinkScreen> createState() => _PlaceLinkScreenState();
}

class _PlaceLinkScreenState extends ConsumerState<PlaceLinkScreen> {
  RoomScanResult? _scan;
  bool _loading = true;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _resolve());
  }

  Future<void> _resolve() async {
    final l10n = AppLocalizations.of(context)!;

    try {
      final place = await ref.read(roomRepositoryProvider).getRoom(widget.placeId);
      if (!mounted) return;

      if (!place.isActive) {
        _leave('/menu', l10n.tableUnavailable, isError: true);
        return;
      }

      // A table is where the order goes, clock or no clock
      if (place.kind == PlaceKind.table) {
        await ref.read(currentTableProvider.notifier).setTable(
              CurrentTable(
                id: place.id,
                kind: place.kind,
                name: place.name,
                branchId: ref.read(selectedBranchIdProvider) ?? 1,
                scannedAt: DateTime.now(),
              ),
            );
        if (!mounted) return;
      }

      if (place.options.isEmpty) {
        _leave('/menu', l10n.youAreAtTable(place.name.localized(context)), icon: FIcons.armchair);
        return;
      }

      // Joining or holding needs an account: sign in, then come back here
      if (!ref.read(authServiceProvider).isAuthenticated) {
        rememberLinkForAfterSignIn('/p/${widget.placeId}');
        context.go('/login');
        return;
      }

      final result = await ref.read(roomRepositoryProvider).scanRoom(widget.placeId);
      if (!mounted) return;

      // The QR belongs to a specific branch — switch to it
      final currentBranchId = ref.read(selectedBranchIdProvider);
      if (result.branchId != currentBranchId) {
        ref.read(branchProvider.notifier).selectBranch(result.branchId);
      }

      // Already in the party here — nothing to decide
      if (result.isAlreadyMember) {
        _leave('/rooms', l10n.alreadyInSession, icon: FIcons.info);
        return;
      }

      // A clock is running: join it rather than asking
      if (result.hasActiveSession) {
        await _join();
        return;
      }

      setState(() {
        _scan = result;
        _loading = false;
      });
    } catch (_) {
      if (mounted) _leave('/menu', l10n.invalidQrCode, isError: true);
    }
  }

  Future<void> _join() async {
    final l10n = AppLocalizations.of(context)!;
    setState(() => _busy = true);

    try {
      await ref.read(roomRepositoryProvider).joinSessionByRoom(widget.placeId);
      if (!mounted) return;

      _refreshRooms();
      _leave('/rooms', l10n.joinedSession, icon: FIcons.check, success: true);
    } catch (_) {
      if (mounted) {
        setState(() => _busy = false);
        _leave('/rooms', l10n.failedToJoinSession, isError: true);
      }
    }
  }

  /// The same hold sheet the rooms tab opens: rates, the start-on-arrival
  /// switch, one button. Held or not, the customer ends on the rooms tab.
  Future<void> _reserve() async {
    final scan = _scan;
    if (scan == null) return;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ReservationSheet(room: scan.toRoom()),
    );
    if (mounted) context.go('/rooms');
  }

  void _refreshRooms() {
    ref.read(mySessionsProvider.notifier).refresh();
    final branchId = ref.read(selectedBranchIdProvider);
    if (branchId != null) ref.invalidate(roomsProvider(branchId));
  }

  /// Every outcome ends elsewhere with a toast — the link is a way in, not a
  /// place to stay.
  void _leave(
    String to,
    String message, {
    IconData icon = FIcons.info,
    bool isError = false,
    bool success = false,
  }) {
    context.go(to);
    showFToast(
      context: context,
      title: Text(message),
      icon: Icon(
        isError ? FIcons.circleX : icon,
        color: isError
            ? context.theme.colors.destructive
            : success
                ? AppTheme.successColor
                : context.theme.colors.primary,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final colors = context.theme.colors;
    final scan = _scan;

    if (_loading || scan == null) {
      return Scaffold(
        body: Center(child: CircularProgressIndicator(color: colors.primary)),
      );
    }

    final available = scan.canReserve && scan.displayStatus == RoomDisplayStatus.available;

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(FIcons.x),
          onPressed: () => context.go('/rooms'),
        ),
      ),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: colors.primary.withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(scan.kind.icon, color: colors.primary),
            ),
            const SizedBox(height: 16),

            AppText(
              scan.roomName.localized(context),
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: colors.foreground,
              ),
            ),
            const SizedBox(height: 6),
            AppText(
              tariffLine(context, scan.options),
              style: TextStyle(fontSize: 14, color: colors.mutedForeground),
            ),
            const SizedBox(height: 24),

            if (available)
              SizedBox(
                width: double.infinity,
                child: FButton(
                  onPress: _busy ? null : _reserve,
                  child: Text(l10n.reserveThisRoom),
                ),
              )
            else
              AppText(
                l10n.roomNotAvailable,
                style: TextStyle(fontSize: 14, color: colors.mutedForeground),
              ),

            // A table takes orders whatever the clock does
            if (scan.kind == PlaceKind.table) ...[
              const SizedBox(height: 12),
              FButton(
                variant: FButtonVariant.ghost,
                onPress: () => context.go('/menu'),
                child: Text(l10n.orderHere),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

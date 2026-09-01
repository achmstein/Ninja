import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import '../../../core/models/localized_text.dart';
import '../../../core/providers/branch_provider.dart';
import '../../../core/services/sound_service.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_text.dart';
import '../../../l10n/app_localizations.dart';
import '../models/room.dart';
import '../services/room_service.dart';

/// Landing for a room QR that opened the app as an App Link
/// (https://chillax.site/room/{id}).
///
/// The in-app scanner already handles room codes, but only as text it reads
/// itself - a link arrives as a route instead, so it needs a screen of its own.
/// The outcomes match the scanner: already a member, join a running session, or
/// reserve an empty room.
class RoomLinkScreen extends ConsumerStatefulWidget {
  final int roomId;

  const RoomLinkScreen({super.key, required this.roomId});

  @override
  ConsumerState<RoomLinkScreen> createState() => _RoomLinkScreenState();
}

class _RoomLinkScreenState extends ConsumerState<RoomLinkScreen> {
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
      final result =
          await ref.read(roomRepositoryProvider).scanRoom(widget.roomId);

      if (!mounted) return;

      // The QR belongs to a specific branch — switch to it
      final currentBranchId = ref.read(selectedBranchIdProvider);
      if (result.branchId != currentBranchId) {
        ref.read(branchProvider.notifier).selectBranch(result.branchId);
      }

      // Already playing here — nothing to decide
      if (result.isAlreadyMember) {
        _leave(l10n.alreadyInSession, icon: FIcons.info);
        return;
      }

      // A session is running: join it rather than asking
      if (result.hasActiveSession && result.sessionPreview != null) {
        await _join();
        return;
      }

      setState(() {
        _scan = result;
        _loading = false;
      });
    } catch (_) {
      if (mounted) _leave(l10n.invalidQrCode, isError: true);
    }
  }

  Future<void> _join() async {
    final l10n = AppLocalizations.of(context)!;
    setState(() => _busy = true);

    try {
      await ref.read(roomRepositoryProvider).joinSessionByRoom(widget.roomId);
      if (!mounted) return;

      _refreshRooms();
      _leave(l10n.joinedSession, icon: FIcons.check, success: true);
    } catch (_) {
      if (mounted) {
        setState(() => _busy = false);
        _leave(l10n.failedToJoinSession, isError: true);
      }
    }
  }

  Future<void> _reserve() async {
    final l10n = AppLocalizations.of(context)!;
    setState(() => _busy = true);

    try {
      await ref.read(roomRepositoryProvider).reserveRoom(widget.roomId);
      if (!mounted) return;

      _refreshRooms();
      SoundService.instance.playSuccess();
      _leave(l10n.roomReservedSuccessQr, icon: FIcons.check, success: true);
    } catch (_) {
      if (mounted) {
        setState(() => _busy = false);
        _leave(l10n.failedToReserveRoom, isError: true);
      }
    }
  }

  void _refreshRooms() {
    ref.read(mySessionsProvider.notifier).refresh();
    final branchId = ref.read(selectedBranchIdProvider);
    if (branchId != null) ref.invalidate(roomsProvider(branchId));
  }

  /// Every outcome ends on the rooms tab with a toast — the link is a way in,
  /// not a place to stay.
  void _leave(
    String message, {
    IconData icon = FIcons.info,
    bool isError = false,
    bool success = false,
  }) {
    context.go('/rooms');
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

    final available = scan.displayStatus == RoomDisplayStatus.available;

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
              child: Icon(FIcons.gamepad2, color: colors.primary),
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
              l10n.dualRateFormat(
                scan.singleRate.toStringAsFixed(0),
                scan.multiRate.toStringAsFixed(0),
              ),
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
          ],
        ),
      ),
    );
  }
}

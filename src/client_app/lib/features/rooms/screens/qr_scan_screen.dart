import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../../../core/models/localized_text.dart';
import '../../../core/providers/branch_provider.dart';
import '../../../core/providers/current_table_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_text.dart';
import '../../../l10n/app_localizations.dart';
import '../../tables/models/cafe_table.dart';
import '../../tables/services/table_service.dart';
import '../models/room.dart';
import '../services/room_service.dart';
import '../../../core/services/sound_service.dart';

/// A scanned chillax.site QR: either a room or a café table.
class _ScannedTarget {
  final bool isTable;
  final int id;

  const _ScannedTarget({required this.isTable, required this.id});
}

class QrScanScreen extends ConsumerStatefulWidget {
  const QrScanScreen({super.key});

  @override
  ConsumerState<QrScanScreen> createState() => _QrScanScreenState();
}

class _QrScanScreenState extends ConsumerState<QrScanScreen> {
  final MobileScannerController _scannerController = MobileScannerController();
  bool _isProcessing = false;

  @override
  void dispose() {
    _scannerController.dispose();
    super.dispose();
  }

  /// Match https://chillax.site/room/{id} and https://chillax.site/table/{id}
  _ScannedTarget? _parseTarget(String url) {
    final uri = Uri.tryParse(url);
    if (uri == null) return null;
    if (uri.host != 'chillax.site') return null;
    final segments = uri.pathSegments;
    if (segments.length != 2) return null;
    if (segments[0] != 'room' && segments[0] != 'table') return null;
    final id = int.tryParse(segments[1]);
    if (id == null) return null;
    return _ScannedTarget(isTable: segments[0] == 'table', id: id);
  }

  Future<void> _onDetect(BarcodeCapture capture) async {
    if (_isProcessing) return;
    final barcode = capture.barcodes.firstOrNull;
    if (barcode == null || barcode.rawValue == null) return;

    final target = _parseTarget(barcode.rawValue!);
    if (target == null) {
      _showInvalidQr();
      return;
    }

    setState(() => _isProcessing = true);
    _scannerController.stop();

    if (target.isTable) {
      await _handleTableScan(target.id);
      return;
    }

    final roomId = target.id;

    try {
      final service = ref.read(roomRepositoryProvider);
      final result = await service.scanRoom(roomId);

      if (!mounted) return;

      // Auto-switch branch if room belongs to a different branch
      final currentBranchId = ref.read(selectedBranchIdProvider);
      if (result.branchId != currentBranchId) {
        ref.read(branchProvider.notifier).selectBranch(result.branchId);
      }

      if (result.isAlreadyMember) {
        final l10n = AppLocalizations.of(context)!;
        showFToast(
          context: context,
          title: Text(l10n.alreadyInSession),
          icon: Icon(FIcons.info, color: context.theme.colors.primary),
        );
        Navigator.of(context).pop();
        return;
      }

      // Active session → join directly without showing a sheet
      if (result.hasActiveSession && result.sessionPreview != null) {
        await _joinSessionDirect(result.roomId);
        return;
      }

      _showScanResult(result);
    } catch (e) {
      if (mounted) {
        _showInvalidQr();
        _resumeScanning();
      }
    }
  }

  void _showInvalidQr() {
    final l10n = AppLocalizations.of(context)!;
    showFToast(
      context: context,
      title: Text(l10n.invalidQrCode),
      icon: Icon(FIcons.circleX, color: context.theme.colors.destructive),
    );
  }

  /// A table has no session to join — scanning just remembers where the
  /// customer is sitting so their next order carries the table.
  Future<void> _handleTableScan(int tableId) async {
    try {
      final table = await ref.read(tableRepositoryProvider).getTable(tableId);

      if (!mounted) return;

      if (!table.isActive) {
        final l10n = AppLocalizations.of(context)!;
        showFToast(
          context: context,
          title: Text(l10n.tableUnavailable),
          icon: Icon(FIcons.circleX, color: context.theme.colors.destructive),
        );
        _resumeScanning();
        return;
      }

      // The QR belongs to a specific branch — switch to it
      final currentBranchId = ref.read(selectedBranchIdProvider);
      if (table.branchId != currentBranchId) {
        ref.read(branchProvider.notifier).selectBranch(table.branchId);
      }

      await ref.read(currentTableProvider.notifier).setTable(
            CurrentTable(
              id: table.id,
              name: table.name,
              branchId: table.branchId,
              scannedAt: DateTime.now(),
            ),
          );

      if (!mounted) return;
      _showTableScanResult(table);
    } catch (e) {
      if (mounted) {
        _showInvalidQr();
        _resumeScanning();
      }
    }
  }

  void _showTableScanResult(CafeTable table) {
    final l10n = AppLocalizations.of(context)!;
    final colors = context.theme.colors;

    showModalBottomSheet(
      context: context,
      backgroundColor: colors.background,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (sheetContext) {
        return Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: colors.mutedForeground.withValues(alpha: 0.25),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 16),

              AppText(
                l10n.youAreAtTable(table.name.localized(context)),
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: colors.foreground,
                ),
              ),
              const SizedBox(height: 8),
              AppText(
                l10n.orderDeliveredToTable,
                style: TextStyle(
                  fontSize: 14,
                  color: colors.mutedForeground,
                ),
              ),

              const SizedBox(height: 16),

              SizedBox(
                width: double.infinity,
                child: FButton(
                  onPress: () {
                    Navigator.of(sheetContext).pop(); // close sheet
                    Navigator.of(context).pop(); // close QR screen
                  },
                  child: Text(l10n.browseMenu),
                ),
              ),
            ],
          ),
        );
      },
    ).whenComplete(() {
      if (mounted && _isProcessing) {
        _resumeScanning();
      }
    });
  }

  void _resumeScanning() {
    setState(() => _isProcessing = false);
    _scannerController.start();
  }

  Future<void> _joinSessionDirect(int roomId) async {
    final l10n = AppLocalizations.of(context)!;
    try {
      final service = ref.read(roomRepositoryProvider);
      await service.joinSessionByRoom(roomId);

      if (!mounted) return;

      ref.read(mySessionsProvider.notifier).refresh();
      final branchId = ref.read(selectedBranchIdProvider);
      if (branchId != null) ref.invalidate(roomsProvider(branchId));

      Navigator.of(context).pop();
      showFToast(
        context: context,
        title: Text(l10n.joinedSession),
        icon: Icon(FIcons.check, color: AppTheme.successColor),
      );
    } catch (e) {
      if (mounted) {
        showFToast(
          context: context,
          title: Text(l10n.failedToJoinSession),
          icon: Icon(FIcons.circleX, color: context.theme.colors.destructive),
        );
        _resumeScanning();
      }
    }
  }

  void _showScanResult(RoomScanResult result) {
    final l10n = AppLocalizations.of(context)!;
    final colors = context.theme.colors;

    showModalBottomSheet(
      context: context,
      backgroundColor: colors.background,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (sheetContext) {
        return Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Handle bar
              Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: colors.mutedForeground.withValues(alpha: 0.25),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 16),

              // Room name + status badge in one row
              Row(
                children: [
                  Expanded(
                    child: AppText(
                      result.roomName.localized(context),
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: colors.foreground,
                      ),
                    ),
                  ),
                  _buildStatusBadge(result, l10n, colors),
                ],
              ),

              const SizedBox(height: 16),

              // Action button (only for available rooms)
              if (result.displayStatus == RoomDisplayStatus.available)
                SizedBox(
                  width: double.infinity,
                  child: FButton(
                    onPress: () => _reserveRoom(result.roomId, sheetContext),
                    child: Text(l10n.reserveThisRoom),
                  ),
                ),
            ],
          ),
        );
      },
    ).whenComplete(() {
      if (mounted && _isProcessing) {
        _resumeScanning();
      }
    });
  }

  Widget _buildStatusBadge(RoomScanResult result, AppLocalizations l10n, dynamic colors) {
    final Color color;
    final String label;

    if (result.displayStatus == RoomDisplayStatus.available) {
      color = AppTheme.successColor;
      label = l10n.available;
    } else {
      color = colors.mutedForeground as Color;
      label = l10n.roomNotAvailable;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 7,
            height: 7,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 6),
          AppText(
            label,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _reserveRoom(int roomId, BuildContext sheetContext) async {
    final l10n = AppLocalizations.of(context)!;

    try {
      final service = ref.read(roomRepositoryProvider);
      await service.reserveRoom(roomId);

      if (!mounted) return;

      // Refresh sessions
      ref.read(mySessionsProvider.notifier).refresh();
      final branchId = ref.read(selectedBranchIdProvider);
      if (branchId != null) ref.invalidate(roomsProvider(branchId));

      Navigator.of(sheetContext).pop(); // close bottom sheet
      Navigator.of(context).pop(); // close QR screen

      SoundService.instance.playSuccess();
      showFToast(
        context: context,
        title: Text(l10n.roomReservedSuccessQr),
        icon: Icon(FIcons.check, color: AppTheme.successColor),
      );
    } catch (e) {
      if (mounted) {
        showFToast(
          context: context,
          title: Text(l10n.failedToReserveRoom),
          icon: Icon(FIcons.circleX, color: context.theme.colors.destructive),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: AppText(
          l10n.scanToJoin,
          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
        ),
        centerTitle: true,
      ),
      body: Stack(
        children: [
          // Camera
          MobileScanner(
            controller: _scannerController,
            onDetect: _onDetect,
          ),

          // Overlay with cutout
          _ScanOverlay(hint: l10n.pointCameraAtRoomOrTableQr),

          // Loading indicator
          if (_isProcessing)
            Center(
              child: Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: Colors.black54,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const CircularProgressIndicator(color: Colors.white),
              ),
            ),
        ],
      ),
    );
  }
}

class _ScanOverlay extends StatelessWidget {
  final String hint;

  const _ScanOverlay({required this.hint});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final scanAreaSize = constraints.maxWidth * 0.7;
        final top = (constraints.maxHeight - scanAreaSize) / 2 - 40;

        return Stack(
          children: [
            // Semi-transparent overlay
            ColorFiltered(
              colorFilter: const ColorFilter.mode(
                Colors.black54,
                BlendMode.srcOut,
              ),
              child: Stack(
                children: [
                  Container(
                    decoration: const BoxDecoration(
                      color: Colors.black,
                      backgroundBlendMode: BlendMode.dstOut,
                    ),
                  ),
                  Center(
                    child: Transform.translate(
                      offset: const Offset(0, -40),
                      child: Container(
                        width: scanAreaSize,
                        height: scanAreaSize,
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(20),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // Corner decorations
            Center(
              child: Transform.translate(
                offset: const Offset(0, -40),
                child: SizedBox(
                  width: scanAreaSize,
                  height: scanAreaSize,
                  child: CustomPaint(
                    painter: _CornerPainter(),
                  ),
                ),
              ),
            ),

            // Hint text
            Positioned(
              left: 0,
              right: 0,
              top: top + scanAreaSize + 60,
              child: Center(
                child: AppText(
                  hint,
                  style: const TextStyle(
                    color: Colors.white70,
                    fontSize: 16,
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

class _CornerPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white
      ..strokeWidth = 3
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    const cornerLength = 30.0;
    const radius = 20.0;

    // Top-left
    canvas.drawArc(
      const Rect.fromLTWH(0, 0, radius * 2, radius * 2),
      3.14159, // pi
      1.5708,  // pi/2
      false,
      paint,
    );
    canvas.drawLine(const Offset(0, radius), const Offset(0, cornerLength), paint);
    canvas.drawLine(const Offset(radius, 0), Offset(cornerLength, 0), paint);

    // Top-right
    canvas.drawArc(
      Rect.fromLTWH(size.width - radius * 2, 0, radius * 2, radius * 2),
      -1.5708, // -pi/2
      1.5708,
      false,
      paint,
    );
    canvas.drawLine(Offset(size.width, radius), Offset(size.width, cornerLength), paint);
    canvas.drawLine(Offset(size.width - radius, 0), Offset(size.width - cornerLength, 0), paint);

    // Bottom-left
    canvas.drawArc(
      Rect.fromLTWH(0, size.height - radius * 2, radius * 2, radius * 2),
      1.5708, // pi/2
      1.5708,
      false,
      paint,
    );
    canvas.drawLine(Offset(0, size.height - radius), Offset(0, size.height - cornerLength), paint);
    canvas.drawLine(Offset(radius, size.height), Offset(cornerLength, size.height), paint);

    // Bottom-right
    canvas.drawArc(
      Rect.fromLTWH(size.width - radius * 2, size.height - radius * 2, radius * 2, radius * 2),
      0,
      1.5708,
      false,
      paint,
    );
    canvas.drawLine(Offset(size.width, size.height - radius), Offset(size.width, size.height - cornerLength), paint);
    canvas.drawLine(Offset(size.width - radius, size.height), Offset(size.width - cornerLength, size.height), paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

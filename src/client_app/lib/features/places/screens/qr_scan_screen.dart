import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../../../core/models/localized_text.dart';
import '../../../core/brand/brand_provider.dart';
import '../../../core/providers/branch_provider.dart';
import '../../../core/providers/current_place_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_text.dart';
import '../../../l10n/app_localizations.dart';
import '../models/place.dart';
import '../services/place_service.dart';
import 'places_screen.dart';

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

  /// The place id in a sticker's https://chillax.site/p/{id}
  int? _parsePlaceId(String url) {
    final uri = Uri.tryParse(url);
    if (uri == null) return null;
    if (uri.host != 'chillax.site') return null;
    final segments = uri.pathSegments;
    if (segments.length != 2 || segments[0] != 'p') return null;
    return int.tryParse(segments[1]);
  }

  Future<void> _onDetect(BarcodeCapture capture) async {
    if (_isProcessing) return;
    final barcode = capture.barcodes.firstOrNull;
    if (barcode == null || barcode.rawValue == null) return;

    final placeId = _parsePlaceId(barcode.rawValue!);
    if (placeId == null) {
      _showInvalidQr();
      return;
    }

    setState(() => _isProcessing = true);
    _scannerController.stop();

    try {
      await _handlePlace(placeId);
    } catch (e) {
      if (mounted) {
        _showInvalidQr();
        _resumeScanning();
      }
    }
  }

  /// What the place is decides what scanning it does: a place that only
  /// takes orders is remembered as where the customer sits and the scanner
  /// closes on the menu; a timed place joins the clock running there, or
  /// offers a hold. A timed table is both.
  Future<void> _handlePlace(int placeId) async {
    final l10n = AppLocalizations.of(context)!;
    final place = await ref.read(placeRepositoryProvider).getPlace(placeId);
    if (!mounted) return;

    if (!place.isActive) {
      showFToast(
        context: context,
        title: Text(l10n.tableUnavailable),
        icon: Icon(FIcons.circleX, color: context.theme.colors.destructive),
      );
      _resumeScanning();
      return;
    }

    if (place.kind == PlaceKind.table) {
      await _rememberTable(place);
      if (!mounted) return;
    }

    if (place.options.isEmpty) {
      // Someone scanning a table code wants the menu, so close the scanner and
      // confirm with a toast rather than making them tap through a sheet.
      Navigator.of(context).pop();
      showFToast(
        context: context,
        title: Text(l10n.youAreAtTable(place.name.localized(context))),
        // Where they are sitting, not an operation that succeeded — a seat
        // reads better here than a green tick.
        icon: Icon(FIcons.armchair, color: context.theme.colors.primary),
      );
      return;
    }

    final result = await ref.read(placeRepositoryProvider).scanPlace(placeId);
    if (!mounted) return;

    // Auto-switch branch if the place belongs to a different branch
    final currentBranchId = ref.read(selectedBranchIdProvider);
    if (result.branchId != currentBranchId) {
      ref.read(branchProvider.notifier).selectBranch(result.branchId);
    }

    if (result.isAlreadyMember) {
      showFToast(
        context: context,
        title: Text(l10n.alreadyInSession),
        icon: Icon(FIcons.info, color: context.theme.colors.primary),
      );
      Navigator.of(context).pop();
      return;
    }

    // A clock is running → join it directly without showing a sheet
    if (result.hasActiveSession) {
      await _joinSessionDirect(result.placeId);
      return;
    }

    _showScanResult(result);
  }

  /// A scanned table is where the next order goes, clock or no clock
  Future<void> _rememberTable(Place place) async {
    final currentBranchId = ref.read(selectedBranchIdProvider);
    final branchId = currentBranchId ?? 1;
    await ref.read(currentPlaceProvider.notifier).setPlace(
          CurrentPlace(
            id: place.id,
            kind: place.kind,
            name: place.name,
            branchId: branchId,
            scannedAt: DateTime.now(),
          ),
        );
  }

  void _showInvalidQr() {
    final l10n = AppLocalizations.of(context)!;
    showFToast(
      context: context,
      title: Text(l10n.invalidQrCode),
      icon: Icon(FIcons.circleX, color: context.theme.colors.destructive),
    );
  }

  void _resumeScanning() {
    setState(() => _isProcessing = false);
    _scannerController.start();
  }

  Future<void> _joinSessionDirect(int roomId) async {
    final l10n = AppLocalizations.of(context)!;
    try {
      final service = ref.read(placeRepositoryProvider);
      await service.joinStay(roomId);

      if (!mounted) return;

      ref.read(myStaysProvider.notifier).refresh();
      final branchId = ref.read(selectedBranchIdProvider);
      if (branchId != null) ref.invalidate(placesProvider(branchId));

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

  void _showScanResult(PlaceScanResult result) {
    final l10n = AppLocalizations.of(context)!;

    if (!result.canReserve || !ref.read(featuresProvider).reservations || result.displayStatus != PlaceStatus.available) {
      showFToast(
        context: context,
        title: Text(l10n.roomNotAvailable),
        icon: Icon(FIcons.info, color: context.theme.colors.primary),
      );
      _resumeScanning();
      return;
    }

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => HoldSheet(room: result.toPlace()),
    ).whenComplete(() {
      if (!mounted) return;
      // Held or not, the customer is done scanning: the rooms tab shows the hold
      Navigator.of(context).pop();
    });
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
          ScanOverlay(hint: l10n.pointCameraAtRoomOrTableQr),

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

/// The dimmed camera with a cut-out square and a hint under it, shared by
/// the place scanner and the claim scanner
class ScanOverlay extends StatelessWidget {
  final String hint;

  const ScanOverlay({super.key, required this.hint});

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

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import '../../../l10n/app_localizations.dart';
import '../services/table_service.dart';

/// LEGACY(places): the /table/{id} sticker landing (resolves the old table id
/// through /api/tables) — remove when the printed room/table stickers are
/// reprinted with /p/{id}.
///
/// Landing for an older table QR that opened the app as an App Link
/// (https://chillax.site/table/{id}, with the id the table had before the
/// Places remodel). It resolves the place behind it and continues on the
/// place page, which does the rest.
class TableLinkScreen extends ConsumerStatefulWidget {
  final int tableId;

  const TableLinkScreen({super.key, required this.tableId});

  @override
  ConsumerState<TableLinkScreen> createState() => _TableLinkScreenState();
}

class _TableLinkScreenState extends ConsumerState<TableLinkScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _resolve());
  }

  Future<void> _resolve() async {
    try {
      final table = await ref.read(tableRepositoryProvider).getTable(widget.tableId);
      if (!mounted) return;
      context.go('/p/${table.placeId}');
    } catch (_) {
      if (!mounted) return;
      context.go('/menu');
      showFToast(
        context: context,
        title: Text(AppLocalizations.of(context)!.invalidQrCode),
        icon: Icon(FIcons.circleX, color: context.theme.colors.destructive),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    // Only on screen for the moment the lookup takes
    return const Scaffold(body: Center(child: CircularProgressIndicator()));
  }
}

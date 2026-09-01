import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import '../../../core/models/localized_text.dart';
import '../../../core/providers/branch_provider.dart';
import '../../../core/providers/current_table_provider.dart';
import '../../../l10n/app_localizations.dart';
import '../services/table_service.dart';

/// Landing for a scanned table QR that opened the app as an App Link
/// (https://chillax.site/table/{id}).
///
/// Deliberately not a page the customer reads: it resolves the table, remembers
/// where they are sitting, and sends them to the menu with a toast - the same
/// shape as the in-app scanner and the web client.
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
    final l10n = AppLocalizations.of(context)!;

    try {
      final table =
          await ref.read(tableRepositoryProvider).getTable(widget.tableId);

      if (!mounted) return;

      if (!table.isActive) {
        _leave(l10n.tableUnavailable, isError: true);
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
      _leave(l10n.youAreAtTable(table.name.localized(context)));
    } catch (_) {
      if (mounted) _leave(l10n.invalidQrCode, isError: true);
    }
  }

  void _leave(String message, {bool isError = false}) {
    context.go('/menu');
    showFToast(
      context: context,
      title: Text(message),
      // A seat, not a green tick: this says where they are sitting rather than
      // reporting that an operation succeeded.
      icon: Icon(
        isError ? FIcons.circleX : FIcons.armchair,
        color: isError
            ? context.theme.colors.destructive
            : context.theme.colors.primary,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    // Only on screen for the moment the lookup takes
    return const Scaffold(body: Center(child: CircularProgressIndicator()));
  }
}

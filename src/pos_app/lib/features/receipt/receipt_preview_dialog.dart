import '../../core/brand/brand_provider.dart';
import '../../core/providers/branch_provider.dart';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import 'package:shimmer/shimmer.dart';
import '../../core/models/money.dart';
import '../../core/network/api_errors.dart';
import '../../core/printing/brand_logo.dart';
import '../../core/printing/print_service.dart';
import '../../core/widgets/pos_toast.dart';
import '../../l10n/app_localizations.dart';
import '../tickets/models/ticket_detail.dart';
import '../tickets/providers/tickets_provider.dart';
import 'receipt_sheet.dart';

/// The receipt as the printer will lay it down, on screen: the same sheet
/// widget the print job rasterizes, scaled to fit the dialog. From here
/// the cashier reprints it or opens the bill behind it (for a credit note).
Future<void> showReceiptPreview(BuildContext context, int ticketId) {
  return showFDialog<void>(
    context: context,
    useRootNavigator: true,
    builder: (context, style, animation) => FDialog.raw(
      style: style,
      animation: animation,
      constraints: const BoxConstraints(maxWidth: 448),
      builder: (context, _) => _ReceiptPreview(ticketId: ticketId),
    ),
  );
}

class _ReceiptPreview extends ConsumerStatefulWidget {
  final int ticketId;
  const _ReceiptPreview({required this.ticketId});

  @override
  ConsumerState<_ReceiptPreview> createState() => _ReceiptPreviewState();
}

class _ReceiptPreviewState extends ConsumerState<_ReceiptPreview> {
  bool _printing = false;

  Future<void> _print(TicketDetail ticket) async {
    final l10n = AppLocalizations.of(context)!;
    setState(() => _printing = true);
    try {
      await ref.read(printServiceProvider).printReceipt(ticket, l10n: l10n, locale: Localizations.localeOf(context));
      if (mounted) showPosToast(context, PosToastType.success, l10n.printed);
    } catch (e) {
      if (mounted) showPosToast(context, PosToastType.error, describePrintError(e, l10n));
    } finally {
      if (mounted) setState(() => _printing = false);
    }
  }

  void _openBill() {
    Navigator.of(context, rootNavigator: true).pop();
    context.go('/ticket/${widget.ticketId}?from=receipts');
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final locale = Localizations.localeOf(context);
    final ticket = ref.watch(ticketProvider(widget.ticketId));
    final number = ticket.value?.receiptNumber;
    // The café's brand, as the printer lays it down
    final brand = ref.watch(brandProvider);

    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            number == null ? l10n.receipts : l10n.receiptNumber(number),
            style: theme.typography.xl.copyWith(fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 16),
          // The sheet is laid out at paper width and shrunk to the dialog;
          // the paper stays white in dark mode, as paper does
          Flexible(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: SingleChildScrollView(
                child: ticket.when(
                  loading: () => Shimmer.fromColors(
                    baseColor: theme.colors.muted,
                    highlightColor: theme.colors.background,
                    child: Container(height: 320, color: theme.colors.muted),
                  ),
                  error: (e, _) => Padding(
                    padding: const EdgeInsets.symmetric(vertical: 48),
                    child: Text(describeError(e, l10n),
                        textAlign: TextAlign.center,
                        style: theme.typography.base.copyWith(color: theme.colors.mutedForeground)),
                  ),
                  data: (ticket) => FutureBuilder<ui.Image?>(
                    future: brandLogo(brand.receiptImageUrl),
                    builder: (context, logo) => FittedBox(
                      fit: BoxFit.scaleDown,
                      alignment: Alignment.topCenter,
                      child: SizedBox(
                        width: receiptWidth,
                        child: ReceiptSheet(
                            ticket: ticket,
                            l10n: l10n,
                            locale: locale,
                            money: MoneyFormat(brand.locale.currency, locale),
                            brandName: brand.displayName(locale),
                            logo: logo.data,
                            branch: ref.watch(branchProvider).selectedBranch),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              SizedBox(
                height: 48,
                child: FButton(
                  variant: FButtonVariant.outline,
                  onPress: _openBill,
                  child: Text(l10n.openBill),
                ),
              ),
              const Spacer(),
              SizedBox(
                height: 48,
                child: FButton(
                  variant: FButtonVariant.outline,
                  onPress: () => Navigator.of(context, rootNavigator: true).pop(),
                  child: Text(l10n.close),
                ),
              ),
              const SizedBox(width: 8),
              SizedBox(
                height: 48,
                child: FButton(
                  onPress: ticket.value == null || _printing ? null : () => _print(ticket.value!),
                  prefix: Icon(FIcons.printer, size: 20),
                  child: Text(l10n.print),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

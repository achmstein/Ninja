import '../../core/brand/brand_provider.dart';
import 'package:ninja_app_core/providers/branch_provider.dart';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import 'package:shimmer/shimmer.dart';
import '../../core/layout/breakpoints.dart';
import '../../core/models/money.dart';
import '../../core/network/api_errors.dart';
import '../../core/printing/brand_logo.dart';
import '../../core/printing/print_service.dart';
import '../../core/widgets/pos_dialog.dart';
import '../../core/widgets/pos_toast.dart';
import '../../l10n/app_localizations.dart';
import '../tickets/models/ticket_detail.dart';
import '../tickets/providers/tickets_provider.dart';
import 'receipt_sheet.dart';
import '../../core/theme/type_roles.dart';

/// The receipt as the printer will lay it down, on screen: the same sheet
/// widget the print job rasterizes, scaled to fit the dialog. From here
/// the cashier reprints it or opens the bill behind it (for a credit note).
Future<void> showReceiptPreview(BuildContext context, int ticketId) {
  return showFDialog<void>(
    context: context,
    useRootNavigator: true,
    builder: (context, style, animation) => DialogPanel(
      style: style,
      animation: animation,
      builder: (context) => ReceiptPreview(ticketId: ticketId),
    ),
  );
}

/// A receipt read on screen, with Print and the way to its bill. The body of
/// [showReceiptPreview]'s dialog; and [inline], the pane beside the receipts
/// list on a wide screen, where it fills the height it is given and has no
/// Close: there is nothing to close, another receipt is a tap on the list.
class ReceiptPreview extends ConsumerStatefulWidget {
  final int ticketId;
  final bool inline;
  const ReceiptPreview({super.key, required this.ticketId, this.inline = false});

  @override
  ConsumerState<ReceiptPreview> createState() => _ReceiptPreviewState();
}

class _ReceiptPreviewState extends ConsumerState<ReceiptPreview> {
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
    if (!widget.inline) Navigator.of(context, rootNavigator: true).pop();
    context.go('/ticket/${widget.ticketId}?from=receipts');
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final locale = Localizations.localeOf(context);
    final ticket = ref.watch(ticketProvider(widget.ticketId));
    final number = ticket.value?.receiptNumber;
    // The business's brand, as the printer lays it down
    final brand = ref.watch(brandProvider);

    final openBill = SizedBox(
      height: Sizes.control,
      child: FButton(
        variant: FButtonVariant.outline,
        onPress: _openBill,
        child: Text(l10n.openBill),
      ),
    );
    final close = SizedBox(
      height: Sizes.control,
      child: FButton(
        variant: FButtonVariant.outline,
        onPress: () => Navigator.of(context, rootNavigator: true).pop(),
        child: Text(l10n.close),
      ),
    );
    final print = SizedBox(
      height: Sizes.control,
      child: FButton(
        onPress: ticket.value == null || _printing ? null : () => _print(ticket.value!),
        prefix: Icon(FIcons.printer, size: Sizes.icon),
        child: Text(l10n.print),
      ),
    );

    final inline = widget.inline;
    Widget fitted(Widget sheet) => inline ? Expanded(child: sheet) : Flexible(child: sheet);
    return Padding(
      padding: EdgeInsets.all(inline ? 16 : 24),
      child: Column(
        mainAxisSize: inline ? MainAxisSize.max : MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            number == null ? l10n.receipts : l10n.receiptNumber(number),
            style: theme.type.title,
          ),
          const SizedBox(height: 16),
          // The sheet is laid out at paper width and shrunk to the dialog;
          // the paper stays white in dark mode, as paper does
          fitted(
            ClipRRect(
              borderRadius: BorderRadius.circular(Sizes.radius),
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
                        style: theme.type.body.copyWith(color: theme.colors.mutedForeground)),
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
          // Beside the list there is nothing to close
          if (inline)
            Row(children: [openBill, const Spacer(), print])
          // Three across are wider than a phone's dialog: there Print takes
          // the first row and the other two share the next
          else if (context.isCompact) ...[
            print,
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(child: openBill),
                const SizedBox(width: 8),
                Expanded(child: close),
              ],
            ),
          ] else
            Row(
              children: [
                openBill,
                const Spacer(),
                close,
                const SizedBox(width: 8),
                print,
              ],
            ),
        ],
      ),
    );
  }
}

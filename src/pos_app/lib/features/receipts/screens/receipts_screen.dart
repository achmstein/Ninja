import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import '../../../core/widgets/skeleton.dart';
import '../../../core/models/dates.dart';
import 'package:ninja_app_core/models/localized_text.dart';
import '../../../core/models/money.dart';
import '../../../core/utils/bidi.dart';
import 'package:ninja_app_core/providers/branch_provider.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import '../../../l10n/app_localizations.dart';
import '../../floor/widgets/bill_card.dart' show ticketTypeIcon, ticketTypeLabel;
import '../../receipt/receipt_preview_dialog.dart';
import '../widgets/receipt_pane.dart';
import '../../tickets/models/settled_ticket_summary.dart';
import '../../tickets/services/tickets_service.dart';
import '../../../core/theme/type_roles.dart';

const _pageSize = 50;
const _searchDebounce = Duration(milliseconds: 250);

/// The bills that have closed, newest receipt first — the way back to one
/// after it left the floor, to reprint it or issue a credit note against
/// it. Typing a receipt number finds that one; otherwise the recent ones
/// show, a page at a time as the cashier scrolls. `/settled` has no total
/// count, so a full page means "maybe more" and a short page is the end.
///
/// On a wide screen a receipt is read where it is picked, as on the web till:
/// the list keeps its place and the receipt shows beside it (the newest to
/// begin with). Looking for one bill among a night's meant opening each in a
/// pop-up and closing it again. A narrow screen still opens it over the list.
// A receipt row's shape: the number, the type icon, then the place and meta.
Widget _receiptRowSkeleton(BuildContext context) {
  return SizedBox(
    height: Sizes.header,
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: Row(
        children: [
          SizedBox(width: 44, child: skeletonBar(context, widthFactor: 1, height: 14)),
          const SizedBox(width: 12),
          skeletonBox(context, width: 20, height: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                skeletonBar(context, widthFactor: 0.5, height: 13),
                const SizedBox(height: 8),
                skeletonBar(context, widthFactor: 0.35, height: 11),
              ],
            ),
          ),
          const SizedBox(width: 12),
          SizedBox(width: 56, child: skeletonBar(context, widthFactor: 1, height: 16)),
        ],
      ),
    ),
  );
}

class ReceiptsScreen extends ConsumerStatefulWidget {
  const ReceiptsScreen({super.key});

  @override
  ConsumerState<ReceiptsScreen> createState() => _ReceiptsScreenState();
}

class _ReceiptsScreenState extends ConsumerState<ReceiptsScreen> {
  final _term = TextEditingController();
  Timer? _debounce;
  int? _receiptNumber;
  List<SettledTicketSummary>? _bills;
  bool _hasMore = false;
  bool _loading = false;
  bool _failed = false;
  int _generation = 0;

  /// The receipt being read beside the list; none until one is picked (the newest shows then)
  int? _pickedId;

  /// From this width the receipt shows beside the list (pos_web's `md` two columns, on a tablet's landscape)
  static const double _twoColumns = 900;

  @override
  void initState() {
    super.initState();
    _term.addListener(_onTermChanged);
    _load(reset: true);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _term.dispose();
    super.dispose();
  }

  void _onTermChanged() {
    _debounce?.cancel();
    _debounce = Timer(_searchDebounce, () {
      final digits = _term.text.trim();
      final number = RegExp(r'^\d+$').hasMatch(digits) ? int.parse(digits) : null;
      if (number == _receiptNumber) return;
      _receiptNumber = number;
      _load(reset: true);
    });
  }

  Future<void> _load({bool reset = false}) async {
    if (_loading && !reset) return;
    final generation = ++_generation;
    final pageIndex = reset ? 0 : (_bills!.length ~/ _pageSize);
    setState(() {
      _loading = true;
      _failed = false;
      if (reset) _bills = null;
    });
    try {
      final page = await ref
          .read(ticketsRepositoryProvider)
          .getSettledTickets(pageIndex: pageIndex, pageSize: _pageSize, receiptNumber: _receiptNumber);
      if (!mounted || generation != _generation) return;
      setState(() {
        _bills = [...?(reset ? null : _bills), ...page];
        _hasMore = page.length == _pageSize;
        _loading = false;
      });
    } catch (_) {
      if (!mounted || generation != _generation) return;
      setState(() {
        _loading = false;
        _failed = true;
        _bills ??= const [];
      });
    }
  }

  /// The first pages read again in place, after something was done to a receipt: its row says so,
  /// and the list neither empties nor loses the one being read
  Future<void> _refreshInPlace() async {
    final generation = ++_generation;
    try {
      final page = await ref
          .read(ticketsRepositoryProvider)
          .getSettledTickets(pageIndex: 0, pageSize: _pageSize, receiptNumber: _receiptNumber);
      if (!mounted || generation != _generation) return;
      final fresh = {for (final bill in page) bill.id: bill};
      setState(() => _bills = [for (final bill in _bills ?? const <SettledTicketSummary>[]) fresh[bill.id] ?? bill]);
    } catch (_) {
      // The row keeps what it said; the receipt beside it is already up to date
    }
  }

  static String _titleOf(BuildContext context, AppLocalizations l10n, SettledTicketSummary bill) {
    final placeName = bill.locationName?.localized(context) ?? '';
    return placeName.isNotEmpty ? placeName : (bill.label ?? ticketTypeLabel(l10n, bill.type));
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    // A branch switch starts the list over
    ref.listen(selectedBranchIdProvider, (_, _) => _load(reset: true));
    final bills = _bills;
    final width = MediaQuery.sizeOf(context).width;
    final wide = width >= _twoColumns;
    final rule = BorderSide(color: theme.colors.border);
    // Beside the list there is always a receipt to read: the one picked while it is still
    // listed, the newest otherwise
    final picked = bills?.where((bill) => bill.id == _pickedId).firstOrNull;
    final shown = picked ?? (wide && bills != null && bills.isNotEmpty ? bills.first : null);

    final list = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Built like the sale screen's heads (8 + 48 + 8), so the rule under it meets the one under the receipt's
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(border: Border(bottom: rule)),
          child: Row(
            children: [
              SizedBox.square(
                dimension: Sizes.control,
                child: FButton.icon(
                  variant: FButtonVariant.ghost,
                  onPress: () => context.go('/'),
                  child: Icon(FIcons.arrowLeft, size: Sizes.iconNav),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(child: Text(l10n.receipts, maxLines: 1, overflow: TextOverflow.ellipsis, style: theme.type.title)),
            ],
          ),
        ),
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(border: Border(bottom: rule)),
          child: FTextField(
            control: FTextFieldControl.managed(controller: _term),
            hint: l10n.searchReceiptNumber,
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            prefixBuilder: (context, style, _) => Padding(
              padding: const EdgeInsetsDirectional.only(start: 12),
              child: Icon(FIcons.search, size: Sizes.icon, color: theme.colors.mutedForeground),
            ),
            maxLines: 1,
          ),
        ),
        // Plain rows under thin rules, as the till lists everything else (customers, an order's
        // lines, who is paying): never a boxed card with rounded corners
        Expanded(
          child: NotificationListener<ScrollNotification>(
            // Reaching the end of the list pulls the next page
            onNotification: (notification) {
              if (_hasMore && !_loading && notification.metrics.extentAfter < 200) _load();
              return false;
            },
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (bills == null)
                    Skeleton(
                      child: Column(
                        children: [
                          for (var i = 0; i < 8; i++) ...[
                            _receiptRowSkeleton(context),
                            Container(height: 1, color: theme.colors.border),
                          ],
                        ],
                      ),
                    )
                  else if (bills.isEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 64, horizontal: 16),
                      child: Text(_failed ? l10n.somethingWentWrong : l10n.noReceipts,
                          textAlign: TextAlign.center,
                          style: theme.type.body.copyWith(color: theme.colors.mutedForeground)),
                    )
                  else
                    for (final bill in bills) ...[
                      _ReceiptRow(
                        bill: bill,
                        reading: wide && bill.id == shown?.id,
                        opensOver: !wide,
                        onTap: wide
                            ? () => setState(() => _pickedId = bill.id)
                            : () => showReceiptPreview(context, bill.id),
                      ),
                      Container(height: 1, color: theme.colors.border),
                    ],
                  if (_hasMore)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      child: Center(
                        child: _loading
                            ? const SizedBox.square(dimension: 24, child: CircularProgressIndicator(strokeWidth: 2))
                            : const SizedBox(height: 24),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      ],
    );

    if (!wide) {
      return Align(
        alignment: Alignment.topCenter,
        child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 768), child: list),
      );
    }
    // Two panels divided by a rule, across the whole screen, as the sale screen is: the list at a
    // width its rows read well at (narrower on a small tablet), and the receipt across all the rest
    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          width: (width * 0.32).clamp(320.0, 448.0),
          decoration: BoxDecoration(border: BorderDirectional(end: rule)),
          child: list,
        ),
        Expanded(
          child: shown == null
              ? Center(
                  child: Text(bills == null || _failed ? '' : l10n.noReceipts,
                      style: theme.type.body.copyWith(color: theme.colors.mutedForeground)),
                )
              : ReceiptPane(
                  key: ValueKey(shown.id),
                  ticketId: shown.id,
                  title: _titleOf(context, l10n, shown),
                  // The row says what went back: read again, without losing the place in the list
                  onChanged: _refreshInPlace,
                ),
        ),
      ],
    );
  }
}

class _ReceiptRow extends StatelessWidget {
  final SettledTicketSummary bill;
  final VoidCallback onTap;

  /// The receipt showing beside the list
  final bool reading;

  /// A tap opens the receipt over the list (a narrow screen): the arrow says so
  final bool opensOver;

  const _ReceiptRow({required this.bill, required this.onTap, this.reading = false, this.opensOver = true});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    const tabular = [FontFeature.tabularFigures()];
    final placeName = bill.locationName?.localized(context) ?? '';
    final title = placeName.isNotEmpty ? placeName : (bill.label ?? ticketTypeLabel(l10n, bill.type));
    final meta = [
      if (bill.settledAt != null) formatDateTime(context, bill.settledAt!),
      if (bill.refundedTotal > 0) '${l10n.refundedSoFar} −${money(context, bill.refundedTotal)}',
    ].join(' · ');

    return FTappable(
      onPress: onTap,
      builder: (context, states, child) => Container(
        height: Sizes.header,
        padding: const EdgeInsetsDirectional.only(start: 13, end: 16),
        // The one being read: tinted, and marked down its start edge
        decoration: BoxDecoration(
          color: reading
              ? theme.colors.secondary
              : states.contains(FTappableVariant.pressed)
                  ? theme.colors.secondary.withValues(alpha: 0.5)
                  : null,
          border: BorderDirectional(
            start: BorderSide(color: reading ? theme.colors.primary : Colors.transparent, width: 3),
          ),
        ),
        child: child,
      ),
      child: Row(
        children: [
          SizedBox(
            width: 56,
            child: Text(hashNumber(bill.receiptNumber),
                style: theme.type.heading.copyWith(fontFeatures: tabular)),
          ),
          Icon(ticketTypeIcon(bill.type), size: Sizes.icon, color: theme.colors.mutedForeground),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.type.body.copyWith(fontWeight: FontWeight.w500)),
                Text(meta,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.type.detail.copyWith(color: theme.colors.mutedForeground, fontFeatures: tabular)),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Text(money(context, bill.total),
              style: theme.type.heading.copyWith(fontFeatures: tabular)),
          if (opensOver) ...[
            const SizedBox(width: 8),
            Icon(FIcons.chevronRight, size: Sizes.icon, color: theme.colors.mutedForeground),
          ],
        ],
      ),
    );
  }
}

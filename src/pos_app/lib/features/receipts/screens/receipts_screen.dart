import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import 'package:shimmer/shimmer.dart';
import '../../../core/models/dates.dart';
import '../../../core/models/localized_text.dart';
import '../../../core/models/money.dart';
import '../../../core/providers/branch_provider.dart';
import '../../../l10n/app_localizations.dart';
import '../../floor/widgets/bill_card.dart' show ticketTypeIcon, ticketTypeLabel;
import '../../tickets/models/settled_ticket_summary.dart';
import '../../tickets/services/tickets_service.dart';

const _pageSize = 50;
const _searchDebounce = Duration(milliseconds: 250);

/// The bills that have closed, newest receipt first — the way back to one
/// after it left the floor, to reprint it or issue a credit note against
/// it. Typing a receipt number finds that one; otherwise the recent ones
/// show, a page at a time as the cashier scrolls. `/settled` has no total
/// count, so a full page means "maybe more" and a short page is the end.
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

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    // A branch switch starts the list over
    ref.listen(selectedBranchIdProvider, (_, _) => _load(reset: true));
    final bills = _bills;

    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 768),
        child: NotificationListener<ScrollNotification>(
          // Reaching the end of the list pulls the next page
          onNotification: (notification) {
            if (_hasMore && !_loading && notification.metrics.extentAfter < 200) _load();
            return false;
          },
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    SizedBox.square(
                      dimension: 48,
                      child: FButton.icon(
                        variant: FButtonVariant.ghost,
                        onPress: () => context.go('/'),
                        child: Icon(FIcons.arrowLeft, size: 24),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(l10n.receipts, style: theme.typography.xl.copyWith(fontWeight: FontWeight.w700)),
                  ],
                ),
                const SizedBox(height: 16),
                FTextField(
                  control: FTextFieldControl.managed(controller: _term),
                  hint: l10n.searchReceiptNumber,
                  keyboardType: TextInputType.number,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  prefixBuilder: (context, style, _) => Padding(
                    padding: const EdgeInsetsDirectional.only(start: 12),
                    child: Icon(FIcons.search, size: 20, color: theme.colors.mutedForeground),
                  ),
                  maxLines: 1,
                ),
                const SizedBox(height: 16),
                if (bills == null)
                  Shimmer.fromColors(
                    baseColor: theme.colors.muted,
                    highlightColor: theme.colors.background,
                    child: Container(
                      height: 192,
                      decoration: BoxDecoration(color: theme.colors.muted, borderRadius: BorderRadius.circular(14)),
                    ),
                  )
                else if (bills.isEmpty)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 64),
                    child: Text(_failed ? l10n.somethingWentWrong : l10n.noReceipts,
                        textAlign: TextAlign.center,
                        style: theme.typography.base.copyWith(color: theme.colors.mutedForeground)),
                  )
                else
                  Container(
                    decoration: BoxDecoration(
                      color: theme.colors.background,
                      border: Border.all(color: theme.colors.border),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: Column(
                      children: [
                        for (final (index, bill) in bills.indexed) ...[
                          if (index > 0) Container(height: 1, color: theme.colors.border),
                          _ReceiptRow(bill: bill, onTap: () => context.go('/ticket/${bill.id}?from=receipts')),
                        ],
                      ],
                    ),
                  ),
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
    );
  }
}

class _ReceiptRow extends StatelessWidget {
  final SettledTicketSummary bill;
  final VoidCallback onTap;

  const _ReceiptRow({required this.bill, required this.onTap});

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
        height: 64,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        color: states.contains(FTappableVariant.pressed) ? theme.colors.secondary.withValues(alpha: 0.5) : null,
        child: child,
      ),
      child: Row(
        children: [
          SizedBox(
            width: 56,
            child: Text('#${bill.receiptNumber}',
                style: theme.typography.base.copyWith(fontWeight: FontWeight.w600, fontFeatures: tabular)),
          ),
          Icon(ticketTypeIcon(bill.type), size: 20, color: theme.colors.mutedForeground),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.typography.base.copyWith(fontWeight: FontWeight.w500)),
                Text(meta,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground, fontFeatures: tabular)),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Text(money(context, bill.total),
              style: theme.typography.lg.copyWith(fontWeight: FontWeight.w600, fontFeatures: tabular)),
          const SizedBox(width: 8),
          Icon(FIcons.chevronRight, size: 20, color: theme.colors.mutedForeground),
        ],
      ),
    );
  }
}

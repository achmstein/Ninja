import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import '../../../core/theme/text_styles.dart';
import '../../../l10n/app_localizations.dart';
import '../../tickets/models/enums.dart';
import '../tenders.dart';

/// The tender buttons, three to a row (two when Account joins). Shared by
/// the settle dialog and the tab-payment dialog.
class TenderGrid extends StatelessWidget {
  final List<PaymentTender> tenders;
  final PaymentTender selected;
  final ValueChanged<PaymentTender> onSelect;

  const TenderGrid({super.key, required this.tenders, required this.selected, required this.onSelect});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final columns = tenders.length == 4 ? 2 : 3;
    final rows = <List<PaymentTender>>[];
    for (var i = 0; i < tenders.length; i += columns) {
      rows.add(tenders.sublist(i, i + columns > tenders.length ? tenders.length : i + columns));
    }
    return Column(
      children: [
        for (final (rowIndex, row) in rows.indexed) ...[
          if (rowIndex > 0) const SizedBox(height: 8),
          Row(
            children: [
              for (final (index, tender) in row.indexed) ...[
                if (index > 0) const SizedBox(width: 8),
                Expanded(
                  child: SizedBox(
                    height: 44,
                    child: FButton(
                      variant: tender == selected ? null : FButtonVariant.outline,
                      onPress: () => onSelect(tender),
                      child: Text(tenderLabel(l10n, tender), style: theme.typography.base.forButton),
                    ),
                  ),
                ),
              ],
              // Keep a short last row aligned with the grid
              for (var i = row.length; i < columns; i++) ...[
                const SizedBox(width: 8),
                const Expanded(child: SizedBox()),
              ],
            ],
          ),
        ],
      ],
    );
  }
}

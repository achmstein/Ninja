import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import '../../core/theme/type_roles.dart';
import '../../l10n/app_localizations.dart';
import '../tickets/models/ticket_detail.dart';

/// A count as a bill writes it: whole numbers without their decimals
String qtyText(double qty) => qty == qty.roundToDouble() ? qty.toStringAsFixed(0) : qty.toString();

/// What is said under a line with items cancelled: how many of how many
/// (just "Cancelled" when it went whole) and why. The web till's is the same
String cancelledNote(AppLocalizations l10n, TicketLineView line) {
  final what = line.cancelledWhole
      ? l10n.cancelledAll
      : l10n.cancelledSome(qtyText(line.cancelledQty), qtyText(line.originalQty));
  final reason = (line.cancelReason ?? '').trim();
  return reason.isEmpty ? what : '$what · $reason';
}

/// That note, in red, under the line's name
class CancelledNote extends StatelessWidget {
  final TicketLineView line;

  const CancelledNote(this.line, {super.key});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    return Text(
      cancelledNote(AppLocalizations.of(context)!, line),
      maxLines: 2,
      overflow: TextOverflow.ellipsis,
      style: theme.type.caption.copyWith(fontWeight: FontWeight.w500, color: theme.colors.destructive),
    );
  }
}

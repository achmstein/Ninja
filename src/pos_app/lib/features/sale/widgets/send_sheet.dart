import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/models/localized_text.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import '../../../core/models/money.dart';
import '../../../core/utils/bidi.dart';
import '../../../l10n/app_localizations.dart';
import '../models/sale_line.dart';
import 'customer_dialog.dart';
import '../../../core/theme/type_roles.dart';

/// The lines of a round that go for the next name: everything new, less
/// what was unticked to stay for somebody else
List<SaleLine> linesGoing(List<SaleLine> lines, Set<String> held) =>
    [for (final line in lines) if (!held.contains(line.key)) line];

/// Pressing Send on a table's or a room's bill: the one moment the till asks
/// who the round is for. The people already on the bill are one tap each,
/// anyone else is found by name, and "without a customer" is said outright.
///
/// Everything new is ticked. For a round that is more than one person's, the
/// items that are someone else's are unticked: a name sends what is ticked
/// for them, the rest stay, and the sheet asks again. Nothing is asked while
/// items are being rung up. The web till's SendSheet is the same.
///
/// It is the body of a dialog, and closes it once the whole round has gone.
class SendSheet extends StatefulWidget {
  /// What is new on the bill, not sent yet
  final List<SaleLine> lines;

  /// Everyone the bill already knows, offered first
  final List<SaleCustomer> people;

  /// Sends these lines for this person, or for nobody. False when they
  /// could not go, and nothing was taken off the sale
  final bool Function(List<SaleLine> lines, SaleCustomer? who) onSend;

  const SendSheet({super.key, required this.lines, required this.people, required this.onSend});

  @override
  State<SendSheet> createState() => _SendSheetState();
}

class _SendSheetState extends State<SendSheet> {
  /// What was unticked: these stay for the next name. Kept by line, so the
  /// rest are ticked again once a part is sent
  final Set<String> _held = {};

  void _send(SaleCustomer? who) {
    final going = linesGoing(widget.lines, _held);
    if (going.isEmpty) return;
    final everything = going.length == widget.lines.length;
    setState(_held.clear);
    if (widget.onSend(going, who) && everything) Navigator.of(context, rootNavigator: true).pop();
  }

  /// Someone the bill does not know yet, found by name: the round is theirs
  Future<void> _another() async {
    final picked = await showCustomerDialog(context);
    if (picked != null && mounted) _send(picked);
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final lines = widget.lines;
    final people = widget.people;
    final none = linesGoing(lines, _held).isEmpty;
    // One line cannot be split: it is shown, not ticked
    final splittable = lines.length > 1;
    const tabular = [FontFeature.tabularFigures()];

    Widget lineRow(SaleLine line) {
      final ticked = !_held.contains(line.key);
      final ink = ticked ? theme.colors.foreground : theme.colors.mutedForeground;
      final body = Container(
        constraints: const BoxConstraints(minHeight: Sizes.control),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Row(
          children: [
            if (splittable) ...[
              Container(
                width: 24,
                height: 24,
                decoration: BoxDecoration(
                  color: ticked ? theme.colors.primary : null,
                  border: Border.all(color: ticked ? theme.colors.primary : theme.colors.mutedForeground.withValues(alpha: 0.5)),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: ticked ? Icon(FIcons.check, size: Sizes.iconSmall, color: theme.colors.primaryForeground) : null,
              ),
              const SizedBox(width: 12),
            ],
            Text('${line.quantity}×', style: theme.type.body.copyWith(color: ink, fontFeatures: tabular)),
            const SizedBox(width: 6),
            Expanded(
              child: Text(line.name.localized(context),
                  maxLines: 1, overflow: TextOverflow.ellipsis, style: theme.type.body.copyWith(color: ink)),
            ),
            const SizedBox(width: 12),
            Text(money(context, line.total), style: theme.type.body.copyWith(color: ink, fontFeatures: tabular)),
          ],
        ),
      );
      if (!splittable) return body;
      return Semantics(
        checked: ticked,
        child: FTappable(
          onPress: () => setState(() => ticked ? _held.add(line.key) : _held.remove(line.key)),
          child: body,
        ),
      );
    }

    // A person's button: their whole name, in its own script, cut with an
    // ellipsis at what the button has room for (a button lays its words out
    // unbounded, so the room is said here)
    Widget personButton(SaleCustomer person, double room) {
      final name = person.name.isEmpty ? l10n.guest : person.name;
      return SizedBox(
        height: Sizes.controlLarge,
        child: FButton(
          variant: FButtonVariant.outline,
          onPress: none ? null : () => _send(person),
          child: ConstrainedBox(
            constraints: BoxConstraints(maxWidth: room),
            child: Text(name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textDirection: textDirectionFor(name),
                style: theme.type.mainAction),
          ),
        ),
      );
    }

    Widget another(double room) => SizedBox(
          height: Sizes.controlLarge,
          child: FButton(
            variant: FButtonVariant.outline,
            onPress: none ? null : _another,
            prefix: Icon(FIcons.userPlus, size: Sizes.icon, color: theme.colors.mutedForeground),
            child: ConstrainedBox(
              constraints: BoxConstraints(maxWidth: room - Sizes.icon - 12),
              child: Text(people.isNotEmpty ? l10n.sendWhoAnother : l10n.chooseCustomer,
                  maxLines: 1, overflow: TextOverflow.ellipsis, style: theme.type.button),
            ),
          ),
        );

    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(l10n.sendWhoTitle, style: theme.type.title),
          const SizedBox(height: 16),
          Flexible(
            child: Container(
              clipBehavior: Clip.antiAlias,
              decoration: BoxDecoration(
                border: Border.all(color: theme.colors.border),
                borderRadius: BorderRadius.circular(Sizes.radius),
              ),
              child: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    for (final (index, line) in lines.indexed) ...[
                      if (index > 0) Container(height: 1, color: theme.colors.border),
                      lineRow(line),
                    ],
                  ],
                ),
              ),
            ),
          ),
          if (splittable) ...[
            const SizedBox(height: 8),
            Text(l10n.sendWhoSplitHint, style: theme.type.detail.copyWith(color: theme.colors.mutedForeground)),
          ],
          const SizedBox(height: 16),
          // Two to a row, each the same width, so a long name is cut and never pushes its neighbour
          LayoutBuilder(
            builder: (context, constraints) {
              final width = (constraints.maxWidth - 8) / 2;
              // What a button's words have between its padding
              final room = width - 40;
              return Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final person in people) SizedBox(width: width, child: personButton(person, room)),
                  SizedBox(width: width, child: another(room)),
                ],
              );
            },
          ),
          const SizedBox(height: 8),
          SizedBox(
            height: Sizes.controlLarge,
            child: FButton(
              variant: FButtonVariant.secondary,
              onPress: none ? null : () => _send(null),
              child: Text(l10n.sendWhoNobody, style: theme.type.button),
            ),
          ),
        ],
      ),
    );
  }
}

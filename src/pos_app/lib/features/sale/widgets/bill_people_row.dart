import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import '../../../core/theme/type_roles.dart';
import '../../../l10n/app_localizations.dart';
import '../bill_people.dart';
import '../models/sale_line.dart';

/// A bill's people as the order's head shows them
typedef OrderPeople = ({
  List<SaleCustomer> all,

  /// The one what is rung up next is for; nobody when null
  SaleCustomer? forWho,

  /// A name tapped: theirs from now on, or let go of when it was already
  void Function(SaleCustomer? who) onForWho,

  /// A name held: their card
  void Function(SaleCustomer who) onHold,

  /// The button at the row's end: one more customer, found by name
  VoidCallback onAdd,
});

/// A bill's people over its order, one row that swipes: a tap and what is
/// rung up next is theirs (their usuals come up, their options are filled
/// in), a second tap lets go. The way to add one stays at the row's end.
/// Nothing has to be tapped: a round can be nobody's. The web till's
/// BillPeopleRow is the same.
class BillPeopleRow extends StatelessWidget {
  final OrderPeople people;
  final double height;
  const BillPeopleRow({super.key, required this.people, required this.height});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final none = people.all.isEmpty;
    final add = SizedBox(
      height: height,
      child: FButton(
        variant: FButtonVariant.outline,
        mainAxisSize: none ? MainAxisSize.max : MainAxisSize.min,
        onPress: people.onAdd,
        suffix: Icon(FIcons.plus, size: Sizes.iconSmall, color: theme.colors.mutedForeground),
        child: Text(none ? l10n.customer : l10n.anotherCustomer,
            style: theme.type.button.copyWith(color: theme.colors.mutedForeground)),
      ),
    );
    if (none) return add;
    return Row(
      children: [
        Expanded(
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                for (final (index, person) in people.all.indexed) ...[
                  if (index > 0) const SizedBox(width: 8),
                  _PersonChip(
                    name: person.name.isEmpty ? l10n.guest : person.name,
                    picked: samePerson(person, people.forWho),
                    height: height,
                    onTap: () => people.onForWho(samePerson(person, people.forWho) ? null : person),
                    onHold: () => people.onHold(person),
                  ),
                ],
              ],
            ),
          ),
        ),
        const SizedBox(width: 8),
        add,
      ],
    );
  }
}

/// One of a bill's people: a tap picks them, a hold opens their card
class _PersonChip extends StatelessWidget {
  final String name;
  final bool picked;
  final double height;
  final VoidCallback onTap;
  final VoidCallback onHold;
  const _PersonChip({required this.name, required this.picked, required this.height, required this.onTap, required this.onHold});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    return Semantics(
      button: true,
      selected: picked,
      child: FTappable(
        onPress: onTap,
        onLongPress: onHold,
        child: Container(
          height: height,
          constraints: const BoxConstraints(maxWidth: 200),
          padding: const EdgeInsets.symmetric(horizontal: 16),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: picked ? theme.colors.primary : null,
            border: Border.all(color: picked ? theme.colors.primary : theme.colors.border),
            borderRadius: BorderRadius.circular(Sizes.radius),
          ),
          child: Text(name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: theme.type.button.copyWith(color: picked ? theme.colors.primaryForeground : null)),
        ),
      ),
    );
  }
}

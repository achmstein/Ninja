import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../l10n/app_localizations.dart';
import '../customers/dialogs/customer_card_dialog.dart';
import '../places/models/place.dart';
import '../places/providers/places_provider.dart';
import '../places/stay_actions.dart';
import '../places/status.dart';
import '../tickets/providers/tickets_provider.dart';
import 'bill_people.dart';
import 'models/sale_line.dart';
import 'widgets/customer_dialog.dart';

/// The people of an open bill, as the order screen works with them: the
/// names over the order. The web till's `useBillPeople` is the same.
///
/// - **Who they are**: the room's members, whoever earlier rounds were rung
///   up for, and anyone [named] since the bill was opened here
///   ([billPeople]).
/// - **Whose the next items are** ([forWhoNow]): the name tapped, nobody once
///   it was let go of. Untouched, a bill that is one person's is theirs
///   without a tap. Their usuals and saved options follow from it.
/// - **Adding one** ([addPerson]): found by name, they join the names and
///   are picked; in a room they become a member at once, whether they order
///   or not.
/// - **Their card** ([holdPerson]): opened by holding a name; while the
///   room's clock runs, anyone but whoever it was started for can be taken
///   out from there.
///
/// A new sale ([billId] null) has no people: one optional customer, kept by
/// the sale itself.
mixin BillPeopleState<W extends ConsumerStatefulWidget> on ConsumerState<W> {
  /// The open bill; null for a new sale
  int? get billId;

  /// Rung onto an open bill, not a new sale
  bool get onBill => billId != null;

  /// Whose the next items are has changed: what follows from it starts over.
  /// Called inside the setState that changes it
  void whoChanged() {}

  /// Anyone named for this bill since it was opened here, the customer a tab
  /// was opened for (the new-tab dialog) first
  final List<SaleCustomer> named = [];

  SaleCustomer? _chosen;

  /// False until a name is tapped or let go of
  bool _choseWho = false;

  /// Whose the next items are, among the bill's [people]
  SaleCustomer? forWhoAmong(List<SaleCustomer> people) {
    if (billId == null) return null;
    if (!_choseWho) return people.length == 1 ? people.single : null;
    final chosen = _chosen;
    return chosen == null ? null : people.where((person) => samePerson(person, chosen)).firstOrNull;
  }

  /// The bill's room as it stands, for what a tap does
  Stay? get _stayNow {
    final id = billId;
    final sessionId = id == null ? null : ref.read(ticketProvider(id)).value?.sessionId;
    return sessionId == null ? null : ref.read(stayProvider(sessionId)).value;
  }

  /// Whose the next items are, as the bill stands, for what a tap does
  SaleCustomer? get forWhoNow {
    final id = billId;
    if (id == null) return null;
    final lines = ref.read(ticketProvider(id)).value?.lines ?? const [];
    return forWhoAmong(billPeople(_stayNow?.roster ?? const [], lines, named));
  }

  /// A name tapped: theirs from now on, or nobody's when [who] is null
  void pickWho(SaleCustomer? who) => setState(() {
        _chosen = who;
        _choseWho = true;
        whoChanged();
      });

  /// Somebody with an account named on a room's bill is in the room: their
  /// share of the time will need a tab at settle
  void joinRoom(SaleCustomer who) {
    final stay = _stayNow;
    final id = who.id ?? '';
    if (stay != null && id.isNotEmpty && !stay.roster.any((member) => member.id == id)) {
      StayActions(ref, context).addMember(stay.id, id, who.name);
    }
  }

  /// One more customer, found by name
  Future<void> addPerson() async {
    final picked = await showCustomerDialog(context);
    if (picked == null || !mounted) return;
    setState(() {
      if (!named.any((known) => samePerson(known, picked))) named.add(picked);
      _chosen = picked;
      _choseWho = true;
      whoChanged();
    });
    joinRoom(picked);
  }

  /// A name held: their card. Only somebody with an account has one
  void holdPerson(SaleCustomer who) {
    final id = who.id ?? '';
    if (id.isEmpty) return;
    final stay = _stayNow;
    final member = stay != null && stay.isRunning ? stay.members.where((m) => m.customerId == id).firstOrNull : null;
    showCustomerCard(
      context,
      id: id,
      name: who.name,
      phone: who.phone,
      addedAtCounter: who.addedAtCounter,
      action: stay == null || member == null || member.isOwner
          ? null
          : (
              label: AppLocalizations.of(context)!.removeFromRoom,
              onPress: () {
                if (!mounted) return;
                StayActions(ref, context).removeMember(stay.id, id);
                // Named here only: gone from the names too. Somebody with items on the bill stays among them
                setState(() {
                  named.removeWhere((person) => samePerson(person, who));
                  if (samePerson(_chosen, who)) _chosen = null;
                  whoChanged();
                });
              },
            ),
    );
  }
}

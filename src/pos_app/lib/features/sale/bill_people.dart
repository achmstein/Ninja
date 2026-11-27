import '../ticket/lines.dart';
import '../tickets/models/ticket_detail.dart';
import 'models/sale_line.dart';

/// Whether two customers are the same person: by account when either has
/// one, else by the name the till was told
bool samePerson(SaleCustomer? a, SaleCustomer? b) {
  if (a == null || b == null) return false;
  final aId = a.id ?? '';
  final bId = b.id ?? '';
  return aId.isNotEmpty || bId.isNotEmpty ? aId == bId : a.name.trim() == b.name.trim();
}

/// Everyone an open bill already knows, each once, in the order they came:
/// the room's people, whoever earlier rounds were rung up for (an account,
/// or a name the till was only told), then anyone named for it since. They
/// are the names over the order: one tapped, and what is rung up next is
/// theirs. The web till's `billPeople` is the same.
List<SaleCustomer> billPeople(
  List<({String id, String name})> roster,
  List<TicketLineView> lines, [
  List<SaleCustomer> extra = const [],
]) {
  final people = <SaleCustomer>[];
  void add(SaleCustomer person) {
    if (!people.any((known) => samePerson(known, person))) people.add(person);
  }

  for (final member in roster) {
    add(SaleCustomer(id: member.id, name: member.name));
  }
  for (final line in lines) {
    final id = line.customerId ?? '';
    final name = line.customerName ?? '';
    if (id.isNotEmpty) {
      add(SaleCustomer(id: id, name: name));
    } else if (name.isNotEmpty) {
      add(SaleCustomer(name: name));
    }
  }
  for (final person in extra) {
    add(person);
  }
  return people;
}

/// What is new on a bill, person by person in the order they first appear:
/// each goes to the kitchen and onto the bill as that person's round
List<({SaleCustomer? who, List<SaleLine> lines})> roundsByPerson(List<SaleLine> lines) {
  final rounds = <({SaleCustomer? who, List<SaleLine> lines})>[];
  for (final line in lines) {
    final who = line.who;
    final at = rounds.indexWhere((round) => who == null ? round.who == null : samePerson(round.who, who));
    if (at >= 0) {
      rounds[at].lines.add(line);
    } else {
      rounds.add((who: who, lines: [line]));
    }
  }
  return rounds;
}

/// What an open bill already holds, as the order screen lists it: the same
/// item ordered twice for the same person reads as one line, and one
/// person's two coffees add up without taking another's with them. What a
/// part payment already paid for stays apart from what is still to pay.
/// People stay in the order they first came.
List<({TicketLineView line, bool paid})> sentLinesByPerson(List<TicketLineView> lines) {
  String who(TicketLineView line) {
    final id = line.customerId ?? '';
    final name = line.customerName ?? '';
    return (id.isNotEmpty ? 'id:$id' : (name.isNotEmpty ? 'name:$name' : '')) + (line.paid ? '|paid' : '');
  }

  final byPerson = <String, List<TicketLineView>>{};
  for (final line in lines) {
    byPerson.putIfAbsent(who(line), () => []).add(line);
  }
  return [
    for (final theirs in byPerson.values)
      for (final line in mergeIdenticalLines(theirs)) (line: line, paid: theirs.first.paid),
  ];
}

/// The names as the row over the order writes them, one for each person in
/// order: the first name, which is how a cashier calls them and lets four fit
/// where one whole name did. Two people who share it are written by two
/// names, and by the whole of it if they still read alike. The whole name
/// stays on the order's lines and on the customer's card. The web till's
/// `shortNames` is the same.
List<String> shortNames(List<String> names) {
  final words = [for (final name in names) name.trim().split(RegExp(r'\s+')).where((w) => w.isNotEmpty).toList()];
  List<String> take(int count) => [for (final w in words) w.take(count).join(' ')];
  final first = take(1);
  final two = take(2);
  bool shared(List<String> list, int at) {
    for (var i = 0; i < list.length; i++) {
      if (i != at && list[i] == list[at]) return true;
    }
    return false;
  }

  return [
    for (final (at, name) in names.indexed)
      !shared(first, at) ? first[at] : (!shared(two, at) ? two[at] : name.trim()),
  ];
}

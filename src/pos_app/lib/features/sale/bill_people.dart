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
/// are who Send offers first when it asks whose round this is. The web
/// till's `billPeople` is the same.
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

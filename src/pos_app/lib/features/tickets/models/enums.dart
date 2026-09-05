/// TicketType as Sales.Domain numbers it: Room=0, Table=1, Counter=2.
/// The API takes the number; the read models spell the name.
enum TicketType {
  room(0, 'Room'),
  table(1, 'Table'),
  counter(2, 'Counter');

  final int value;
  final String name_;

  const TicketType(this.value, this.name_);

  static TicketType? fromName(String? name) {
    for (final type in values) {
      if (type.name_ == name) return type;
    }
    return null;
  }
}

/// PaymentTender as Sales.Domain numbers it: Cash=0, Card=1, InstaPay=2,
/// Account=3.
enum PaymentTender {
  cash(0, 'Cash'),
  card(1, 'Card'),
  instaPay(2, 'InstaPay'),
  account(3, 'Account');

  final int value;
  final String name_;

  const PaymentTender(this.value, this.name_);

  static PaymentTender fromName(String? name) {
    for (final tender in values) {
      if (tender.name_ == name) return tender;
    }
    return PaymentTender.cash;
  }
}

enum TicketStatus {
  open('Open'),
  settled('Settled'),
  voided('Voided');

  final String name_;

  const TicketStatus(this.name_);

  static TicketStatus fromName(String? name) {
    for (final status in values) {
      if (status.name_ == name) return status;
    }
    return TicketStatus.open;
  }
}

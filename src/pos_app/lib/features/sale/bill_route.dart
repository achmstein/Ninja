/// Whether a bill is a delivery's, read from its label ("#42 · Mona", as
/// Sales names it): Sales says nothing else about it
bool isDeliveryBill(String? label) => RegExp(r'^#\d+(\s·|$)').hasMatch(label?.trim() ?? '');

/// Where an open bill opens. A table's, a room's or a tab's is the order
/// screen, its lines beside the menu: the next round is one tap, and Settle
/// is at its foot. A delivery's bill is never added to, so it opens on its
/// own page.
String billRoute(int ticketId, {String? label}) => isDeliveryBill(label) ? '/ticket/$ticketId' : '/order/$ticketId';

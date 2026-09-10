import 'models/sale_line.dart';

/// The account a counter tab was opened for, kept until the sale pad opens
/// for that ticket and pre-selects it — the client-side "link" for a tab, so
/// the round lands on their account. The ticket has no customer field; this
/// seeds the same per-line attribution the till uses everywhere. Read once,
/// then removed. Lives for the app run (a shift).
final Map<int, SaleCustomer> pendingTicketCustomer = {};

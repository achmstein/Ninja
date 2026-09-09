namespace Chillax.Accounts.Domain.AggregatesModel.CustomerAccountAggregate;

/// <summary>
/// What put a line on the ledger. Staff key in manual charges and payments
/// with a free-text description; the till posts receipts and credit notes,
/// which carry their number instead of prose so every app can say
/// "receipt #7" in its own language. A tab payment taken at the till is
/// its own numbered slip too.
/// </summary>
public enum TransactionSource
{
    Manual = 0,
    PosReceipt = 1,
    PosCreditNote = 2,
    PosTabPayment = 3
}

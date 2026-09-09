namespace Chillax.Accounts.Domain.AggregatesModel.CustomerAccountAggregate;

/// <summary>
/// What put a line on the ledger. Staff key in manual charges and payments
/// with a free-text description; the till posts receipts and credit notes,
/// which carry their number instead of prose so every app can say
/// "receipt #7" in its own language.
/// </summary>
public enum TransactionSource
{
    Manual = 0,
    PosReceipt = 1,
    PosCreditNote = 2
}

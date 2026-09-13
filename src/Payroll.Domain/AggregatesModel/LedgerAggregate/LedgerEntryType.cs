namespace Chillax.Payroll.Domain.AggregatesModel.LedgerAggregate;

/// <summary>
/// What a ledger line is. Earned and Bonus raise what the café owes;
/// Deduction, Advance and Payment lower it.
/// </summary>
public enum LedgerEntryType
{
    Earned = 0,
    Bonus = 1,
    Deduction = 2,
    Advance = 3,
    Payment = 4,
}

/// <summary>Where a line came from: keyed in by hand, a payslip, or (later) the till.</summary>
public enum LedgerSource
{
    Manual = 0,
    Payslip = 1,
    TillPayOut = 2,
}

namespace Chillax.Finance.Domain.AggregatesModel.ExpenseAggregate;

/// <summary>Where the money came from: the drawer, the bank, or a partner's own pocket.</summary>
public enum PaidFrom
{
    Drawer = 0,
    Bank = 1,
    Partner = 2,
}

/// <summary>Where a line came from: keyed in by hand, or the till.</summary>
public enum FinanceSource
{
    Manual = 0,
    Till = 1,
    Purchase = 2,
    /// <summary>Posted by Finance itself from a recurring bill.</summary>
    Recurring = 3,
}

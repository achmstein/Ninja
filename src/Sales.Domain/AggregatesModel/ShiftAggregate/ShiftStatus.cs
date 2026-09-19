namespace Ninja.Sales.Domain.AggregatesModel.ShiftAggregate;

public enum ShiftStatus
{
    /// <summary>The drawer is live; settles stamp themselves onto this shift.</summary>
    Open = 0,

    /// <summary>Counted and frozen — the Z report.</summary>
    Closed = 1,
}

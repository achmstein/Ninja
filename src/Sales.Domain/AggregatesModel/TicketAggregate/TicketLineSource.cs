namespace Chillax.Sales.Domain.AggregatesModel.TicketAggregate;

public enum TicketLineSource
{
    /// <summary>A confirmed order's item (or its loyalty discount).</summary>
    Order = 0,

    /// <summary>Authoritative session time, appended when the session completes.</summary>
    SessionTime = 1,

    /// <summary>Keyed in by a cashier.</summary>
    Manual = 2,
}

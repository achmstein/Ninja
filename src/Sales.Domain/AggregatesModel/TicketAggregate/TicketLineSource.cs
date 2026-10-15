namespace Ninja.Sales.Domain.AggregatesModel.TicketAggregate;

public enum TicketLineSource
{
    /// <summary>A confirmed order's item (or its loyalty discount).</summary>
    Order = 0,

    /// <summary>Authoritative session time, appended when the session completes.</summary>
    SessionTime = 1,

    /// <summary>Keyed in by a cashier.</summary>
    Manual = 2,

    /// <summary>
    /// A delivery order's fee. It rides with the order's lines (billed, moved
    /// and refunded with them), but it is not a thing sold: reports keep it out
    /// of the items and count it on its own.
    /// </summary>
    DeliveryFee = 3,
}

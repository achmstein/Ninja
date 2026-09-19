namespace Ninja.Sales.Domain.AggregatesModel.TicketAggregate;

public enum TicketStatus
{
    /// <summary>Accumulating lines; shown on the POS floor.</summary>
    Open = 0,

    /// <summary>Paid and frozen; a receipt exists.</summary>
    Settled = 1,

    /// <summary>Cancelled with nothing owed. Owner-gated (phase 4).</summary>
    Voided = 2,
}

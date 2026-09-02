namespace Chillax.Loyalty.API.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of the credit note Sales issues against a settled ticket.
/// Loyalty reads only the per-order reversals: how much of each order's
/// menu value came back, against what it was worth.
/// </summary>
public record TicketRefundedIntegrationEvent : IntegrationEvent
{
    public int RefundId { get; init; }
    public int Number { get; init; }
    public int TicketId { get; init; }
    public List<RefundOrderReversal> OrderReversals { get; init; } = [];
}

public record RefundOrderReversal
{
    public int OrderId { get; init; }
    public decimal RefundedAmount { get; init; }
    public decimal OrderAmount { get; init; }
}

namespace Ninja.Loyalty.API.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of the void Sales announces for an open ticket. Nothing was
/// owed, so each order on it comes back in full: the reversals carry the
/// order's value on that ticket as both what came back and what it was worth.
/// </summary>
public record TicketVoidedIntegrationEvent : IntegrationEvent
{
    public int TicketId { get; init; }
    public string Reason { get; init; } = string.Empty;
    public List<RefundOrderReversal> OrderReversals { get; init; } = [];
}

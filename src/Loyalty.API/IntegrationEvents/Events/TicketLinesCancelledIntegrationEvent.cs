namespace Ninja.Loyalty.API.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of the event Sales publishes when items of an open bill are
/// cancelled after the kitchen had them. Loyalty reads only the per-order
/// reversals: the menu money that came off each order, against what the order
/// was worth on the bill as rung up.
/// </summary>
public record TicketLinesCancelledIntegrationEvent : IntegrationEvent
{
    public int TicketId { get; init; }
    public string Reason { get; init; } = string.Empty;
    public List<RefundOrderReversal> OrderReversals { get; init; } = [];
}

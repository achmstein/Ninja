using Chillax.EventBus.Events;

namespace Chillax.Loyalty.API.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of the event Sales publishes when a POS ticket settles.
/// Loyalty cares about the session-time portion only — the item portion
/// already accrued when each order was confirmed.
/// </summary>
public record TicketSettledIntegrationEvent(
    int TicketId,
    int BranchId,
    int ReceiptNumber,
    decimal Total,
    string? CustomerId,
    string? CustomerName,
    decimal AccountAmount,
    string? SettledBy,
    decimal TimeTotal) : IntegrationEvent;

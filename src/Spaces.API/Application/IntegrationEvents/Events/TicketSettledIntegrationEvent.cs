using Ninja.EventBus.Events;

namespace Ninja.Spaces.API.Application.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of the event Sales publishes when a ticket is paid. Same
/// type name as the source (the routing key), only the properties Spaces
/// reads: which session the receipt covered and how it was paid, so the
/// customer's session list can show its cost as settled.
/// </summary>
public record TicketSettledIntegrationEvent(
    int TicketId,
    int BranchId,
    int ReceiptNumber,
    int? SessionId = null,
    string? Tender = null,
    DateTime SettledAt = default) : IntegrationEvent;

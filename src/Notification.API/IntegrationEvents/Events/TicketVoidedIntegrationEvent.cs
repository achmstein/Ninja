using Ninja.EventBus.Events;

namespace Ninja.Notification.API.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of the event Sales publishes when an owner voids an open
/// ticket. Only the place the bill was for: a voided bill ends a sitting at
/// a table the same way a paid one does (docs/visit-tab.html).
/// </summary>
public record TicketVoidedIntegrationEvent(
    int TicketId,
    int BranchId,
    int? PlaceId = null) : IntegrationEvent;

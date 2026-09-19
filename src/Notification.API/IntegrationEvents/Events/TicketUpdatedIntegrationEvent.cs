using Ninja.EventBus.Events;

namespace Ninja.Notification.API.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of the event Sales publishes when a POS ticket opens or
/// changes — carried straight to the admin SignalR group so the POS floor
/// refetches. A pointer only; it never carries money.
/// </summary>
public record TicketUpdatedIntegrationEvent(int TicketId, int BranchId) : IntegrationEvent;

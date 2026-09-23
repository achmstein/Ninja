namespace Ninja.Ordering.API.Application.IntegrationEvents.Events;

/// <summary>
/// A kitchen ticket is waiting for a printer at this branch: an order's
/// part, a reprint or a test page. Consumed by Notification.API to wake the
/// shop's print hosts; a pointer only — they fetch the queue.
/// </summary>
public record KitchenTicketQueuedIntegrationEvent(int BranchId) : IntegrationEvent;

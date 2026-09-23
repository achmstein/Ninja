using Ninja.EventBus.Events;

namespace Ninja.Notification.API.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of the event Ordering publishes when a kitchen ticket is
/// waiting for a printer at a branch. Fanned out to the staff group, where
/// the shop's print hosts are listening.
/// </summary>
public record KitchenTicketQueuedIntegrationEvent(int BranchId) : IntegrationEvent;

using Ninja.EventBus.Events;

namespace Ninja.Notification.API.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of Ordering's event: a rider went on duty or off at a branch.
/// Same type name as the source, since the routing key is the type name.
/// </summary>
public record RiderStatusChangedIntegrationEvent(string UserId, int BranchId, bool OnDuty) : IntegrationEvent;

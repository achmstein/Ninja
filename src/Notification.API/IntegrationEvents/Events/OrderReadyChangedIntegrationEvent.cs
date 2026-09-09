using Chillax.EventBus.Events;

namespace Chillax.Notification.API.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of the event Ordering publishes when the kitchen marks a
/// confirmed order ready or brings it back. Fanned out to the staff SignalR
/// group only — the customer is never told about the kitchen.
/// </summary>
public record OrderReadyChangedIntegrationEvent(
    int OrderId,
    int BranchId,
    bool IsReady) : IntegrationEvent;

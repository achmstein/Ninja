using Chillax.EventBus.Events;

namespace Chillax.Notification.API.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of the event Ordering publishes when the kitchen starts,
/// finishes or recalls a confirmed order. Fanned out to the staff SignalR
/// group only — the customer is never told about preparation.
/// </summary>
public record OrderPreparationChangedIntegrationEvent(
    int OrderId,
    int BranchId,
    string Preparation) : IntegrationEvent;

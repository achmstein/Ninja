namespace Chillax.Ordering.API.Application.IntegrationEvents.Events;

/// <summary>
/// The kitchen moved a confirmed order: NotStarted, Preparing or Ready.
/// Consumed by Notification.API to nudge the kitchen screens; nothing about
/// money, and nothing the customer is ever told.
/// </summary>
public record OrderPreparationChangedIntegrationEvent(
    int OrderId,
    int BranchId,
    string Preparation) : IntegrationEvent;

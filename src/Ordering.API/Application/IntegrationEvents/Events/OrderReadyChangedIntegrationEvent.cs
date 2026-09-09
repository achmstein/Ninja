namespace Chillax.Ordering.API.Application.IntegrationEvents.Events;

/// <summary>
/// The kitchen marked a confirmed order ready, or brought it back to the
/// board. Consumed by Notification.API to nudge the kitchen screens; nothing
/// about money, and nothing the customer is ever told.
/// </summary>
public record OrderReadyChangedIntegrationEvent(
    int OrderId,
    int BranchId,
    bool IsReady) : IntegrationEvent;

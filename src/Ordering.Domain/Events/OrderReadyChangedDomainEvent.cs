namespace Ninja.Ordering.Domain.Events;

/// <summary>
/// The kitchen marked a confirmed order ready, or brought a ready one back.
/// Only kitchen screens care, so the integration event this becomes is a
/// pointer: the order, its branch and whether it is ready now.
/// </summary>
public record class OrderReadyChangedDomainEvent(
    int OrderId,
    int BranchId,
    bool IsReady) : INotification;

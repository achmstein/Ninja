#nullable enable
namespace Ninja.Ordering.Domain.Events;

/// <summary>
/// The kitchen marked a confirmed order ready, or brought a ready one back.
/// The integration event this becomes is a pointer: the order, its branch and
/// whether it is ready now; and, for a delivery given to a rider and not yet
/// left, that rider, who is waiting to collect it.
/// </summary>
public record class OrderReadyChangedDomainEvent(
    int OrderId,
    int BranchId,
    bool IsReady,
    string? RiderUserId = null) : INotification;

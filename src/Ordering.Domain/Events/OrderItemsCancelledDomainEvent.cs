#nullable enable
namespace Ninja.Ordering.Domain.Events;

/// <summary>
/// Items of a confirmed order were cancelled at the till: the kitchen strikes
/// them, a slip prints where they print, and their stock goes as
/// <see cref="Disposition"/> says — null when it is not this cancel's to move.
/// </summary>
/// <param name="Key">The cancel's own id, what the stock's release is filed under.</param>
public record OrderItemsCancelledDomainEvent(
    int OrderId,
    int BranchId,
    IReadOnlyList<CancelledOrderItem> Items,
    StockDisposition? Disposition,
    string? Reason,
    Guid Key) : INotification;

namespace Ninja.Ordering.Domain.Events;

/// <summary>
/// A confirmed order will never be sold: the stock its confirmation took is
/// let go, once, as waste or back to the shelf. Inventory hears of it.
/// </summary>
public record class OrderStockReleasedDomainEvent(
    int OrderId,
    int BranchId,
    StockDisposition Disposition,
    StockReleaseReason Reason) : INotification;

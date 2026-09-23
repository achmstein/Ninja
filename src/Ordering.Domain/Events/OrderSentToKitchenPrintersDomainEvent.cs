namespace Ninja.Ordering.Domain.Events;

/// <summary>
/// A confirmed order has parts that print: each of these stations needs its
/// ticket queued for a printer in the shop.
/// </summary>
public record class OrderSentToKitchenPrintersDomainEvent(
    int OrderId,
    int BranchId,
    IReadOnlyList<int> StationIds) : INotification;

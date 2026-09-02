#nullable enable
using Chillax.Ordering.Domain.Seedwork;

namespace Chillax.Ordering.API.Application.IntegrationEvents.Events;

/// <summary>
/// Integration event sent when an order is confirmed by admin.
/// Carries the full line breakdown and destination so Sales can put the order
/// on the right ticket without ever calling back into Ordering (D5b in
/// docs/pos-plan.md); consumers that only care about the totals ignore the rest.
/// </summary>
public record OrderStatusChangedToConfirmedIntegrationEvent : IntegrationEvent
{
    public int OrderId { get; }
    public OrderStatus OrderStatus { get; }
    public string BuyerName { get; }
    public string BuyerIdentityGuid { get; }
    public LocalizedText? RoomName { get; }
    public decimal OrderTotal { get; }
    public int PointsToRedeem { get; }

    /// <summary>
    /// Set instead of <see cref="BuyerIdentityGuid"/> when a guest placed the
    /// order — it is what the notification hub targets them by.
    /// </summary>
    public string? GuestId { get; }

    public int BranchId { get; }

    /// <summary>The room session the order belongs to, when ordered from a room.</summary>
    public int? SessionId { get; }

    public int? RoomId { get; }

    /// <summary>The café table the order is delivered to, when not in a room.</summary>
    public int? TableId { get; }

    public LocalizedText? TableName { get; }

    /// <summary>Who placed the order: Customer, Guest, or Pos.</summary>
    public string Source { get; }

    /// <summary>Phone a guest left at checkout, so their ticket can carry it.</summary>
    public string? GuestPhone { get; }

    /// <summary>Currency value of the redeemed points, already reflected in <see cref="OrderTotal"/>.</summary>
    public double LoyaltyDiscount { get; }

    public IReadOnlyList<OrderConfirmedItem> Items { get; }

    public OrderStatusChangedToConfirmedIntegrationEvent(
        int orderId,
        OrderStatus orderStatus,
        string buyerName,
        string buyerIdentityGuid,
        LocalizedText? roomName,
        decimal orderTotal,
        int pointsToRedeem = 0,
        string? guestId = null,
        int branchId = 0,
        int? sessionId = null,
        int? roomId = null,
        int? tableId = null,
        LocalizedText? tableName = null,
        string source = "Customer",
        string? guestPhone = null,
        double loyaltyDiscount = 0,
        IReadOnlyList<OrderConfirmedItem>? items = null)
    {
        OrderId = orderId;
        OrderStatus = orderStatus;
        BuyerName = buyerName;
        BuyerIdentityGuid = buyerIdentityGuid;
        RoomName = roomName;
        OrderTotal = orderTotal;
        PointsToRedeem = pointsToRedeem;
        GuestId = guestId;
        BranchId = branchId;
        SessionId = sessionId;
        RoomId = roomId;
        TableId = tableId;
        TableName = tableName;
        Source = source;
        GuestPhone = guestPhone;
        LoyaltyDiscount = loyaltyDiscount;
        Items = items ?? [];
    }
}

/// <summary>
/// One confirmed order line, snapshotted for ticket assembly.
/// </summary>
public record OrderConfirmedItem(
    int ProductId,
    LocalizedText ProductName,
    int Units,
    decimal UnitPrice,
    decimal Discount,
    LocalizedText? CustomizationsDescription);

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

    /// <summary>
    /// The exact ticket this order must land on, set when a cashier added
    /// items to an already-open bill. Takes precedence over the session/table
    /// routing below, which cannot name a counter tab.
    /// </summary>
    public int? TicketId { get; }

    /// <summary>
    /// The person this order is for: the account holder's name, or the one the
    /// till was given for a walk-in. Null when nobody was named — unlike
    /// <see cref="BuyerName"/>, which falls back to a generic label.
    /// </summary>
    public string? CustomerName { get; }

    /// <summary>Who placed the order: Customer, Guest, or Pos.</summary>
    public string Source { get; }

    /// <summary>Phone a guest left at checkout, so their ticket can carry it.</summary>
    public string? GuestPhone { get; }

    /// <summary>Currency value of the redeemed points, already reflected in <see cref="OrderTotal"/>.</summary>
    public double LoyaltyDiscount { get; }

    public IReadOnlyList<OrderConfirmedItem> Items { get; }

    /// <summary>
    /// When the sale happened: now for a live order, the till's clock for an
    /// offline replay. Inventory uses it to leave alone stock that was
    /// counted after the sale but before the replay arrived.
    /// </summary>
    public DateTime PlacedAt { get; init; }

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
        int? ticketId = null,
        string? customerName = null,
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
        TicketId = ticketId;
        CustomerName = customerName;
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
    LocalizedText? CustomizationsDescription,
    /// <summary>The chosen customization options by id, so Inventory can charge option ingredients.</summary>
    List<int>? OptionIds = null);

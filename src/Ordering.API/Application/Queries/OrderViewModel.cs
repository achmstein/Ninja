#nullable enable
using Chillax.Ordering.Domain.Seedwork;

namespace Chillax.Ordering.API.Application.Queries;

public record Orderitem
{
    public LocalizedText ProductName { get; init; } = new();
    public int Units { get; init; }
    public double UnitPrice { get; init; }
    public string? PictureUrl { get; init; }
    public LocalizedText? CustomizationsDescription { get; init; }
    public string? SpecialInstructions { get; init; }
}

public record OrderRatingDto
{
    public int RatingValue { get; init; }
    public string? Comment { get; init; }
    public DateTime CreatedAt { get; init; }
}

/// <summary>
/// Simplified order view model for cafe orders.
/// No address or payment information needed.
/// </summary>
public record Order
{
    public int OrderNumber { get; init; }
    public DateTime Date { get; init; }
    public string Status { get; init; } = string.Empty;
    public string? Description { get; init; }
    public LocalizedText? RoomName { get; init; }
    /// <summary>The room session the order was placed into, when ordered from a room.</summary>
    public int? SessionId { get; init; }
    public int? RoomId { get; init; }
    /// <summary>Who placed the order: Customer, Guest, or Pos.</summary>
    public string Source { get; init; } = string.Empty;
    public int? TableId { get; init; }
    public LocalizedText? TableName { get; init; }
    public string? CustomerNote { get; init; }
    /// <summary>Name a guest left at checkout; null on orders placed by a signed-in customer.</summary>
    public string? GuestName { get; init; }
    /// <summary>Phone number a guest left at checkout — the only way to reach them.</summary>
    public string? GuestPhone { get; init; }
    public List<Orderitem> OrderItems { get; set; } = new();
    public decimal Total { get; set; }
    public int PointsToRedeem { get; init; }
    public double LoyaltyDiscount { get; init; }
    /// <summary>When the till settled the bill this order was on; null while unpaid.</summary>
    public DateTime? PaidAt { get; init; }
    /// <summary>The receipt that covered it — the number the tab and the till show.</summary>
    public int? ReceiptNumber { get; init; }
    /// <summary>"Cash", "Card", "InstaPay", "Account" (on the customer's tab) or "Mixed".</summary>
    public string? PaidWith { get; init; }
    /// <summary>What credit notes have given back against it.</summary>
    public decimal RefundedAmount { get; init; }
    /// <summary>When the open bill it was on was voided; it will never be paid.</summary>
    public DateTime? VoidedAt { get; init; }
    /// <summary>The Sales ticket the order landed on — what the receipt link opens.</summary>
    public int? TicketId { get; init; }
    public OrderRatingDto? Rating { get; init; }
}

/// <summary>
/// What the kitchen needs to make an order: the lines, the notes and where it
/// goes. Money, ratings and contact details stay off the card.
/// </summary>
public record KitchenOrder
{
    public int OrderNumber { get; init; }
    public DateTime Date { get; init; }
    /// <summary>When staff confirmed it — the kitchen's clock starts here.</summary>
    public DateTime? ConfirmedAt { get; init; }
    /// <summary>When the kitchen finished it; null while it is still on the board.</summary>
    public DateTime? ReadyAt { get; init; }
    /// <summary>Who placed it: Customer, Guest, or Pos.</summary>
    public string Source { get; init; } = string.Empty;
    public LocalizedText? RoomName { get; init; }
    public LocalizedText? TableName { get; init; }
    /// <summary>The buyer's name, or the name a guest or the cashier left.</summary>
    public string? CustomerName { get; init; }
    public string? CustomerNote { get; init; }
    public List<KitchenOrderItem> Items { get; init; } = new();
}

public record KitchenOrderItem
{
    public LocalizedText ProductName { get; init; } = new();
    public int Units { get; init; }
    public LocalizedText? CustomizationsDescription { get; init; }
    public string? SpecialInstructions { get; init; }
}

/// <summary>
/// Aggregated order statistics for the admin dashboard.
/// </summary>
public record OrderStats
{
    public List<OrderStatsDay> Days { get; init; } = new();
    public List<OrderStatsItem> TopItems { get; init; } = new();
}

public record OrderStatsDay
{
    /// <summary>Local calendar day (per the caller's tz offset)</summary>
    public DateOnly Date { get; init; }
    public int Orders { get; init; }
    public double Revenue { get; init; }
}

public record OrderStatsItem
{
    public LocalizedText ProductName { get; init; } = new();
    public int Units { get; init; }
    public double Revenue { get; init; }
}

public record OrderSummary
{
    public int OrderNumber { get; init; }
    public DateTime Date { get; init; }
    public string Status { get; init; } = string.Empty;
    public double Total { get; init; }
    public int PointsToRedeem { get; init; }
    public double LoyaltyDiscount { get; init; }
    /// <summary>When the till settled the bill this order was on; null while unpaid.</summary>
    public DateTime? PaidAt { get; init; }
    /// <summary>The receipt that covered it — the number the tab and the till show.</summary>
    public int? ReceiptNumber { get; init; }
    /// <summary>"Cash", "Card", "InstaPay", "Account" (on the customer's tab) or "Mixed".</summary>
    public string? PaidWith { get; init; }
    /// <summary>What credit notes have given back against it.</summary>
    public decimal RefundedAmount { get; init; }
    /// <summary>When the open bill it was on was voided; it will never be paid.</summary>
    public DateTime? VoidedAt { get; init; }
    /// <summary>The Sales ticket the order landed on — what the receipt link opens.</summary>
    public int? TicketId { get; init; }
    public LocalizedText? RoomName { get; init; }
    /// <summary>The room session the order was placed into, when ordered from a room.</summary>
    public int? SessionId { get; init; }
    /// <summary>Who placed the order: Customer, Guest, or Pos.</summary>
    public string Source { get; init; } = string.Empty;
    public int? TableId { get; init; }
    public LocalizedText? TableName { get; init; }
    /// <summary>Buyer's name, or the name a guest left at checkout.</summary>
    public string? UserName { get; init; }
    /// <summary>
    /// Buyer's identity guid — lets admin surfaces open the customer's profile.
    /// Null on a guest order, which has no profile behind it.
    /// </summary>
    public string? UserId { get; init; }
    /// <summary>Phone a guest left at checkout, so staff can reach an order with no account behind it.</summary>
    public string? GuestPhone { get; init; }
    public int? RatingValue { get; init; }
    /// <summary>The customer's note, on the pending queue only (null on paginated lists).</summary>
    public string? CustomerNote { get; init; }
    /// <summary>
    /// Line items, on the pending queue only so the admin board renders a whole
    /// ticket from one request; null on paginated lists.
    /// </summary>
    public IReadOnlyList<Orderitem>? Items { get; init; }
}

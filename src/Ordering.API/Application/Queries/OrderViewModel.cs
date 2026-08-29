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
    public string? CustomerNote { get; init; }
    public List<Orderitem> OrderItems { get; set; } = new();
    public decimal Total { get; set; }
    public int PointsToRedeem { get; init; }
    public double LoyaltyDiscount { get; init; }
    public OrderRatingDto? Rating { get; init; }
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
    public LocalizedText? RoomName { get; init; }
    public string? UserName { get; init; }
    public int? RatingValue { get; init; }
}

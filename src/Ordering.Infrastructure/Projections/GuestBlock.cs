#nullable enable
namespace Ninja.Ordering.Infrastructure.Projections;

/// <summary>
/// A guest id the till turned away: the cashier said nobody was at the table
/// an order came to, so the device that placed it cannot order at this
/// branch again until the block lapses. Not an aggregate — a fact the till
/// records and CreateOrder consults; nothing else hangs off it.
/// </summary>
public class GuestBlock
{
    public int Id { get; set; }

    /// <summary>The X-Guest-Id the orders came under.</summary>
    public string GuestId { get; set; } = string.Empty;

    public int BranchId { get; set; }

    public DateTime BlockedAt { get; set; }

    public DateTime BlockedUntil { get; set; }

    /// <summary>The order that earned the block, for the record.</summary>
    public int? OrderId { get; set; }

    public string? BlockedBy { get; set; }
}

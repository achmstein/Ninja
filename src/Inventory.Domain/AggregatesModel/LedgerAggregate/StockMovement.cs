#nullable enable
namespace Ninja.Inventory.Domain.AggregatesModel.LedgerAggregate;

/// <summary>
/// One line of the ledger: what moved, how much, why, who. Append-only; the
/// levels are derived from these. A movement that came from a document
/// carries its reference ("order:12", "purchase:3", "count:7"), unique per
/// stock item, so a redelivered event or a retried post cannot land twice.
/// </summary>
public class StockMovement : Entity
{
    public int BranchId { get; private set; }

    public int StockItemId { get; private set; }

    public MovementType Type { get; private set; }

    /// <summary>Signed, in the stock item's base unit: positive in, negative out.</summary>
    public decimal Quantity { get; private set; }

    /// <summary>The branch's average unit cost as it stood when this posted: what the movement was worth.</summary>
    public decimal UnitCost { get; private set; }

    public string? Reference { get; private set; }

    public string? Reason { get; private set; }

    public string RecordedBy { get; private set; } = string.Empty;

    /// <summary>When it was posted.</summary>
    public DateTime RecordedAt { get; private set; }

    /// <summary>
    /// When it happened, which the reports date it by: a sale an offline till
    /// sent hours later happened when it was rung up, and a sale given back
    /// leaves the books on the sale's own day. The posting time otherwise.
    /// </summary>
    public DateTime OccurredAt { get; private set; }

    /// <summary>
    /// The branch's average unit cost after this posted: the stock's value as
    /// it stood then, for a report that reads a past date. Null on movements
    /// from before it was kept.
    /// </summary>
    public decimal? AvgUnitCostAfter { get; private set; }

    protected StockMovement() { }

    public StockMovement(int branchId, int stockItemId, MovementType type, decimal quantity, decimal unitCost, string? reference, string? reason, string recordedBy,
        DateTime? occurredAt = null, decimal? avgUnitCostAfter = null)
    {
        if (quantity == 0)
            throw new InventoryDomainException("A movement moves something.");

        BranchId = branchId;
        StockItemId = stockItemId;
        Type = type;
        Quantity = quantity;
        UnitCost = unitCost;
        Reference = reference;
        Reason = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim();
        RecordedBy = recordedBy;
        RecordedAt = DateTime.UtcNow;
        OccurredAt = occurredAt is { } at ? Utc(at) : RecordedAt;
        AvgUnitCostAfter = avgUnitCostAfter;
    }

    private static DateTime Utc(DateTime at) => at.Kind switch
    {
        DateTimeKind.Utc => at,
        DateTimeKind.Local => at.ToUniversalTime(),
        _ => DateTime.SpecifyKind(at, DateTimeKind.Utc),
    };
}

#nullable enable
namespace Chillax.Inventory.Domain.AggregatesModel.LedgerAggregate;

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

    public DateTime RecordedAt { get; private set; }

    protected StockMovement() { }

    public StockMovement(int branchId, int stockItemId, MovementType type, decimal quantity, decimal unitCost, string? reference, string? reason, string recordedBy)
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
    }
}

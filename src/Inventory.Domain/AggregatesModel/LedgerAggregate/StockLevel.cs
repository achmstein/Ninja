#nullable enable
namespace Ninja.Inventory.Domain.AggregatesModel.LedgerAggregate;

/// <summary>
/// How much of a stock item a branch has, kept beside the ledger so a level
/// is one row read, not a sum. It is a projection: the movements are the
/// truth and can rebuild it. Written only by <see cref="Services.IStockLedger"/>
/// under a row lock, never through the change tracker; two tills selling
/// the last two cans must both land, in order.
/// </summary>
public class StockLevel
{
    public int BranchId { get; private set; }

    public int StockItemId { get; private set; }

    /// <summary>Can go negative: the ledger records what happened, a count corrects it.</summary>
    public decimal OnHand { get; private set; }

    /// <summary>Warn when on-hand drops to or below this; null = never warn.</summary>
    public decimal? ReorderLevel { get; private set; }

    /// <summary>Moving average of what a base unit cost, per branch; suppliers and prices differ.</summary>
    public decimal AvgUnitCost { get; private set; }

    protected StockLevel() { }

    public StockLevel(int branchId, int stockItemId)
    {
        BranchId = branchId;
        StockItemId = stockItemId;
    }

    /// <summary>
    /// The average after receiving <paramref name="quantity"/> at <paramref name="unitCost"/>.
    /// Nothing (or less than nothing) on hand means the receipt sets the price.
    /// </summary>
    public static decimal NextAverageCost(decimal onHand, decimal avgUnitCost, decimal quantity, decimal unitCost)
    {
        if (quantity <= 0)
            return avgUnitCost;

        if (onHand <= 0)
            return unitCost;

        return Math.Round((onHand * avgUnitCost + quantity * unitCost) / (onHand + quantity), 4, MidpointRounding.AwayFromZero);
    }
}

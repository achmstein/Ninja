#nullable enable
namespace Chillax.Inventory.Domain.AggregatesModel.StockCountAggregate;

public class StockCountLine : Entity
{
    public int StockItemId { get; private set; }

    /// <summary>What the ledger said was on hand when the count was posted.</summary>
    public decimal Expected { get; private set; }

    /// <summary>What was actually found on the shelf.</summary>
    public decimal Counted { get; private set; }

    /// <summary>Counted minus expected: negative is shrinkage, positive is unrecorded stock.</summary>
    public decimal Variance => Counted - Expected;

    protected StockCountLine() { }

    public StockCountLine(int stockItemId, decimal expected, decimal counted)
    {
        if (stockItemId <= 0)
            throw new InventoryDomainException("A count line needs a stock item.");

        if (counted < 0)
            throw new InventoryDomainException("A count cannot be negative.");

        StockItemId = stockItemId;
        Expected = expected;
        Counted = counted;
    }
}

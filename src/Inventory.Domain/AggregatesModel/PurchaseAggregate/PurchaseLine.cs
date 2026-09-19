#nullable enable
namespace Ninja.Inventory.Domain.AggregatesModel.PurchaseAggregate;

public class PurchaseLine : Entity
{
    public int StockItemId { get; private set; }

    /// <summary>Received quantity in the stock item's base unit (packs already multiplied out).</summary>
    public decimal Quantity { get; private set; }

    /// <summary>What one base unit cost on this receipt.</summary>
    public decimal UnitCost { get; private set; }

    public decimal Total => Math.Round(Quantity * UnitCost, 2, MidpointRounding.AwayFromZero);

    protected PurchaseLine() { }

    public PurchaseLine(int stockItemId, decimal quantity, decimal unitCost)
    {
        if (stockItemId <= 0)
            throw new InventoryDomainException("A receipt line needs a stock item.");

        if (quantity <= 0)
            throw new InventoryDomainException("A receipt line needs a positive quantity.");

        if (unitCost < 0)
            throw new InventoryDomainException("A unit cost cannot be negative.");

        StockItemId = stockItemId;
        Quantity = quantity;
        UnitCost = unitCost;
    }
}

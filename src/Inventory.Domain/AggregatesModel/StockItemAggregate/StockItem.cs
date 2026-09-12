#nullable enable
namespace Chillax.Inventory.Domain.AggregatesModel.StockItemAggregate;

/// <summary>
/// Something the storeroom holds and counts: an ingredient (milk, beans, cups)
/// or a sellable unit (a can, a bottle, a slice). Global, like a menu item;
/// how much of it each branch has is a <see cref="LedgerAggregate.StockLevel"/>.
/// Quantities are always in <see cref="Unit"/>; a purchase pack ("bag" of
/// 1000 g) is only a convenience for receiving.
/// </summary>
public class StockItem : Entity, IAggregateRoot
{
    public LocalizedText Name { get; private set; } = new();

    /// <summary>Base unit every quantity is in: pcs, g, ml.</summary>
    public string Unit { get; private set; } = string.Empty;

    /// <summary>How many base units one purchase pack holds, when it is bought by the pack.</summary>
    public decimal? PackSize { get; private set; }

    /// <summary>What the pack is called on the receipt: "bag", "case", "bottle".</summary>
    public string? PackName { get; private set; }

    /// <summary>
    /// When this runs out at a branch, the menu items whose recipe needs it
    /// are marked out of stock there, and back in stock when it is restocked.
    /// On for goods sold by the unit; off for ingredients, where paper drift
    /// hitting zero must never pull every coffee off the menu.
    /// </summary>
    public bool AutoSoldOut { get; private set; }

    public bool IsActive { get; private set; } = true;

    protected StockItem() { }

    public static StockItem Create(LocalizedText name, string unit, decimal? packSize, string? packName, bool autoSoldOut)
    {
        var item = new StockItem();
        item.Update(name, unit, packSize, packName, autoSoldOut);
        return item;
    }

    public void Update(LocalizedText name, string unit, decimal? packSize, string? packName, bool autoSoldOut)
    {
        if (string.IsNullOrWhiteSpace(name.En))
            throw new InventoryDomainException("A stock item needs a name.");

        if (string.IsNullOrWhiteSpace(unit))
            throw new InventoryDomainException("A stock item needs a unit (pcs, g, ml).");

        if (packSize is <= 0)
            throw new InventoryDomainException("A pack size must be positive.");

        Name = new LocalizedText(name.En.Trim(), string.IsNullOrWhiteSpace(name.Ar) ? null : name.Ar.Trim());
        Unit = unit.Trim();
        PackSize = packSize;
        PackName = string.IsNullOrWhiteSpace(packName) ? null : packName.Trim();
        AutoSoldOut = autoSoldOut;
    }

    public void SetActive(bool active) => IsActive = active;
}

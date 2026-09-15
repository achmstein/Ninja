#nullable enable
namespace Chillax.Inventory.Domain.AggregatesModel.RecipeAggregate;

/// <summary>
/// One line of a recipe slot. Lines sharing a <see cref="Slot"/> describe
/// one thing a sale takes — the coffee, the sugar, the cup — and how the
/// customer's choices change it: the line with no options is the slot's
/// default, the others are overrides keyed on one option or a combination
/// (a bag that exists only for medium roast + spiced). An override replaces
/// the default within its slot; a <see cref="IsNone"/> override removes the
/// slot for that choice ("سادة": no sugar).
/// </summary>
public class RecipeLine : Entity
{
    /// <summary>Which slot the line belongs to; 0 until the recipe assigns one (then the line is a slot of its own).</summary>
    public int Slot { get; private set; }

    public int StockItemId { get; private set; }

    /// <summary>Quantity of the stock item, in its base unit, per unit sold; 0 for a none override.</summary>
    public decimal Quantity { get; private set; }

    /// <summary>The catalog customization options this line needs, all of them; empty for the slot's default.</summary>
    public List<int> OptionIds { get; private set; } = new();

    /// <summary>Whether the recipe's size factors multiply this line (coffee yes, the cup no).</summary>
    public bool Scalable { get; private set; } = true;

    /// <summary>An override that deducts nothing for its options.</summary>
    public bool IsNone { get; private set; }

    protected RecipeLine() { }

    public RecipeLine(int stockItemId, decimal quantity, IEnumerable<int>? optionIds = null, int slot = 0, bool scalable = true)
    {
        if (stockItemId <= 0)
            throw new InventoryDomainException("A recipe line needs a stock item.");

        if (quantity <= 0)
            throw new InventoryDomainException("A recipe line needs a positive quantity.");

        if (slot < 0)
            throw new InventoryDomainException("A recipe slot number cannot be negative.");

        StockItemId = stockItemId;
        Quantity = quantity;
        OptionIds = Normalize(optionIds);
        Slot = slot;
        Scalable = scalable;
    }

    /// <summary>For these options the slot deducts nothing; the stock item names the slot it belongs to.</summary>
    public static RecipeLine None(int slot, int stockItemId, IEnumerable<int> optionIds)
    {
        if (stockItemId <= 0)
            throw new InventoryDomainException("A recipe line needs a stock item.");

        var options = Normalize(optionIds);
        if (options.Count == 0)
            throw new InventoryDomainException("A none override needs the options it applies to; leave the slot without a default instead.");

        return new RecipeLine { StockItemId = stockItemId, Quantity = 0, OptionIds = options, Slot = slot, IsNone = true };
    }

    public bool IsBase => OptionIds.Count == 0;

    /// <summary>Whether this line is used for a sale that chose these options.</summary>
    public bool AppliesTo(IReadOnlyCollection<int>? chosenOptionIds)
        => IsBase || (chosenOptionIds is not null && OptionIds.All(chosenOptionIds.Contains));

    /// <summary>The option set as one comparable key: "" for the default, "3,7" for a combination.</summary>
    public string OptionKey => string.Join(",", OptionIds);

    internal void AssignSlot(int slot) => Slot = slot;

    private static List<int> Normalize(IEnumerable<int>? optionIds)
        => optionIds?.Where(id => id > 0).Distinct().OrderBy(id => id).ToList() ?? new List<int>();
}

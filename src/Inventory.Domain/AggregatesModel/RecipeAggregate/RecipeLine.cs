#nullable enable
namespace Chillax.Inventory.Domain.AggregatesModel.RecipeAggregate;

/// <summary>
/// One ingredient of a recipe. A base line (no options) is used by every
/// unit sold; a line naming customization options is used only when every
/// one of them was chosen. One option: "oat milk" instead of, or on top of,
/// the base. Several: a bag that exists only for a combination, like the
/// medium-roast spiced Turkish coffee that is its own product on the shelf.
/// </summary>
public class RecipeLine : Entity
{
    public int StockItemId { get; private set; }

    /// <summary>Quantity of the stock item, in its base unit, per unit sold.</summary>
    public decimal Quantity { get; private set; }

    /// <summary>The catalog customization options this line needs, all of them; empty for the base recipe.</summary>
    public List<int> OptionIds { get; private set; } = new();

    protected RecipeLine() { }

    public RecipeLine(int stockItemId, decimal quantity, IEnumerable<int>? optionIds = null)
    {
        if (stockItemId <= 0)
            throw new InventoryDomainException("A recipe line needs a stock item.");

        if (quantity <= 0)
            throw new InventoryDomainException("A recipe line needs a positive quantity.");

        StockItemId = stockItemId;
        Quantity = quantity;
        OptionIds = optionIds?.Where(id => id > 0).Distinct().OrderBy(id => id).ToList() ?? new List<int>();
    }

    public bool IsBase => OptionIds.Count == 0;

    /// <summary>Whether this line is used for a sale that chose these options.</summary>
    public bool AppliesTo(IReadOnlyCollection<int>? chosenOptionIds)
        => IsBase || (chosenOptionIds is not null && OptionIds.All(chosenOptionIds.Contains));

    /// <summary>The option set as one comparable key: "" for base, "3,7" for a combination.</summary>
    public string OptionKey => string.Join(",", OptionIds);
}

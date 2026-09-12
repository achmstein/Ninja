#nullable enable
namespace Chillax.Inventory.Domain.AggregatesModel.RecipeAggregate;

/// <summary>
/// What one unit of a menu item takes out of the storeroom. Keyed by the
/// catalog item (global, like the item itself); Catalog is never asked: the
/// back office picks the item, Inventory keeps only its id. A menu item
/// without a recipe is simply not tracked.
/// </summary>
public class Recipe : IAggregateRoot
{
    public int CatalogItemId { get; private set; }

    private readonly List<RecipeLine> _lines = new();
    public IReadOnlyCollection<RecipeLine> Lines => _lines.AsReadOnly();

    protected Recipe() { }

    public Recipe(int catalogItemId, IEnumerable<RecipeLine> lines)
    {
        if (catalogItemId <= 0)
            throw new InventoryDomainException("A recipe needs the menu item it is for.");

        CatalogItemId = catalogItemId;
        SetLines(lines);
    }

    /// <summary>Sold by the unit: the stock item is the menu item, one each.</summary>
    public static Recipe ForUnit(int catalogItemId, int stockItemId)
        => new(catalogItemId, [new RecipeLine(stockItemId, 1)]);

    public void SetLines(IEnumerable<RecipeLine> lines)
    {
        var list = lines.ToList();

        if (list.Count == 0)
            throw new InventoryDomainException("A recipe needs at least one line.");

        var duplicate = list
            .GroupBy(l => (l.StockItemId, l.OptionKey))
            .FirstOrDefault(g => g.Count() > 1);

        if (duplicate is not null)
            throw new InventoryDomainException("A recipe lists each stock item once per option combination.");

        _lines.Clear();
        _lines.AddRange(list);
    }

    /// <summary>Base ingredients: what every unit sold takes, whatever was chosen.</summary>
    public IEnumerable<RecipeLine> BaseLines => _lines.Where(l => l.IsBase);

    /// <summary>
    /// What selling <paramref name="units"/> of this item consumes: the base
    /// lines, plus the option lines whose options were all chosen.
    /// </summary>
    public IEnumerable<(int StockItemId, decimal Quantity)> Explode(int units, IReadOnlyCollection<int>? chosenOptionIds = null)
    {
        if (units <= 0)
            yield break;

        foreach (var line in _lines)
        {
            if (line.AppliesTo(chosenOptionIds))
                yield return (line.StockItemId, line.Quantity * units);
        }
    }
}

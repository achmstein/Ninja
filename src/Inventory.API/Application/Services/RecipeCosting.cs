#nullable enable
using Chillax.Inventory.API.Application.Queries;

namespace Chillax.Inventory.API.Application.Services;

/// <summary>
/// What one sale of a menu item costs the branch in ingredients, at the
/// branch's current average costs: the base recipe as one figure, each
/// option line set as the extra it adds when those options are picked.
/// An ingredient never received at the branch has no cost yet; it is
/// listed so the margin reads "incomplete" rather than too good. Pure.
/// </summary>
public static class RecipeCosting
{
    public static RecipeCostView Cost(Recipe recipe, IReadOnlyDictionary<int, decimal> avgUnitCosts, IReadOnlyDictionary<int, StockItem> items)
    {
        var lines = new List<RecipeCostLineView>(recipe.Lines.Count);
        var uncosted = new SortedSet<int>();

        foreach (var line in recipe.Lines)
        {
            avgUnitCosts.TryGetValue(line.StockItemId, out var unitCost);
            if (unitCost <= 0)
                uncosted.Add(line.StockItemId);

            items.TryGetValue(line.StockItemId, out var item);
            lines.Add(new RecipeCostLineView(
                line.StockItemId,
                item?.Name ?? new LocalizedText("?"),
                item?.Unit ?? string.Empty,
                line.Quantity,
                line.OptionIds,
                unitCost,
                Money(line.Quantity * unitCost)));
        }

        var baseCost = Money(lines.Where(l => l.OptionIds.Count == 0).Sum(l => l.Cost));

        // One figure per distinct option set, in the order the recipe lists them
        var options = lines
            .Where(l => l.OptionIds.Count > 0)
            .GroupBy(l => string.Join(",", l.OptionIds.OrderBy(id => id)))
            .Select(g => new RecipeOptionCostView(g.First().OptionIds, Money(g.Sum(l => l.Cost))))
            .ToList();

        return new RecipeCostView(recipe.CatalogItemId, baseCost, options, lines, uncosted.ToList());
    }

    private static decimal Money(decimal value) => Math.Round(value, 2, MidpointRounding.AwayFromZero);
}

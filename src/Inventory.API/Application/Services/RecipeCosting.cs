#nullable enable
using Chillax.Inventory.API.Application.Queries;

namespace Chillax.Inventory.API.Application.Services;

/// <summary>
/// What one sale of a menu item costs the branch in ingredients, at the
/// branch's current average costs: every line priced, and the base cost —
/// a sale with nothing chosen — worked out the way <see cref="Recipe.Explode"/>
/// would. An ingredient never received at the branch has no cost yet; it
/// is listed so the margin reads "incomplete" rather than too good. Pure.
/// </summary>
public static class RecipeCosting
{
    public static RecipeCostView Cost(Recipe recipe, IReadOnlyDictionary<int, decimal> avgUnitCosts, IReadOnlyDictionary<int, StockItem> items)
    {
        var lines = new List<RecipeCostLineView>(recipe.Lines.Count);
        var uncosted = new SortedSet<int>();

        foreach (var line in recipe.Lines.OrderBy(l => l.Slot).ThenBy(l => l.Id))
        {
            avgUnitCosts.TryGetValue(line.StockItemId, out var unitCost);
            if (unitCost <= 0 && !line.IsNone)
                uncosted.Add(line.StockItemId);

            items.TryGetValue(line.StockItemId, out var item);
            lines.Add(new RecipeCostLineView(
                line.StockItemId,
                item?.Name ?? new LocalizedText("?"),
                item?.Unit ?? string.Empty,
                line.Quantity,
                line.OptionIds,
                unitCost,
                line.IsNone ? 0 : Money(line.Quantity * unitCost),
                line.Slot,
                line.IsNone));
        }

        var baseCost = Money(recipe.Explode(1).Sum(x => x.Quantity * avgUnitCosts.GetValueOrDefault(x.StockItemId)));

        return new RecipeCostView(recipe.CatalogItemId, baseCost, lines, uncosted.ToList());
    }

    private static decimal Money(decimal value) => Math.Round(value, 2, MidpointRounding.AwayFromZero);
}

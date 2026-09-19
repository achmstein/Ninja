#nullable enable
using Ninja.Inventory.API.Application.IntegrationEvents.Events;

namespace Ninja.Inventory.API.Application.Services;

/// <summary>
/// Turns a confirmed order's lines into the movements it costs: each line
/// through its item's recipe, summed per stock item (one product can sit on
/// several lines, and several products can share an ingredient), so an
/// order posts one movement per ingredient. Pure, so it can be tested.
/// </summary>
public static class SaleDeduction
{
    public static string ReferenceFor(int orderId) => $"order:{orderId}";

    public static IReadOnlyList<MovementDraft> BuildDrafts(int orderId, IEnumerable<OrderConfirmedItem> items, IReadOnlyDictionary<int, Recipe> recipesByProduct)
    {
        var perStockItem = new Dictionary<int, decimal>();

        foreach (var line in items)
        {
            if (!recipesByProduct.TryGetValue(line.ProductId, out var recipe))
                continue;

            foreach (var (stockItemId, quantity) in recipe.Explode(line.Units, line.OptionIds))
            {
                perStockItem[stockItemId] = perStockItem.GetValueOrDefault(stockItemId) + quantity;
            }
        }

        var reference = ReferenceFor(orderId);

        return perStockItem
            .Where(kv => kv.Value > 0)
            .Select(kv => new MovementDraft(kv.Key, MovementType.Sale, -kv.Value, reference))
            .ToList();
    }

    /// <summary>
    /// Drops the drafts for stock items that were counted after the sale
    /// happened: a till that sold while offline and synced later, after a
    /// stocktake, would otherwise take those units twice. The count already
    /// recorded the shelf as it was after the sale.
    /// </summary>
    public static IReadOnlyList<MovementDraft> DropCountedAfter(
        IReadOnlyList<MovementDraft> drafts,
        DateTime? placedAt,
        IReadOnlyDictionary<int, DateTime> lastCountedAt)
    {
        if (placedAt is not { } soldAt)
            return drafts;

        return drafts
            .Where(d => !(lastCountedAt.TryGetValue(d.StockItemId, out var countedAt) && countedAt > soldAt))
            .ToList();
    }
}

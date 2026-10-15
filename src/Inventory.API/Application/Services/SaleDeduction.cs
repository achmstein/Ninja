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

    public static string CountedReferenceFor(int orderId) => $"order:{orderId}:counted";

    /// <summary>
    /// For the stock items counted after the sale happened, a Count back
    /// up by what the sale takes: a till that sold while offline and synced
    /// later, after a stocktake, would otherwise take those units twice, as
    /// the count already recorded the shelf as it was after the sale. The
    /// sale is posted all the same, so its cost is the sale's on its day;
    /// the correction, dated to the count, takes the same units out of what
    /// the count found missing. The shelf ends where the count left it.
    /// </summary>
    public static IReadOnlyList<MovementDraft> CountedSince(
        int orderId,
        IReadOnlyList<MovementDraft> drafts,
        DateTime? placedAt,
        IReadOnlyDictionary<int, DateTime> lastCountedAt)
    {
        if (placedAt is not { } soldAt)
            return [];

        var reference = CountedReferenceFor(orderId);

        return drafts
            .Where(d => d.Type == MovementType.Sale && lastCountedAt.TryGetValue(d.StockItemId, out var countedAt) && countedAt > soldAt)
            .Select(d => new MovementDraft(d.StockItemId, MovementType.Count, -d.Quantity, reference,
                "Sold before the count, sent after it", OccurredAt: lastCountedAt[d.StockItemId]))
            .ToList();
    }
}

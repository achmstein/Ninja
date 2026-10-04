#nullable enable
namespace Ninja.Inventory.API.Application.Services;

/// <summary>
/// What a confirmed order that will never be sold gives back. Its sale
/// movements are reversed, each at the cost it went out at, so the sale
/// leaves the books; food that was made then goes out again as waste (the
/// shelf as it was, the cost moved from sold to wasted), food that was not
/// stays back on the shelf. Pure, so it can be tested.
/// </summary>
public static class SaleRelease
{
    public const string Waste = "Waste";
    public const string Restock = "Restock";

    /// <summary>The reversal's reference: one release per order, its redelivery guard.</summary>
    public static string ReferenceFor(int orderId) => $"order:{orderId}:released";

    /// <summary>The write-off's: one per stock item, apart from the reversal's on the same item.</summary>
    public static string WasteReferenceFor(int orderId) => $"order:{orderId}:waste";

    /// <param name="sale">The order's sale movements (reference <c>order:{id}</c>).</param>
    /// <param name="lastCountedAt">
    /// When each item was last counted. Food never made never left the shelf,
    /// so a count after the sale already found it there: putting it back again
    /// would count it twice. Waste is untouched by this: the count saw it gone,
    /// as it is.
    /// </param>
    public static IReadOnlyList<MovementDraft> BuildDrafts(
        int orderId,
        string disposition,
        IReadOnlyList<StockMovement> sale,
        IReadOnlyDictionary<int, DateTime> lastCountedAt)
    {
        var waste = disposition == Waste;
        var reference = ReferenceFor(orderId);
        var wasteReference = WasteReferenceFor(orderId);
        var reason = waste ? "Made, then not sold" : "Not made: back to the shelf";

        var lines = sale
            .Where(m => m.Type == MovementType.Sale && m.Quantity < 0)
            .Where(m => waste || !(lastCountedAt.TryGetValue(m.StockItemId, out var countedAt) && countedAt > m.RecordedAt))
            .ToList();

        // The reversal before the write-off on each item: the ledger posts in
        // item order and keeps this order within an item
        var drafts = new List<MovementDraft>(lines.Count * 2);

        foreach (var line in lines)
        {
            // At the cost the sale went out at, so cost of goods takes back
            // exactly what it was given; a sale that went out at nothing has
            // nothing to give back and leaves the average alone
            drafts.Add(new MovementDraft(
                line.StockItemId, MovementType.SaleReversal, -line.Quantity, reference, reason,
                UnitCost: line.UnitCost > 0 ? line.UnitCost : null));
        }

        if (waste)
        {
            drafts.AddRange(lines.Select(line =>
                new MovementDraft(line.StockItemId, MovementType.Waste, line.Quantity, wasteReference, reason)));
        }

        return drafts;
    }
}

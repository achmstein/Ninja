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

    /// <summary>What every partial release of the order is filed under: some of its items cancelled at the till.</summary>
    public static string PartPrefixFor(int orderId) => $"order:{orderId}:part:";

    public static string PartReferenceFor(int orderId, Guid key) => $"{PartPrefixFor(orderId)}{key:N}";

    public static string PartWasteReferenceFor(int orderId, Guid key) => $"{PartReferenceFor(orderId, key)}:waste";

    /// <summary>
    /// Some items of the order will never be sold. What their recipes take
    /// (<paramref name="wanted"/>, by stock item) comes back off the order's
    /// sale, never more than the sale took less what earlier partial releases
    /// gave back, at the cost the sale went out at; made, it then goes out as
    /// waste, as a whole order's release does.
    /// </summary>
    /// <param name="givenBack">The order's earlier partial releases.</param>
    public static IReadOnlyList<MovementDraft> BuildPartDrafts(
        int orderId,
        Guid key,
        string disposition,
        IReadOnlyDictionary<int, decimal> wanted,
        IReadOnlyList<StockMovement> sale,
        IReadOnlyList<StockMovement> givenBack,
        IReadOnlyDictionary<int, DateTime> lastCountedAt)
    {
        var waste = disposition == Waste;
        var reference = PartReferenceFor(orderId, key);
        var wasteReference = PartWasteReferenceFor(orderId, key);
        var reason = waste ? "Cancelled after it was made" : "Cancelled before it was made: back to the shelf";
        var drafts = new List<MovementDraft>();
        var wastes = new List<MovementDraft>();

        foreach (var line in sale.Where(m => m.Type == MovementType.Sale && m.Quantity < 0))
        {
            if (!wanted.TryGetValue(line.StockItemId, out var asked) || asked <= 0)
                continue;
            if (!waste && lastCountedAt.TryGetValue(line.StockItemId, out var countedAt) && countedAt > line.RecordedAt)
                continue;

            var already = givenBack.Where(m => m.StockItemId == line.StockItemId && m.Type == MovementType.SaleReversal).Sum(m => m.Quantity);
            var quantity = Math.Min(asked, -line.Quantity - already);
            if (quantity <= 0)
                continue;

            drafts.Add(new MovementDraft(
                line.StockItemId, MovementType.SaleReversal, quantity, reference, reason,
                UnitCost: line.UnitCost > 0 ? line.UnitCost : null,
                OccurredAt: line.OccurredAt));
            if (waste)
                wastes.Add(new MovementDraft(line.StockItemId, MovementType.Waste, -quantity, wasteReference, reason));
        }

        return [.. drafts, .. wastes];
    }

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
        IReadOnlyDictionary<int, DateTime> lastCountedAt,
        IReadOnlyList<StockMovement>? givenBack = null)
    {
        var waste = disposition == Waste;
        var reference = ReferenceFor(orderId);
        var wasteReference = WasteReferenceFor(orderId);
        var reason = waste ? "Made, then not sold" : "Not made: back to the shelf";

        // What items cancelled earlier already gave back stays given back: only the rest of the sale goes
        var back = (givenBack ?? [])
            .Where(m => m.Type == MovementType.SaleReversal)
            .GroupBy(m => m.StockItemId)
            .ToDictionary(g => g.Key, g => g.Sum(m => m.Quantity));
        var lines = sale
            .Where(m => m.Type == MovementType.Sale && m.Quantity < 0)
            .Where(m => waste || !(lastCountedAt.TryGetValue(m.StockItemId, out var countedAt) && countedAt > m.RecordedAt))
            .Select(m => (m.StockItemId, Quantity: m.Quantity + back.GetValueOrDefault(m.StockItemId), m.UnitCost, m.OccurredAt))
            .Where(m => m.Quantity < 0)
            .ToList();

        // The reversal before the write-off on each item: the ledger posts in
        // item order and keeps this order within an item
        var drafts = new List<MovementDraft>(lines.Count * 2);

        foreach (var line in lines)
        {
            // At the cost the sale went out at, so cost of goods takes back
            // exactly what it was given; a sale that went out at nothing has
            // nothing to give back and leaves the average alone. On the sale's
            // own day: the sale leaves the books where it entered them, not
            // in the month the order was called off
            drafts.Add(new MovementDraft(
                line.StockItemId, MovementType.SaleReversal, -line.Quantity, reference, reason,
                UnitCost: line.UnitCost > 0 ? line.UnitCost : null,
                OccurredAt: line.OccurredAt));
        }

        // The food is thrown away now, so its waste is today's
        if (waste)
        {
            drafts.AddRange(lines.Select(line =>
                new MovementDraft(line.StockItemId, MovementType.Waste, line.Quantity, wasteReference, reason)));
        }

        return drafts;
    }
}

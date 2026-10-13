namespace Ninja.Sales.API.Application.Queries;

/// <summary>
/// Counts what an item is bought with, from each ticket's catalog items: a
/// ticket with two lattes and a croissant has the croissant once.
/// </summary>
public static class ItemPairs
{
    /// <summary>The most items a report names; a menu's long tail says nothing about taste.</summary>
    public const int MaxPairs = 15;

    public static ItemPairsReport Count(int catalogItemId, IEnumerable<IEnumerable<int?>> tickets)
    {
        var withItem = 0;
        var together = new Dictionary<int, int>();

        foreach (var lines in tickets)
        {
            var items = lines.OfType<int>().ToHashSet();
            if (!items.Remove(catalogItemId))
                continue;

            withItem++;
            foreach (var other in items)
                together[other] = together.GetValueOrDefault(other) + 1;
        }

        var pairs = together
            .OrderByDescending(p => p.Value)
            .ThenBy(p => p.Key)
            .Take(MaxPairs)
            .Select(p => new ItemPair(p.Key, p.Value, Math.Round((decimal)p.Value / withItem, 3)))
            .ToList();

        return new ItemPairsReport(catalogItemId, withItem, pairs);
    }
}

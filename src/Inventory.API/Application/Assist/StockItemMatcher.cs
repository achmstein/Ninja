using Ninja.AI.Text;
using Ninja.Inventory.API.Application.Queries;

namespace Ninja.Inventory.API.Application.Assist;

/// <summary>
/// Finds the stock items that look like a receipt line, so the review
/// sheet can offer them first when the assistant was not sure. Pure text
/// similarity over the English and Arabic names and the pack name, each
/// folded by <see cref="TextFolding"/>, then the token overlap decides,
/// with a bonus when one name contains the other.
/// </summary>
public static class StockItemMatcher
{
    /// <summary>The best few ids for a line, best first; empty when nothing comes close.</summary>
    public static IReadOnlyList<int> Suggest(string rawText, IReadOnlyList<StockItemView> items, int take = 3, double minScore = 0.2)
    {
        var query = Normalize(rawText);
        if (query.Length == 0)
            return [];

        var queryTokens = Tokens(query);
        return items
            .Select(item => (item.Id, Score: Score(query, queryTokens, item)))
            .Where(x => x.Score >= minScore)
            .OrderByDescending(x => x.Score)
            .ThenBy(x => x.Id)
            .Take(take)
            .Select(x => x.Id)
            .ToList();
    }

    /// <summary>0–1: how alike a line and an item are.</summary>
    public static double Score(string rawText, StockItemView item)
    {
        var query = Normalize(rawText);
        return query.Length == 0 ? 0 : Score(query, Tokens(query), item);
    }

    private static double Score(string query, HashSet<string> queryTokens, StockItemView item)
    {
        var best = 0.0;
        foreach (var candidate in new[] { item.Name.En, item.Name.Ar, item.PackName })
        {
            var normalized = Normalize(candidate);
            if (normalized.Length == 0)
                continue;

            var tokens = Tokens(normalized);
            var overlap = queryTokens.Intersect(tokens).Count();
            var union = queryTokens.Union(tokens).Count();
            var jaccard = union == 0 ? 0 : (double)overlap / union;

            // A receipt line usually carries more than the name (size, price, qty); containment counts for a lot
            var containment = query.Contains(normalized, StringComparison.Ordinal) || normalized.Contains(query, StringComparison.Ordinal)
                ? 0.5
                : 0.0;

            best = Math.Max(best, Math.Min(1.0, jaccard + containment));
        }

        return best;
    }

    /// <summary>One spelling for text that means the same thing (the shared folding).</summary>
    public static string Normalize(string? text) => TextFolding.Fold(text);

    private static HashSet<string> Tokens(string normalized)
        => normalized.Split(' ', StringSplitOptions.RemoveEmptyEntries).Where(t => t.Length > 1 || char.IsDigit(t[0])).ToHashSet(StringComparer.Ordinal);
}

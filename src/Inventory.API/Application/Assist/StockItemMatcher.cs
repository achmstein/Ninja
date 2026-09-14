using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using Chillax.Inventory.API.Application.Queries;

namespace Chillax.Inventory.API.Application.Assist;

/// <summary>
/// Finds the stock items that look like a receipt line, so the review
/// sheet can offer them first when the assistant was not sure. Pure text
/// similarity over the English and Arabic names and the pack name: Arabic
/// is normalised (no tashkeel, one alef, one ya, ة as ه, Arabic-Indic
/// digits as Western), Latin is lower-cased without diacritics, then the
/// token overlap decides, with a bonus when one name contains the other.
/// </summary>
public static partial class StockItemMatcher
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

    /// <summary>One spelling for text that means the same thing.</summary>
    public static string Normalize(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
            return string.Empty;

        var builder = new StringBuilder(text.Length);
        foreach (var rune in text.Normalize(NormalizationForm.FormD).EnumerateRunes())
        {
            var c = rune.Value;
            switch (c)
            {
                case >= 0x064B and <= 0x0652: // tashkeel
                case 0x0640: // tatweel
                    continue;
                case 0x0622 or 0x0623 or 0x0625 or 0x0671: // alef with hamza / madda / wasla
                    builder.Append('ا');
                    continue;
                case 0x0629: // ta marbuta
                    builder.Append('ه');
                    continue;
                case 0x0649: // alef maqsura
                    builder.Append('ي');
                    continue;
                case 0x0624: // waw with hamza
                    builder.Append('و');
                    continue;
                case 0x0626: // ya with hamza
                    builder.Append('ي');
                    continue;
                case >= 0x0660 and <= 0x0669: // Arabic-Indic digits
                    builder.Append((char)('0' + (c - 0x0660)));
                    continue;
                case >= 0x06F0 and <= 0x06F9: // Eastern Arabic-Indic digits
                    builder.Append((char)('0' + (c - 0x06F0)));
                    continue;
            }

            var category = Rune.GetUnicodeCategory(rune);
            if (category == UnicodeCategory.NonSpacingMark)
                continue; // Latin diacritics after FormD

            if (Rune.IsLetterOrDigit(rune))
                builder.Append(Rune.ToLowerInvariant(rune).ToString());
            else
                builder.Append(' ');
        }

        return Whitespace().Replace(builder.ToString(), " ").Trim();
    }

    private static HashSet<string> Tokens(string normalized)
        => normalized.Split(' ', StringSplitOptions.RemoveEmptyEntries).Where(t => t.Length > 1 || char.IsDigit(t[0])).ToHashSet(StringComparer.Ordinal);

    [GeneratedRegex(@"\s+")]
    private static partial Regex Whitespace();
}

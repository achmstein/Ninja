using System.Text.RegularExpressions;
using Ninja.AI.Json;

namespace Ninja.Catalog.API.Assist;

/// <summary>
/// Turns what the model read into a proposal the review sheet can trust:
/// names cleaned and capped, category ids accepted only from the list (a
/// section named like an existing category takes its id), items already
/// on the menu flagged by name, duplicates within the photo dropped, and
/// every doubt said in a warning naming the section and line.
/// </summary>
public static partial class MenuProposalValidator
{
    public const int MaxCategories = 20;
    public const int MaxItems = 150;
    public const int MaxNameLength = 120;
    public const int MaxDescriptionLength = 600;
    public const decimal MaxPrice = 10_000m;

    public static MenuProposal Validate(MenuExtraction extraction, IReadOnlyList<CatalogType> categories, IReadOnlyList<CatalogItem> items)
    {
        var warnings = new List<string>();
        var proposed = new List<ProposedCategory>();
        var categoryByName = Index(categories.Select(c => (c.Id, c.Name)));
        var itemByName = Index(items.Select(i => (i.Id, i.Name)));
        var seen = new HashSet<string>(StringComparer.Ordinal);
        var total = 0;

        foreach (var (category, c) in (extraction.Categories ?? []).Select((x, i) => (x, i + 1)))
        {
            if (proposed.Count == MaxCategories)
            {
                warnings.Add($"The photo has more than {MaxCategories} sections; only the first {MaxCategories} are shown.");
                break;
            }

            var name = Name(category.NameEn, category.NameAr);
            var label = name.En.Length > 0 ? name.En : name.Ar ?? $"section {c}";
            if (name.En.Length == 0 && string.IsNullOrEmpty(name.Ar))
            {
                warnings.Add($"Section {c} has no readable name; it is skipped.");
                continue;
            }

            int? typeId = null;
            if (category.CatalogTypeId > 0 && categories.Any(x => x.Id == category.CatalogTypeId))
                typeId = category.CatalogTypeId;
            else if (category.CatalogTypeId > 0)
                warnings.Add($"{label}: the assistant matched a category that does not exist; pick one yourself.");
            typeId ??= Lookup(categoryByName, name);

            var lines = new List<ProposedItem>();
            foreach (var (item, n) in (category.Items ?? []).Select((x, i) => (x, i + 1)))
            {
                if (total == MaxItems)
                {
                    warnings.Add($"The photo has more than {MaxItems} items; only the first {MaxItems} are shown.");
                    break;
                }

                var itemName = Name(item.NameEn, item.NameAr);
                var where = $"{label}, line {n}";
                if (itemName.En.Length == 0 && string.IsNullOrEmpty(itemName.Ar))
                {
                    warnings.Add($"{where}: no readable name; the line is skipped.");
                    continue;
                }

                if (IsDuplicate(seen, itemName))
                {
                    warnings.Add($"{where}: \"{itemName.En}\" appears twice on the photo; the second is skipped.");
                    continue;
                }
                Remember(seen, itemName);

                if (itemName.En.Length == 0)
                    warnings.Add($"{where}: no English name was read; fill it in.");

                var price = Math.Round(item.Price, 2, MidpointRounding.AwayFromZero);
                if (price <= 0)
                {
                    price = 0;
                    warnings.Add($"{where}: no price was read; type it in.");
                }
                else if (price > MaxPrice)
                {
                    warnings.Add($"{where}: the price {price:0.##} looks wrong; check it.");
                }

                var existing = Lookup(itemByName, itemName);
                lines.Add(new ProposedItem(
                    AIJson.Clean(item.RawText, 200),
                    itemName,
                    Name(item.DescriptionEn, item.DescriptionAr, MaxDescriptionLength),
                    price,
                    existing));
                total++;
            }

            if (lines.Count == 0)
            {
                warnings.Add($"{label}: no items were read under it; it is skipped.");
                continue;
            }

            proposed.Add(new ProposedCategory(name, typeId, lines));
        }

        if (proposed.Count == 0)
            warnings.Add("Nothing on the photo could be read as a menu item.");

        var notes = AIJson.Clean(extraction.Notes, 200);
        return new MenuProposal(proposed, warnings, notes.Length == 0 ? null : notes);
    }

    private static LocalizedText Name(string? en, string? ar, int maxLength = MaxNameLength)
    {
        var cleanEn = AIJson.Clean(en, maxLength);
        var cleanAr = AIJson.Clean(ar, maxLength);
        return new LocalizedText(cleanEn, cleanAr.Length == 0 ? null : cleanAr);
    }

    /// <summary>Names on both sides, folded, so "turkish  coffee" and "Turkish Coffee" are one.</summary>
    private static Dictionary<string, int> Index(IEnumerable<(int Id, LocalizedText Name)> entries)
    {
        var index = new Dictionary<string, int>(StringComparer.Ordinal);
        foreach (var (id, name) in entries)
        {
            if (!string.IsNullOrWhiteSpace(name.En)) index.TryAdd(Key(name.En), id);
            if (!string.IsNullOrWhiteSpace(name.Ar)) index.TryAdd(Key(name.Ar!), id);
        }
        return index;
    }

    private static int? Lookup(Dictionary<string, int> index, LocalizedText name)
    {
        if (name.En.Length > 0 && index.TryGetValue(Key(name.En), out var byEn)) return byEn;
        if (name.Ar is { Length: > 0 } && index.TryGetValue(Key(name.Ar), out var byAr)) return byAr;
        return null;
    }

    private static bool IsDuplicate(HashSet<string> seen, LocalizedText name)
        => (name.En.Length > 0 && seen.Contains(Key(name.En))) || (name.Ar is { Length: > 0 } && seen.Contains(Key(name.Ar)));

    private static void Remember(HashSet<string> seen, LocalizedText name)
    {
        if (name.En.Length > 0) seen.Add(Key(name.En));
        if (name.Ar is { Length: > 0 }) seen.Add(Key(name.Ar));
    }

    /// <summary>Lower-cased, single-spaced, Arabic diacritics and tatweel removed.</summary>
    public static string Key(string text)
        => Whitespace().Replace(Marks().Replace(text, string.Empty), " ").Trim().ToLowerInvariant();

    [GeneratedRegex(@"[ً-ْـ]")]
    private static partial Regex Marks();

    [GeneratedRegex(@"\s+")]
    private static partial Regex Whitespace();
}

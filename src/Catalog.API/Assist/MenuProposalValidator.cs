using System.Text.RegularExpressions;
using Ninja.AI.Json;
using Ninja.AI.Text;

namespace Ninja.Catalog.API.Assist;

/// <summary>
/// Turns what the model read into a proposal the review sheet can trust:
/// names cleaned and capped, category ids accepted only from the list (a
/// section named like an existing category takes its id), items already
/// on the menu flagged by name, duplicates within the photo dropped, and
/// every doubt said in a warning naming the section and line. A business that
/// writes one language gets that language only (<see cref="ContentLanguages.Keep"/>).
/// </summary>
public static partial class MenuProposalValidator
{
    public const int MaxCategories = 20;
    public const int MaxItems = 150;
    public const int MaxNameLength = 120;
    public const int MaxDescriptionLength = 600;
    public const decimal MaxPrice = 10_000m;
    public const int MaxChoices = 8;

    public static MenuProposal Validate(MenuExtraction extraction, IReadOnlyList<CatalogType> categories, IReadOnlyList<CatalogItem> items, string languages = ContentLanguages.Both)
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

            var name = Name(category.NameEn, category.NameAr, languages);
            var label = name.IsEmpty ? $"section {c}" : name.Primary;
            if (name.IsEmpty)
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

                var itemName = Name(item.NameEn, item.NameAr, languages);
                var where = $"{label}, line {n}";
                if (itemName.IsEmpty)
                {
                    warnings.Add($"{where}: no readable name; the line is skipped.");
                    continue;
                }

                if (IsDuplicate(seen, itemName))
                {
                    warnings.Add($"{where}: \"{itemName.Primary}\" appears twice on the photo; the second is skipped.");
                    continue;
                }
                Remember(seen, itemName);

                // The business's own language is the one worth a nudge: English for a business in both
                var missing = languages switch
                {
                    ContentLanguages.Arabic => itemName.Ar is null ? "Arabic" : null,
                    _ => itemName.En is null ? "English" : null,
                };
                if (missing is not null)
                    warnings.Add($"{where}: no {missing} name was read; fill it in.");

                var choice = Choice(item, where, warnings, languages);
                // The item costs its cheapest choice; the others cost more by the difference
                var price = choice?.Options[0].Price ?? Math.Round(item.Price, 2, MidpointRounding.AwayFromZero);
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
                    Name(item.DescriptionEn, item.DescriptionAr, languages, MaxDescriptionLength),
                    price,
                    existing,
                    choice));
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

    /// <summary>
    /// The printed choices, cleaned: named, priced, no two alike, cheapest
    /// first. Fewer than two left is no choice at all (one price is just the
    /// item's price).
    /// </summary>
    private static ProposedChoice? Choice(ExtractedItem item, string where, List<string> warnings, string languages)
    {
        var printed = item.Choices ?? [];
        if (printed.Count == 0)
            return null;

        var options = new List<ProposedChoiceOption>();
        var seen = new HashSet<string>(StringComparer.Ordinal);
        foreach (var raw in printed)
        {
            var name = Name(raw.NameEn, raw.NameAr, languages);
            var price = Math.Round(raw.Price, 2, MidpointRounding.AwayFromZero);
            if (name.IsEmpty)
                continue;
            if (price <= 0 || price > MaxPrice)
            {
                warnings.Add($"{where}: no price was read for \"{name.Primary}\"; that choice is left out.");
                continue;
            }
            if (IsDuplicate(seen, name))
                continue;
            Remember(seen, name);
            options.Add(new ProposedChoiceOption(name, price));
        }

        if (options.Count < 2)
        {
            if (printed.Count >= 2)
                warnings.Add($"{where}: its choices could not be read; only one price is kept.");
            return null;
        }

        if (options.Count > MaxChoices)
        {
            warnings.Add($"{where}: more than {MaxChoices} choices; only the first {MaxChoices} are kept.");
            options = options.Take(MaxChoices).ToList();
        }

        var group = Name(item.ChoiceEn, item.ChoiceAr, languages);
        if (group.IsEmpty)
            group = Name("Size", "الحجم", languages);

        return new ProposedChoice(group, options.OrderBy(o => o.Price).ToList());
    }

    /// <summary>Cleaned and capped; for a one-language business, that language's side only.</summary>
    private static LocalizedText Name(string? en, string? ar, string languages, int maxLength = MaxNameLength)
    {
        var (keptEn, keptAr) = ContentLanguages.Keep(AIJson.Clean(en, maxLength), AIJson.Clean(ar, maxLength), languages);
        return new LocalizedText(keptEn, keptAr);
    }

    /// <summary>Names on both sides, folded, so "turkish  coffee" and "Turkish Coffee" are one.</summary>
    private static Dictionary<string, int> Index(IEnumerable<(int Id, LocalizedText Name)> entries)
    {
        var index = new Dictionary<string, int>(StringComparer.Ordinal);
        foreach (var (id, name) in entries)
        {
            if (name.En is { } en) index.TryAdd(Key(en), id);
            if (name.Ar is { } ar) index.TryAdd(Key(ar), id);
        }
        return index;
    }

    private static int? Lookup(Dictionary<string, int> index, LocalizedText name)
    {
        if (name.En is { } en && index.TryGetValue(Key(en), out var byEn)) return byEn;
        if (name.Ar is { } ar && index.TryGetValue(Key(ar), out var byAr)) return byAr;
        return null;
    }

    private static bool IsDuplicate(HashSet<string> seen, LocalizedText name)
        => (name.En is { } en && seen.Contains(Key(en))) || (name.Ar is { } ar && seen.Contains(Key(ar)));

    private static void Remember(HashSet<string> seen, LocalizedText name)
    {
        if (name.En is { } en) seen.Add(Key(en));
        if (name.Ar is { } ar) seen.Add(Key(ar));
    }

    /// <summary>Lower-cased, single-spaced, Arabic diacritics and tatweel removed.</summary>
    public static string Key(string text)
        => Whitespace().Replace(Marks().Replace(text, string.Empty), " ").Trim().ToLowerInvariant();

    [GeneratedRegex(@"[ً-ْـ]")]
    private static partial Regex Marks();

    [GeneratedRegex(@"\s+")]
    private static partial Regex Whitespace();
}

using System.Text.RegularExpressions;
using Chillax.AI.Json;

namespace Chillax.Catalog.API.Assist;

/// <summary>
/// Turns the model's proposed groups into ones the customization form can
/// take as they are: names cleaned and capped, groups the item already has
/// dropped, options deduplicated, one default per single-choice group,
/// prices sane against the item's own. Whatever is dropped or changed is
/// said in a warning.
/// </summary>
public static partial class CustomizationsPostProcessor
{
    public const int MaxGroups = 5;
    public const int MaxOptions = 8;
    public const int MaxNameLength = 60;

    public static SuggestCustomizationsResponse Apply(CustomizationsResult result, CatalogItem item)
    {
        var warnings = new List<string>();
        var groups = new List<ProposedCustomization>();
        var taken = new HashSet<string>(
            item.Customizations.SelectMany(c => Names(c.Name.En, c.Name.Ar)),
            StringComparer.OrdinalIgnoreCase);

        foreach (var group in result.Groups ?? [])
        {
            if (groups.Count == MaxGroups)
            {
                warnings.Add($"The assistant proposed more than {MaxGroups} groups; only the first {MaxGroups} are shown.");
                break;
            }

            var name = CleanName(group.Name);
            if (name.En.Length == 0)
            {
                warnings.Add("Skipped a group with no English name.");
                continue;
            }

            if (Names(name.En, name.Ar).Any(taken.Contains))
            {
                warnings.Add($"Skipped \"{name.En}\": the item already has it.");
                continue;
            }

            var options = CleanOptions(group, name.En, item.Price, warnings);
            var needed = group.AllowMultiple ? 1 : 2;
            if (options.Count < needed)
            {
                warnings.Add($"Skipped \"{name.En}\": it needs at least {needed} option{(needed == 1 ? "" : "s")}.");
                continue;
            }

            foreach (var n in Names(name.En, name.Ar))
                taken.Add(n);

            if (!HasArabic(name.Ar) || options.Any(o => !HasArabic(o.Name.Ar)))
                warnings.Add($"\"{name.En}\" is missing Arabic names; fill them in before adding it.");

            groups.Add(new ProposedCustomization(name, group.IsRequired, group.AllowMultiple, options));
        }

        var notes = AIJson.Clean(result.Notes, 200);
        if (notes.Length > 0)
            warnings.Add($"Assistant: {notes}");

        return new SuggestCustomizationsResponse(groups, warnings);
    }

    private static List<ProposedOption> CleanOptions(CustomizationGroupResult group, string groupName, decimal itemPrice, List<string> warnings)
    {
        var options = new List<ProposedOption>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var hasDefault = false;

        foreach (var option in group.Options ?? [])
        {
            if (options.Count == MaxOptions)
            {
                warnings.Add($"\"{groupName}\" had more than {MaxOptions} options; only the first {MaxOptions} are kept.");
                break;
            }

            var name = CleanName(option.Name);
            if (name.En.Length == 0 || !seen.Add(name.En))
                continue;

            var adjustment = SanePrice(option.PriceAdjustment, itemPrice, groupName, name.En, warnings);

            // A single-choice group keeps only its first default
            var isDefault = option.IsDefault && (group.AllowMultiple || !hasDefault);
            hasDefault |= isDefault;

            options.Add(new ProposedOption(name, adjustment, isDefault));
        }

        return options;
    }

    /// <summary>Rounded to the piastre; zeroed with a warning when it would take the item below free or is out of all proportion.</summary>
    private static decimal SanePrice(decimal adjustment, decimal itemPrice, string groupName, string optionName, List<string> warnings)
    {
        var rounded = Math.Round(adjustment, 2, MidpointRounding.AwayFromZero);
        var ceiling = Math.Max(itemPrice * 2, 50m);

        if (rounded < 0 && itemPrice + rounded < 0)
        {
            warnings.Add($"\"{optionName}\" in \"{groupName}\" would make the item cheaper than free; its price is set to 0.");
            return 0m;
        }

        if (rounded > ceiling)
        {
            warnings.Add($"\"{optionName}\" in \"{groupName}\" was priced at {rounded:0.##}, more than double the item; its price is set to 0.");
            return 0m;
        }

        return rounded;
    }

    private static LocalizedText CleanName(LocalizedPair? pair)
    {
        var en = AIJson.Clean(pair?.En, MaxNameLength);
        var ar = AIJson.Clean(pair?.Ar, MaxNameLength);
        return new LocalizedText(en, ar.Length == 0 ? null : ar);
    }

    private static IEnumerable<string> Names(string? en, string? ar)
    {
        if (!string.IsNullOrWhiteSpace(en)) yield return en.Trim();
        if (!string.IsNullOrWhiteSpace(ar)) yield return ar.Trim();
    }

    private static bool HasArabic(string? text) => text is not null && ArabicLetter().IsMatch(text);

    [GeneratedRegex(@"\p{IsArabic}")]
    private static partial Regex ArabicLetter();
}

using Ninja.AI.Text;

namespace Ninja.Catalog.API.Assist;

/// <summary>
/// Keeps only proposals the pairings list would take: an item on the menu
/// and orderable, not the item itself, not one the list already has, each
/// once, no more than the list has room for. Reasons are trimmed and kept in
/// the business's languages. Whatever is dropped is said in a warning.
/// </summary>
public static class PairingsPostProcessor
{
    public const int MaxNoteLength = 300;
    public const int MaxReasonLength = 120;

    /// <summary>The most sales pairs a request carries; the report names 15.</summary>
    public const int MaxTogether = 30;

    /// <summary>The request is within its caps; the reason when not.</summary>
    public static string? Validate(SuggestPairingsRequest request)
    {
        if ((request.Note?.Length ?? 0) > MaxNoteLength)
            return $"Keep the instructions under {MaxNoteLength} characters.";

        if ((request.Together?.Count ?? 0) > MaxTogether)
            return $"Send at most {MaxTogether} bought-together counts.";

        if ((request.Current?.Count ?? 0) >= CatalogItemPairing.MaxPerItem)
            return $"The list already has {CatalogItemPairing.MaxPerItem} dishes; remove one to make room.";

        return null;
    }

    /// <summary>How many more the list takes.</summary>
    public static int Room(SuggestPairingsRequest request) =>
        Math.Max(0, CatalogItemPairing.MaxPerItem - (request.Current?.Distinct().Count() ?? 0));

    /// <param name="orderable">Ids of the items that can be ordered now.</param>
    public static SuggestPairingsResponse Apply(PairingsResult result, SuggestPairingsRequest request, IReadOnlySet<int> orderable)
    {
        var languages = ContentLanguages.Normalize(request.Languages);
        var room = Room(request);
        var warnings = new List<string>();
        var taken = new HashSet<int>(request.Current ?? []) { request.ItemId };
        var items = new List<ProposedPairing>();
        var skipped = 0;

        foreach (var item in result.Items ?? [])
        {
            if (!orderable.Contains(item.Id) || !taken.Add(item.Id))
            {
                skipped++;
                continue;
            }

            if (items.Count == room)
            {
                warnings.Add($"The assistant proposed more than the list has room for; only the first {room} are shown.");
                break;
            }

            var (en, ar) = ContentLanguages.Keep(Trim(item.Reason?.En), Trim(item.Reason?.Ar), languages);
            items.Add(new ProposedPairing(item.Id, new LocalizedText { En = en, Ar = ar }));
        }

        if (skipped > 0)
            warnings.Add(skipped == 1
                ? "Skipped one proposal that is not on the menu, not orderable or already on the list."
                : $"Skipped {skipped} proposals that are not on the menu, not orderable or already on the list.");

        if (!string.IsNullOrWhiteSpace(result.Notes))
            warnings.Add(result.Notes.Trim());

        return new SuggestPairingsResponse(items, warnings);
    }

    private static string? Trim(string? reason)
    {
        var text = reason?.Trim();
        if (string.IsNullOrEmpty(text)) return null;
        return text.Length <= MaxReasonLength ? text : text[..MaxReasonLength].TrimEnd() + "…";
    }
}

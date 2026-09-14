using System.ComponentModel;

namespace Chillax.Catalog.API.Assist;

/// <summary>What kind of text is being localized; the voice differs a little for each.</summary>
public enum LocalizeKind
{
    MenuItem = 0,
    Category = 1,
    StockItem = 2,
}

/// <summary>
/// One side of the name (and, for a menu item, of the description) is
/// filled in; the assistant fills in the other. Nothing is saved: the
/// answer goes back to the form for the user to keep or edit.
/// </summary>
/// <param name="Kind">Menu item, category or stock item.</param>
/// <param name="Name">Exactly one of En / Ar filled in.</param>
/// <param name="Description">Menu items only; the empty side is filled in when the name's is.</param>
/// <param name="CatalogTypeId">The menu item's category, as context for the wording.</param>
/// <param name="SuggestCategory">Menu items only: also pick the most fitting category.</param>
public sealed record LocalizeRequest(
    LocalizeKind Kind,
    LocalizedText Name,
    LocalizedText? Description = null,
    [property: Description("The menu item's category, as context")] int? CatalogTypeId = null,
    bool SuggestCategory = false);

/// <param name="Name">Both sides filled in; the side that came in is returned unchanged.</param>
/// <param name="Description">Both sides, or null when none was asked for.</param>
/// <param name="SuggestedCatalogTypeId">Only when asked for, and only an existing category.</param>
/// <param name="Filled">Which fields the assistant filled ("name.ar", "description.en", "catalogTypeId"), so the form overwrites nothing the user typed.</param>
/// <param name="Warnings">Anything worth a second look, in plain words.</param>
public sealed record LocalizeResponse(
    LocalizedText Name,
    LocalizedText? Description,
    int? SuggestedCatalogTypeId,
    IReadOnlyList<string> Filled,
    IReadOnlyList<string> Warnings);

/// <summary>What the model answers; every field required so the schema stays simple for every provider.</summary>
public sealed record LocalizeResult(LocalizedPair Name, LocalizedPair Description, int SuggestedCategoryId, string Notes);

public sealed record LocalizedPair(string En, string Ar);

/// <summary>What the model is shown, as JSON.</summary>
internal sealed record LocalizePrompt(
    string Kind,
    string SourceLanguage,
    string TargetLanguage,
    LocalizedPair Name,
    LocalizedPair Description,
    string Category,
    IReadOnlyList<CategoryOption> Categories,
    bool SuggestCategory);

internal sealed record CategoryOption(int Id, string En, string Ar);

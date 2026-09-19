using System.ComponentModel;

namespace Ninja.Catalog.API.Assist;

/// <summary>What kind of text is being localized; the voice differs a little for each.</summary>
public enum LocalizeKind
{
    MenuItem = 0,
    Category = 1,
    StockItem = 2,
}

/// <summary>
/// The name is filled in (one language, or both); the assistant fills in
/// what is missing: the other language of the name and description, a
/// description written from scratch when asked, a category when asked.
/// Nothing is saved: the answer goes back to the form for the user to keep
/// or edit.
/// </summary>
/// <param name="Kind">Menu item, category or stock item.</param>
/// <param name="Name">At least one of En / Ar filled in.</param>
/// <param name="Description">Menu items only; the empty side is filled in when the other has text.</param>
/// <param name="CatalogTypeId">The menu item's category, as context for the wording.</param>
/// <param name="SuggestCategory">Menu items only: also pick the most fitting category.</param>
/// <param name="SuggestDescription">Menu items only: write the description in both languages when there is none.</param>
public sealed record LocalizeRequest(
    LocalizeKind Kind,
    LocalizedText Name,
    LocalizedText? Description = null,
    [property: Description("The menu item's category, as context")] int? CatalogTypeId = null,
    bool SuggestCategory = false,
    bool SuggestDescription = false);

/// <param name="Name">Both sides filled in; whatever came in is returned unchanged.</param>
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
/// <param name="Fill">Exactly the fields to produce: "name.ar", "description.en", "description.ar", "categoryId".</param>
internal sealed record LocalizePrompt(
    string Kind,
    IReadOnlyList<string> Fill,
    LocalizedPair Name,
    LocalizedPair Description,
    string Category,
    IReadOnlyList<CategoryOption> Categories);

internal sealed record CategoryOption(int Id, string En, string Ar);

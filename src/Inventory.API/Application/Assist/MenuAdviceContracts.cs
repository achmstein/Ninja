#nullable enable
using Ninja.AI.Text;

namespace Ninja.Inventory.API.Application.Assist;

/// <summary>
/// The menu-engineering matrix as the back office placed it: each item with
/// its price, what one sale costs, what sold in the window and its class.
/// Inventory keeps no copy of the menu or the sales, so they travel in the
/// request; nothing is fetched or saved here.
/// </summary>
/// <param name="Days">How many days of sales the matrix covers.</param>
/// <param name="AverageMargin">The margin from which an item counts as paying, in pounds.</param>
/// <param name="Languages">The business's languages: "both", "ar" or "en"; the advice comes back in those. Null is both.</param>
/// <param name="Note">The owner's own word on what to look at ("we can't raise drink prices"), in either language.</param>
public sealed record MenuAdviceRequest(
    IReadOnlyList<MenuAdviceItem> Items,
    int Days,
    decimal AverageMargin,
    string? Languages = null,
    string? Note = null);

/// <param name="Class">star, plowhorse, puzzle or dog.</param>
/// <param name="Sold">Units sold in the window.</param>
public sealed record MenuAdviceItem(
    int CatalogItemId,
    LocalizedText Name,
    LocalizedText? Category,
    decimal Price,
    decimal Cost,
    decimal Sold,
    string Class);

/// <param name="Summary">Two or three sentences on the menu as a whole.</param>
/// <param name="Items">One move per item worth changing, the most money first; items to leave as they are are left out.</param>
public sealed record MenuAdvice(LocalizedText Summary, IReadOnlyList<ItemAdvice> Items, IReadOnlyList<string> Warnings);

/// <param name="Action">raise-price, lower-price, promote, rework, remove or keep.</param>
/// <param name="Advice">What to do and why, a sentence or two, in the business's languages.</param>
public sealed record ItemAdvice(int CatalogItemId, string Action, LocalizedText Advice);

/// <summary>What the model answers; every field required so the schema stays simple for every provider.</summary>
public sealed record MenuAdviceResult(LocalizedPair Summary, IReadOnlyList<ItemAdviceResult> Items, string Notes);

public sealed record ItemAdviceResult(int Id, string Action, LocalizedPair Advice);

/// <summary>Both sides always present (empty when not written), so the schema stays simple for every provider.</summary>
public sealed record LocalizedPair(string En, string Ar);

/// <summary>What the model is shown, as JSON.</summary>
internal sealed record MenuAdvicePrompt(
    int Days,
    decimal AverageMargin,
    decimal PopularShare,
    IReadOnlyList<MenuAdvicePromptItem> Items,
    string Languages = ContentLanguages.Both,
    string Note = "");

/// <param name="Mix">Its share of the units sold, 0 to 1.</param>
internal sealed record MenuAdvicePromptItem(int Id, string Name, string Category, decimal Price, decimal Cost, decimal Margin, decimal FoodCostPercent, decimal Sold, decimal Mix, string Class);

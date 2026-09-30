using System.ComponentModel;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace Ninja.Catalog.API;

/// <summary>
/// A menu saved in one go: the categories it adds, the items under them,
/// and each item's printed choices (sizes) as a required option group. What
/// the menu scan's review sheet sends, or a template; all or nothing, so a
/// failure never leaves half a menu behind and a retry never doubles it.
/// </summary>
public static class MenuImportApi
{
    public const int MaxCategories = 40;
    public const int MaxItems = 400;
    public const int MaxChoices = 8;
    public const int MaxNameLength = 120;
    public const int MaxDescriptionLength = 600;

    public static RouteGroupBuilder MapMenuImportApi(this RouteGroupBuilder api)
    {
        api.MapPost("/menu/import", ImportMenu)
            .WithName("ImportMenu")
            .WithSummary("Save a menu in one go")
            .WithDescription("Adds categories (or fills existing ones) with items, each with its choices (sizes and their prices) as a required option group, in one transaction: all of it is saved or none of it (Admin only).")
            .WithTags("Items")
            .RequireAuthorization("Admin");

        return api;
    }

    public static async Task<Results<Ok<MenuImportResult>, BadRequest<ProblemDetails>>> ImportMenu(
        MenuImportRequest request,
        CatalogContext context,
        CancellationToken ct)
    {
        if (Validate(request) is { } error)
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = error });

        var existing = await context.CatalogTypes.ToDictionaryAsync(c => c.Id, ct);
        var missing = request.Categories.Where(c => c.CatalogTypeId is { } id && !existing.ContainsKey(id)).Select(c => c.CatalogTypeId).FirstOrDefault();
        if (missing is not null)
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = $"Category {missing} does not exist." });

        // New categories and items go after what is there
        var nextCategoryOrder = existing.Count == 0 ? 0 : existing.Values.Max(c => c.DisplayOrder) + 1;
        var nextItemOrder = await context.CatalogItems
            .GroupBy(i => i.CatalogTypeId)
            .Select(g => new { g.Key, Next = g.Max(i => i.DisplayOrder) + 1 })
            .ToDictionaryAsync(x => x.Key, x => x.Next, ct);

        var created = new List<CatalogItem>();
        var newCategories = 0;
        foreach (var section in request.Categories)
        {
            CatalogType category;
            if (section.CatalogTypeId is { } id)
            {
                category = existing[id];
            }
            else
            {
                category = new CatalogType(Clean(section.Name!)) { DisplayOrder = nextCategoryOrder++ };
                context.CatalogTypes.Add(category);
                newCategories++;
            }

            var order = category.Id != 0 ? nextItemOrder.GetValueOrDefault(category.Id) : 0;
            foreach (var line in section.Items)
            {
                var item = new CatalogItem(Clean(line.Name), line.Description is null ? null : Clean(line.Description, MaxDescriptionLength))
                {
                    CatalogType = category,
                    Price = line.Price,
                    IsAvailable = true,
                    DisplayOrder = order++,
                };

                if (line.Choice is { } choice)
                {
                    var options = choice.Options.OrderBy(o => o.Price).ToList();
                    item.Price = options[0].Price;
                    var group = new ItemCustomization(Clean(choice.Name)) { IsRequired = true, AllowMultiple = false, DisplayOrder = 0 };
                    foreach (var (option, n) in options.Select((o, n) => (o, n)))
                    {
                        group.Options.Add(new CustomizationOption(Clean(option.Name))
                        {
                            // The cheapest is the item's price and the default; the others cost the difference
                            PriceAdjustment = option.Price - item.Price,
                            IsDefault = n == 0,
                            DisplayOrder = n,
                        });
                    }
                    item.Customizations.Add(group);
                }

                context.CatalogItems.Add(item);
                created.Add(item);
            }
        }

        await context.SaveChangesAsync(ct);

        return TypedResults.Ok(new MenuImportResult(newCategories, created.Select(i => i.Id).ToList()));
    }

    /// <summary>What is wrong with the request, in plain words; null when it can be saved.</summary>
    internal static string? Validate(MenuImportRequest request)
    {
        var categories = request.Categories ?? [];
        if (categories.Count == 0)
            return "Nothing to save.";
        if (categories.Count > MaxCategories)
            return $"At most {MaxCategories} categories at a time.";
        if (categories.Sum(c => c.Items?.Count ?? 0) > MaxItems)
            return $"At most {MaxItems} items at a time.";

        foreach (var (category, c) in categories.Select((x, i) => (x, i + 1)))
        {
            if (category.CatalogTypeId is null && Unnamed(category.Name))
                return $"Category {c} needs a name, or an existing category.";
            if ((category.Items?.Count ?? 0) == 0)
                return $"Category {c} has no items.";

            foreach (var (item, n) in category.Items!.Select((x, i) => (x, i + 1)))
            {
                var where = $"Category {c}, item {n}";
                if (Unnamed(item.Name))
                    return $"{where}: a name is needed.";
                if (item.Price < 0)
                    return $"{where}: the price cannot be negative.";

                if (item.Choice is { } choice)
                {
                    if (Unnamed(choice.Name))
                        return $"{where}: the choice needs a name.";
                    var options = choice.Options ?? [];
                    if (options.Count is < 2 or > MaxChoices)
                        return $"{where}: a choice has 2 to {MaxChoices} options.";
                    if (options.Any(o => Unnamed(o.Name)))
                        return $"{where}: every option needs a name.";
                    if (options.Any(o => o.Price < 0))
                        return $"{where}: an option's price cannot be negative.";
                }
            }
        }

        return null;
    }

    private static bool Unnamed(LocalizedText? name) => name is null || name.IsEmpty;

    /// <summary>Each language capped; the type already trims and turns a blank side into null.</summary>
    private static LocalizedText Clean(LocalizedText text, int maxLength = MaxNameLength)
    {
        static string? Cap(string? value, int max) => value is { Length: var n } && n > max ? value[..max].TrimEnd() : value;
        return new LocalizedText(Cap(text.En, maxLength), Cap(text.Ar, maxLength));
    }
}

/// <param name="Categories">Where the items go, in the order to show them.</param>
public sealed record MenuImportRequest(IReadOnlyList<MenuImportCategory> Categories);

/// <param name="CatalogTypeId">An existing category the items join; null makes a new one named <paramref name="Name"/>.</param>
/// <param name="Name">The new category's name; ignored for an existing one.</param>
/// <param name="Items">The items, in the order to show them.</param>
public sealed record MenuImportCategory(
    [property: Description("An existing category the items join; null makes a new one")] int? CatalogTypeId,
    LocalizedText? Name,
    IReadOnlyList<MenuImportItem> Items);

/// <param name="Price">The item's price; with a choice, the cheapest option's price wins.</param>
/// <param name="Choice">Its sizes (or single/double…) with their full prices, saved as a required option group.</param>
public sealed record MenuImportItem(LocalizedText Name, LocalizedText? Description, decimal Price, MenuImportChoice? Choice = null);

public sealed record MenuImportChoice(LocalizedText Name, IReadOnlyList<MenuImportChoiceOption> Options);

/// <param name="Price">The full price with this option, not the difference.</param>
public sealed record MenuImportChoiceOption(LocalizedText Name, decimal Price);

/// <param name="CategoriesCreated">How many new categories were made.</param>
/// <param name="ItemIds">The new items' ids, in the order sent.</param>
public sealed record MenuImportResult(int CategoriesCreated, IReadOnlyList<int> ItemIds);

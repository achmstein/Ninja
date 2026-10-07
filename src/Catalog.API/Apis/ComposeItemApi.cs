using System.ComponentModel;
using System.Text.Json;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace Ninja.Catalog.API;

/// <summary>
/// A dish made whole in one call: the item, a new category when it needs
/// one, and its customization groups with their options, all in one
/// transaction. What the owner's assistant sends once the owner agreed to a
/// preview, so the recipe (in Inventory) can follow with the options' ids:
/// each option carries a reference the caller chose and comes back with the
/// id it got. The request id makes it safe to repeat: the same one returns
/// what the first call made instead of a second dish.
/// </summary>
public static class ComposeItemApi
{
    public const int MaxGroups = 8;
    public const int MaxOptions = 12;

    public static RouteGroupBuilder MapComposeItemApi(this RouteGroupBuilder api)
    {
        api.MapPost("/items/compose", ComposeItem)
            .WithName("ComposeItem")
            .WithSummary("Create a menu item with its customizations in one go")
            .WithDescription("Creates the item (and its category when it names a new one) with its customization groups and options in one transaction, and answers the id each option got for the reference the caller gave it. Repeating a request id returns the first call's result (Admin only).")
            .WithTags("Items")
            .RequireAuthorization("Admin");
        return api;
    }

    public static async Task<Results<Ok<ComposeItemResult>, BadRequest<ProblemDetails>>> ComposeItem(
        [FromHeader(Name = "x-requestid")] Guid requestId,
        ComposeItemRequest request,
        CatalogContext context,
        CancellationToken ct)
    {
        if (requestId == Guid.Empty)
            return Bad("A request id (x-requestid) is needed, so a retry cannot make the dish twice.");

        if (await context.ComposedItemRequests.FindAsync([requestId], ct) is { } done)
            return TypedResults.Ok(Result(done));

        if (Validate(request) is { } error)
            return Bad(error);

        CatalogType category;
        if (request.CatalogTypeId is { } typeId)
        {
            var existing = await context.CatalogTypes.FindAsync([typeId], ct);
            if (existing is null) return Bad($"Category {typeId} does not exist.");
            category = existing;
        }
        else
        {
            // A category of the same name is the one meant, rather than a twin of it
            var name = request.NewCategoryName!;
            var all = await context.CatalogTypes.ToListAsync(ct);
            category = all.FirstOrDefault(c => Same(c.Name, name)) ?? new CatalogType(name)
            {
                DisplayOrder = all.Count == 0 ? 0 : all.Max(c => c.DisplayOrder) + 1,
            };
            if (category.Id == 0) context.CatalogTypes.Add(category);
        }

        var nextOrder = category.Id == 0
            ? 0
            : await context.CatalogItems.Where(i => i.CatalogTypeId == category.Id).Select(i => (int?)i.DisplayOrder).MaxAsync(ct) + 1 ?? 0;

        var item = new CatalogItem(request.Name, request.Description)
        {
            CatalogType = category,
            Price = request.Price,
            IsAvailable = true,
            IsPopular = request.IsPopular,
            PreparationTimeMinutes = request.PreparationTimeMinutes,
            DisplayOrder = nextOrder,
        };

        var byRef = new List<(int Ref, CustomizationOption Option)>();
        foreach (var (group, g) in (request.Customizations ?? []).Select((x, i) => (x, i)))
        {
            var customization = new ItemCustomization(group.Name)
            {
                IsRequired = group.IsRequired,
                AllowMultiple = group.AllowMultiple,
                DisplayOrder = g,
            };
            foreach (var (option, o) in group.Options.Select((x, i) => (x, i)))
            {
                var made = new CustomizationOption(option.Name)
                {
                    PriceAdjustment = option.PriceAdjustment,
                    IsDefault = option.IsDefault,
                    DisplayOrder = o,
                };
                customization.Options.Add(made);
                byRef.Add((option.Ref, made));
            }
            item.Customizations.Add(customization);
        }

        context.CatalogItems.Add(item);

        // The dish and the record of its request land together, or neither does
        var record = new ComposedItemRequest { RequestId = requestId, CreatedAt = DateTime.UtcNow };
        var strategy = context.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await context.Database.BeginTransactionAsync(ct);
            await context.SaveChangesAsync(ct);
            record.CatalogItemId = item.Id;
            record.CatalogTypeId = category.Id;
            record.Options = JsonSerializer.Serialize(byRef.Select(x => new ComposedOption(x.Ref, x.Option.Id)).ToList());
            context.ComposedItemRequests.Add(record);
            await context.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
        });

        return TypedResults.Ok(Result(record));
    }

    /// <summary>What is wrong with the request, in plain words; null when it can be saved.</summary>
    internal static string? Validate(ComposeItemRequest request)
    {
        if (request.Name is null || request.Name.IsEmpty) return "The dish needs a name.";
        if (request.Price < 0) return "The price cannot be negative.";
        if (request.CatalogTypeId is null && (request.NewCategoryName is null || request.NewCategoryName.IsEmpty))
            return "Say which category the dish goes in, or name a new one.";
        var groups = request.Customizations ?? [];
        if (groups.Count > MaxGroups) return $"At most {MaxGroups} customization groups.";
        var refs = new HashSet<int>();
        foreach (var (group, g) in groups.Select((x, i) => (x, i + 1)))
        {
            if (group.Name is null || group.Name.IsEmpty) return $"Customization {g} needs a name.";
            var options = group.Options ?? [];
            if (options.Count is 0 or > MaxOptions) return $"Customization {g} needs 1 to {MaxOptions} options.";
            foreach (var option in options)
            {
                if (option.Name is null || option.Name.IsEmpty) return $"Every option of customization {g} needs a name.";
                if (!refs.Add(option.Ref)) return $"Option reference {option.Ref} is used twice.";
            }
            if (!group.AllowMultiple && options.Count(o => o.IsDefault) > 1)
                return $"Customization {g} picks one option, so it can have one default at most.";
        }
        return null;
    }

    private static ComposeItemResult Result(ComposedItemRequest record)
        => new(record.CatalogItemId, record.CatalogTypeId, JsonSerializer.Deserialize<List<ComposedOption>>(record.Options) ?? []);

    private static bool Same(LocalizedText a, LocalizedText b)
        => (a.En is { } ae && b.En is { } be && ae.Equals(be, StringComparison.OrdinalIgnoreCase))
           || (a.Ar is { } aa && b.Ar is { } ba && aa.Equals(ba, StringComparison.Ordinal));

    private static BadRequest<ProblemDetails> Bad(string detail) => TypedResults.BadRequest<ProblemDetails>(new() { Detail = detail });
}

/// <param name="CatalogTypeId">An existing category; null makes (or finds by name) <paramref name="NewCategoryName"/>.</param>
/// <param name="Customizations">The groups in the order they show, each option with the caller's reference.</param>
public sealed record ComposeItemRequest(
    LocalizedText Name,
    LocalizedText? Description,
    decimal Price,
    [property: Description("An existing category; null makes or finds NewCategoryName")] int? CatalogTypeId,
    LocalizedText? NewCategoryName,
    bool IsPopular = false,
    int? PreparationTimeMinutes = null,
    IReadOnlyList<ComposeGroup>? Customizations = null);

public sealed record ComposeGroup(LocalizedText Name, bool IsRequired, bool AllowMultiple, IReadOnlyList<ComposeOption> Options);

/// <param name="Ref">The caller's own number for the option, answered with the id it got.</param>
public sealed record ComposeOption(int Ref, LocalizedText Name, decimal PriceAdjustment, bool IsDefault);

public sealed record ComposeItemResult(int ItemId, int CatalogTypeId, IReadOnlyList<ComposedOption> Options);

public sealed record ComposedOption(int Ref, int Id);

using Chillax.AI.Agents;
using Chillax.AI.Http;
using Chillax.Catalog.API.Assist;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace Chillax.Catalog.API;

/// <summary>The assistant's endpoints on the catalog: proposals only, nothing here writes.</summary>
public static class CatalogAssistApi
{
    public static RouteGroupBuilder MapCatalogAssistApi(this RouteGroupBuilder api)
    {
        api.MapPost("/assist/localize", LocalizeMenuText)
            .WithName("LocalizeMenuText")
            .WithSummary("Fill in what a menu text is missing")
            .WithDescription("Given a name in English or Arabic (or both), the assistant fills in the other language of the name and description, writes a description when asked, and suggests a category when asked. Nothing is saved (Admin only).")
            .WithTags("Assist")
            .RequireAuthorization("Admin")
            .RequireRateLimiting(ChillaxAIRateLimiting.PolicyName);

        api.MapPost("/assist/customizations", SuggestCustomizations)
            .WithName("SuggestCustomizations")
            .WithSummary("Propose customization groups for a menu item")
            .WithDescription("The assistant proposes the option groups (size, sugar, extras…) a saved menu item is ordered with, in the menu's own wording, leaving out groups the item already has. Nothing is saved: add the ones you want through the customization endpoints (Admin only).")
            .WithTags("Assist")
            .RequireAuthorization("Admin")
            .RequireRateLimiting(ChillaxAIRateLimiting.PolicyName);

        return api;
    }

    public static async Task<Results<Ok<LocalizeResponse>, BadRequest<ProblemDetails>, ProblemHttpResult>> LocalizeMenuText(
        LocalizeRequest request,
        [FromServices] MenuLocalizer localizer,
        CatalogContext context,
        HttpContext httpContext,
        CancellationToken ct)
    {
        if (!localizer.IsEnabled)
            return AIProblems.NotConfigured();

        if (LocalizerPostProcessor.Validate(request) is { } error)
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = error });

        var categories = await context.CatalogTypes.AsNoTracking().OrderBy(c => c.DisplayOrder).ToListAsync(ct);

        try
        {
            return TypedResults.Ok(await localizer.LocalizeAsync(request, categories, ct));
        }
        catch (AIException ex)
        {
            return AIProblems.From(ex, httpContext);
        }
    }

    public static async Task<Results<Ok<SuggestCustomizationsResponse>, NotFound, ProblemHttpResult>> SuggestCustomizations(
        SuggestCustomizationsRequest request,
        [FromServices] CustomizationSuggester suggester,
        CatalogContext context,
        HttpContext httpContext,
        CancellationToken ct)
    {
        if (!suggester.IsEnabled)
            return AIProblems.NotConfigured();

        var item = await context.CatalogItems.AsNoTracking()
            .Include(i => i.CatalogType)
            .Include(i => i.Customizations).ThenInclude(c => c.Options)
            .FirstOrDefaultAsync(i => i.Id == request.ItemId, ct);
        if (item is null)
            return TypedResults.NotFound();

        // The rest of the menu's groups, the same category first, as examples of the house's wording;
        // the suggester keeps one per distinct shape so one item's five groups do not crowd the rest out.
        var examples = await context.ItemCustomizations.AsNoTracking()
            .Include(c => c.Options)
            .Include(c => c.CatalogItem)
            .Where(c => c.CatalogItemId != item.Id)
            .OrderByDescending(c => c.CatalogItem!.CatalogTypeId == item.CatalogTypeId)
            .ThenBy(c => c.CatalogItem!.DisplayOrder)
            .ThenBy(c => c.CatalogItemId)
            .ThenBy(c => c.DisplayOrder)
            .Take(CustomizationSuggester.MaxExamples * 5)
            .ToListAsync(ct);

        try
        {
            return TypedResults.Ok(await suggester.SuggestAsync(item, examples, ct));
        }
        catch (AIException ex)
        {
            return AIProblems.From(ex, httpContext);
        }
    }
}

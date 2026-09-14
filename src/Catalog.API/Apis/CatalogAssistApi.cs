using Chillax.AI;
using Chillax.AI.Agents;
using Chillax.AI.Http;
using Chillax.AI.Images;
using Chillax.Catalog.API.Assist;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

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
            .WithDescription("The assistant proposes the option groups (size, sugar, extras…) a menu item is ordered with, in the menu's own wording. The item is sent as the form has it, saved or not; groups it already has are left out. Nothing is saved: add the ones you want through the customization endpoints (Admin only).")
            .WithTags("Assist")
            .RequireAuthorization("Admin")
            .RequireRateLimiting(ChillaxAIRateLimiting.PolicyName);

        api.MapPost("/assist/menu/scan", ScanMenu)
            .WithName("ScanMenu")
            .WithSummary("Read a menu photo into proposed categories and items")
            .WithDescription("The assistant transcribes a photo of a menu — sections, items, prices, both languages — matching sections to existing categories and flagging items already on the menu. Nothing is saved: review the proposal, then create what you keep (Admin only).")
            .WithTags("Assist")
            .RequireAuthorization("Admin")
            .DisableAntiforgery()
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

    public static async Task<Results<Ok<SuggestCustomizationsResponse>, BadRequest<ProblemDetails>, ProblemHttpResult>> SuggestCustomizations(
        SuggestCustomizationsRequest request,
        [FromServices] CustomizationSuggester suggester,
        CatalogContext context,
        HttpContext httpContext,
        CancellationToken ct)
    {
        if (!suggester.IsEnabled)
            return AIProblems.NotConfigured();

        if (CustomizationsPostProcessor.Validate(request) is { } error)
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = error });

        var category = request.CatalogTypeId is { } typeId
            ? await context.CatalogTypes.AsNoTracking().FirstOrDefaultAsync(c => c.Id == typeId, ct)
            : null;

        // The menu's groups, the same category first, as examples of the house's wording; the suggester
        // keeps one per distinct shape so one item's five groups do not crowd the rest out.
        var examples = await context.ItemCustomizations.AsNoTracking()
            .Include(c => c.Options)
            .Include(c => c.CatalogItem)
            .OrderByDescending(c => c.CatalogItem!.CatalogTypeId == request.CatalogTypeId)
            .ThenBy(c => c.CatalogItem!.DisplayOrder)
            .ThenBy(c => c.CatalogItemId)
            .ThenBy(c => c.DisplayOrder)
            .Take(CustomizationSuggester.MaxExamples * 5)
            .ToListAsync(ct);

        try
        {
            return TypedResults.Ok(await suggester.SuggestAsync(request, category, examples, ct));
        }
        catch (AIException ex)
        {
            return AIProblems.From(ex, httpContext);
        }
    }

    public static async Task<Results<Ok<MenuProposal>, BadRequest<ProblemDetails>, ProblemHttpResult>> ScanMenu(
        IFormFile file,
        [FromServices] MenuScanner scanner,
        [FromServices] IOptions<AIOptions> aiOptions,
        CatalogContext context,
        HttpContext httpContext,
        CancellationToken ct)
    {
        if (!scanner.IsEnabled)
            return AIProblems.NotConfigured();

        var (image, error) = await ImageValidation.ReadAsync(file, aiOptions.Value.MaxImageBytes, ct);
        if (image is null)
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = error ?? "The menu photo could not be read." });

        var categories = await context.CatalogTypes.AsNoTracking().OrderBy(c => c.DisplayOrder).ToListAsync(ct);
        var items = await context.CatalogItems.AsNoTracking().ToListAsync(ct);

        try
        {
            return TypedResults.Ok(await scanner.ScanAsync(image, categories, items, ct));
        }
        catch (AIException ex)
        {
            return AIProblems.From(ex, httpContext);
        }
    }
}

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
            .WithSummary("Fill in the other language of a menu text")
            .WithDescription("Given a name (and, for a menu item, a description) in English or Arabic, the assistant fills in the other language and optionally suggests a category. Nothing is saved (Admin only).")
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
}

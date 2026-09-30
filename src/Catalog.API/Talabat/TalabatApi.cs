using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Ninja.Catalog.API.Talabat;

/// <param name="Connected">Whether the platform has handed this business the relay (Ninja has a Talabat account).</param>
/// <param name="Pending">Changes still on their way to Talabat.</param>
/// <param name="Failed">Changes Talabat refused in the last day, newest first.</param>
public sealed record TalabatStatusView(
    bool Connected,
    int[] BranchIds,
    bool SyncOpenClose,
    DateTime? MenuChangedAt,
    DateTime? MenuSentAt,
    string? LastMenuResult,
    DateTime? LastMenuResultAt,
    int Pending,
    IReadOnlyList<TalabatFailureView> Failed);

public sealed record TalabatFailureView(string Kind, int BranchId, string? Code, string? Error, DateTime At);

/// <param name="BranchIds">The branches that sell on Talabat.</param>
/// <param name="SyncOpenClose">A branch paused here closes on Talabat too.</param>
public sealed record TalabatSettingsRequest(int[] BranchIds, bool SyncOpenClose = true);

/// <param name="Status">in_progress, done, done_with_errors or failed.</param>
public sealed record TalabatImportResult(string Status, string? Message);

/// <summary>
/// The business's side of Talabat in its catalog: which branches sell there and
/// how their menus went, sending the menu now, and a look at exactly what
/// Talabat is sent. The platform uses the push when Talabat asks for a menu.
/// </summary>
public static class TalabatApi
{
    public static IEndpointRouteBuilder MapTalabatApi(this IEndpointRouteBuilder app)
    {
        var api = app.NewVersionedApi("Talabat").MapGroup("api/catalog/talabat").HasApiVersion(1.0);

        api.MapGet("/", GetStatus)
            .WithName("GetTalabat")
            .WithSummary("Talabat for the business: its branches there, the last menu sent and what Talabat said, what is still on its way or was refused")
            .RequireAuthorization("Owner");

        api.MapPut("/", SaveSettings)
            .WithName("SaveTalabat")
            .WithSummary("Which branches sell on Talabat, and whether pausing one here closes it there; a branch newly on Talabat gets its menu sent")
            .RequireAuthorization("Owner");

        api.MapPost("/push", Push)
            .WithName("PushTalabatMenu")
            .WithSummary("Send the menu to Talabat now: every branch on Talabat, or the one in X-Branch-Id (the platform's, when Talabat asks)")
            .RequireAuthorization("OwnerOrControl");

        api.MapGet("/preview/{branchId:int}", Preview)
            .WithName("PreviewTalabatMenu")
            .WithSummary("Exactly what Talabat would be sent for a branch")
            .RequireAuthorization("Owner");

        api.MapPost("/import-result", ImportResult)
            .WithName("TalabatImportResult")
            .WithSummary("How Talabat took the last menu, relayed by the platform")
            .RequireAuthorization("Control")
            .ExcludeFromDescription();

        return app;
    }

    public static async Task<Ok<TalabatStatusView>> GetStatus(CatalogContext context, IOptions<TalabatOptions> options)
    {
        var settings = await context.TalabatSettings.AsNoTracking().FirstOrDefaultAsync() ?? new TalabatSettings();
        var since = DateTime.UtcNow.AddDays(-1);
        var pending = await context.TalabatTasks.CountAsync(t => t.SentAt == null && t.AbandonedAt == null);
        var failed = await context.TalabatTasks.AsNoTracking()
            .Where(t => t.AbandonedAt != null && t.AbandonedAt > since)
            .OrderByDescending(t => t.Id).Take(20)
            .Select(t => new TalabatFailureView(t.Kind.ToString(), t.BranchId, t.Code, t.LastError, t.AbandonedAt!.Value))
            .ToListAsync();
        return TypedResults.Ok(new TalabatStatusView(
            options.Value.Configured, settings.BranchIds, settings.SyncOpenClose,
            settings.MenuChangedAt, settings.MenuSentAt, settings.LastMenuResult, settings.LastMenuResultAt,
            pending, failed));
    }

    public static async Task<Results<Ok<TalabatStatusView>, BadRequest<string>>> SaveSettings(
        CatalogContext context, IOptions<TalabatOptions> options, TalabatSettingsRequest request)
    {
        if (request.BranchIds.Any(id => id <= 0))
            return TypedResults.BadRequest("Branch ids are positive.");

        var settings = await context.TalabatSettings.FirstOrDefaultAsync();
        if (settings is null)
        {
            settings = new TalabatSettings();
            context.TalabatSettings.Add(settings);
        }

        var added = request.BranchIds.Except(settings.BranchIds).ToList();
        settings.BranchIds = request.BranchIds.Distinct().Order().ToArray();
        settings.SyncOpenClose = request.SyncOpenClose;
        // A branch new to Talabat needs its menu before it can take an order
        if (added.Count > 0)
            TalabatSyncService.QueueMenu(context, settings, added, DateTime.UtcNow);

        await context.SaveChangesAsync();
        return TypedResults.Ok((await GetStatus(context, options)).Value!);
    }

    public static async Task<Results<Accepted, Conflict<string>>> Push(HttpContext http, CatalogContext context)
    {
        var settings = await context.TalabatSettings.FirstOrDefaultAsync();
        if (settings is null || settings.BranchIds.Length == 0)
            return TypedResults.Conflict("No branch is on Talabat.");

        var branches = http.Request.Headers.TryGetValue("X-Branch-Id", out var header) && int.TryParse(header, out var one)
            ? [one]
            : settings.BranchIds;
        if (!branches.Any(settings.IsOn))
            return TypedResults.Conflict("That branch is not on Talabat.");

        TalabatSyncService.QueueMenu(context, settings, branches, DateTime.UtcNow);
        await context.SaveChangesAsync();
        return TypedResults.Accepted((string?)null);
    }

    public static async Task<Ok<JsonObject>> Preview(CatalogContext context, IOptions<CatalogOptions> catalog, int branchId)
        => TypedResults.Ok(await TalabatSyncService.BuildMenuAsync(context, branchId, catalog.Value.PicBaseUrl, default));

    public static async Task<Ok> ImportResult(CatalogContext context, TalabatImportResult result)
    {
        if (await context.TalabatSettings.FirstOrDefaultAsync() is { } settings)
        {
            var text = string.IsNullOrWhiteSpace(result.Message) ? result.Status : $"{result.Status}: {result.Message}";
            settings.LastMenuResult = text.Length > 1000 ? text[..1000] : text;
            settings.LastMenuResultAt = DateTime.UtcNow;
            await context.SaveChangesAsync();
        }
        return TypedResults.Ok();
    }
}

/// <summary>Tenant.API's branch flags, as Catalog hears them: the pause switch opens and closes the branch on Talabat.</summary>
public record BranchSettingsChangedIntegrationEvent(
    int BranchId,
    bool IsOrderingEnabled,
    bool IsReservationsEnabled,
    bool RequireSignInForTableOrders = false) : IntegrationEvent;

public class BranchSettingsChangedIntegrationEventHandler(CatalogContext context, ILogger<BranchSettingsChangedIntegrationEventHandler> logger)
    : IIntegrationEventHandler<BranchSettingsChangedIntegrationEvent>
{
    public async Task Handle(BranchSettingsChangedIntegrationEvent @event)
    {
        var settings = await context.TalabatSettings.AsNoTracking().FirstOrDefaultAsync();
        if (settings is null || !settings.SyncOpenClose || !settings.IsOn(@event.BranchId))
            return;

        var now = DateTime.UtcNow;
        context.TalabatTasks.Add(new TalabatTask
        {
            Kind = TalabatTaskKind.Store,
            BranchId = @event.BranchId,
            Open = @event.IsOrderingEnabled,
            CreatedAt = now,
            NextAttemptAt = now,
        });
        await context.SaveChangesAsync();
        logger.LogInformation("Branch {BranchId} {State} on Talabat", @event.BranchId, @event.IsOrderingEnabled ? "opens" : "closes");
    }
}

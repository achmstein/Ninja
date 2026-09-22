using System.ComponentModel;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Ninja.Control.API.Infrastructure;
using Ninja.Control.API.Model;
using Ninja.Control.API.Platform;

namespace Ninja.Control.API.Apis;

/// <summary>A running tenant from the outside: its containers, their logs, the services' health, and the café's figures through its own APIs.</summary>
public static partial class ControlApi
{
    private static void MapOpsApi(RouteGroupBuilder api)
    {
        api.MapGet("/tenants/{slug}/containers", GetContainers).WithName("GetTenantContainers").WithSummary("Every container of the stack, as docker compose ps reports it").RequireAuthorization("Platform");
        api.MapGet("/tenants/{slug}/logs", GetLogs).WithName("GetTenantLogs").WithSummary("The last lines of one service's log, or the whole stack's").RequireAuthorization("Platform");
        api.MapGet("/tenants/{slug}/health", GetHealth).WithName("GetTenantHealth").WithSummary("Each service's /health through the gateway, with how long it took").RequireAuthorization("Platform");
        api.MapGet("/tenants/{slug}/metrics", GetMetrics).WithName("GetTenantMetrics").WithSummary("Orders, sales, profit and loyalty over the last days, from the stack's own APIs").RequireAuthorization("Platform");
    }

    public static async Task<Results<Ok<IReadOnlyList<ContainerInfo>>, NotFound, Conflict<ProblemDetails>, ProblemHttpResult>> GetContainers(ControlContext context, TenantOps ops, string slug, CancellationToken ct)
    {
        var tenant = await context.Tenants.AsNoTracking().SingleOrDefaultAsync(t => t.Slug == slug, ct);
        if (tenant is null) return TypedResults.NotFound();
        if (!Stamped(tenant)) return TypedResults.Conflict<ProblemDetails>(new() { Detail = $"{slug} has no stack: it is {tenant.Status}." });
        try
        {
            return TypedResults.Ok(await ops.ContainersAsync(tenant, ct));
        }
        catch (InvalidOperationException ex)
        {
            return TypedResults.Problem(detail: ex.Message, statusCode: StatusCodes.Status502BadGateway);
        }
    }

    public static async Task<Results<ContentHttpResult, NotFound, BadRequest<ProblemDetails>, Conflict<ProblemDetails>, ProblemHttpResult>> GetLogs(
        ControlContext context, TenantOps ops, string slug,
        [Description("catalog, ordering, … or gateway; every service when left out")] string? service = null,
        [Description("Lines from the end, 10 to 2000")] int tail = 200,
        CancellationToken ct = default)
    {
        var tenant = await context.Tenants.AsNoTracking().SingleOrDefaultAsync(t => t.Slug == slug, ct);
        if (tenant is null) return TypedResults.NotFound();
        // Only what the plan stamps has a log
        var sources = TenantOps.LogSources(tenant);
        if (service is not null && !sources.Contains(service))
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = $"service must be one of {string.Join(", ", sources)}." });
        if (!Stamped(tenant)) return TypedResults.Conflict<ProblemDetails>(new() { Detail = $"{slug} has no stack: it is {tenant.Status}." });
        try
        {
            return TypedResults.Text(await ops.LogsAsync(tenant, service, Math.Clamp(tail, 10, 2000), ct), "text/plain; charset=utf-8");
        }
        catch (InvalidOperationException ex)
        {
            return TypedResults.Problem(detail: ex.Message, statusCode: StatusCodes.Status502BadGateway);
        }
    }

    public static async Task<Results<Ok<IReadOnlyList<ServiceHealth>>, NotFound, Conflict<ProblemDetails>>> GetHealth(ControlContext context, TenantOps ops, string slug, CancellationToken ct)
    {
        var tenant = await context.Tenants.AsNoTracking().SingleOrDefaultAsync(t => t.Slug == slug, ct);
        if (tenant is null) return TypedResults.NotFound();
        if (tenant.Status != TenantStatus.Running) return TypedResults.Conflict<ProblemDetails>(new() { Detail = $"{slug} is {tenant.Status}." });
        return TypedResults.Ok(await ops.HealthAsync(tenant, ct));
    }

    public static async Task<Results<Ok<TenantMetrics>, NotFound, Conflict<ProblemDetails>>> GetMetrics(
        ControlContext context, TenantMetricsCollector collector, string slug,
        [Description("How many days back, ending today; 1 to 90")] int days = 7,
        CancellationToken ct = default)
    {
        var tenant = await context.Tenants.AsNoTracking().SingleOrDefaultAsync(t => t.Slug == slug, ct);
        if (tenant is null) return TypedResults.NotFound();
        if (tenant.Status != TenantStatus.Running) return TypedResults.Conflict<ProblemDetails>(new() { Detail = $"{slug} is {tenant.Status}." });
        return TypedResults.Ok(await collector.CollectAsync(tenant, Math.Clamp(days, 1, 90), ct));
    }

    /// <summary>A stack exists on the box for these; the rest have nothing to list.</summary>
    private static bool Stamped(Tenant tenant) => tenant.Status is TenantStatus.Running or TenantStatus.Stopped or TenantStatus.Failed or TenantStatus.Provisioning or TenantStatus.Upgrading;
}

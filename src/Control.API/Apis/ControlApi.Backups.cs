using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Ninja.Control.API.Infrastructure;
using Ninja.Control.API.Model;
using Ninja.Control.API.Platform;

namespace Ninja.Control.API.Apis;

/// <summary>A tenant's backups: taken on demand or nightly, listed, downloaded, and restored into a new slug; and the platform's own.</summary>
public static partial class ControlApi
{
    private static void MapBackupsApi(RouteGroupBuilder api)
    {
        api.MapGet("/platform/backups", GetPlatformBackups).WithName("GetPlatformBackups").WithSummary("The platform's own backups (controldb, keycloak), when the last one ran and reached the bucket, and whether a night was missed").RequireAuthorization("Platform");
        api.MapPost("/platform/backups", CreatePlatformBackup).WithName("CreatePlatformBackup").WithSummary("Dump the platform's databases now, and copy them off the box when there is somewhere to").RequireAuthorization("Platform");
        api.MapGet("/platform/backups/{id}/download", DownloadPlatformBackup).WithName("DownloadPlatformBackup").WithSummary("The backup as one .tar.gz").RequireAuthorization("Platform");

        api.MapGet("/tenants/{slug}/backups", ListBackups).WithName("ListTenantBackups").WithSummary("Every backup kept for the tenant, newest first").RequireAuthorization("Platform");
        api.MapPost("/tenants/{slug}/backups", CreateBackup).WithName("CreateTenantBackup").WithSummary("Dump the databases and the uploads now (queued behind any stamp in progress)").RequireAuthorization("Platform");
        api.MapGet("/tenants/{slug}/backups/{id}/download", DownloadBackup).WithName("DownloadTenantBackup").WithSummary("The backup as one .tar.gz").RequireAuthorization("Platform");
        api.MapDelete("/tenants/{slug}/backups/{id}", DeleteBackup).WithName("DeleteTenantBackup").RequireAuthorization("Platform");
        api.MapPost("/tenants/{slug}/backups/{id}/restore", RestoreBackup).WithName("RestoreTenantBackup").WithSummary("A new tenant, stamped from this backup: its databases and uploads, a fresh realm and owner").RequireAuthorization("Platform");
    }

    public static async Task<Results<Ok<IReadOnlyList<BackupInfo>>, NotFound>> ListBackups(ControlContext context, BackupService backups, string slug, CancellationToken ct)
    {
        if (!await context.Tenants.AnyAsync(t => t.Slug == slug, ct)) return TypedResults.NotFound();
        return TypedResults.Ok(backups.List(slug));
    }

    public static Task<Results<Accepted, NotFound, Conflict<ProblemDetails>>> CreateBackup(ControlContext context, ProvisioningQueue queue, IAuditWriter audit, string slug, CancellationToken ct)
        => Enqueue(context, queue, audit, slug, "backup", [TenantStatus.Running, TenantStatus.Stopped], ct);

    public static async Task<Results<PushStreamHttpResult, NotFound>> DownloadBackup(ControlContext context, BackupService backups, string slug, string id, CancellationToken ct)
    {
        if (!await context.Tenants.AnyAsync(t => t.Slug == slug, ct) || backups.Find(slug, id) is null) return TypedResults.NotFound();
        return TypedResults.Stream(output => backups.WriteArchiveAsync(slug, id, output, ct), "application/gzip", $"{slug}-{id}.tar.gz");
    }

    public static async Task<Results<NoContent, NotFound>> DeleteBackup(ControlContext context, BackupService backups, IAuditWriter audit, string slug, string id, CancellationToken ct)
    {
        if (!await context.Tenants.AnyAsync(t => t.Slug == slug, ct) || !backups.Delete(slug, id)) return TypedResults.NotFound();
        await backups.DeleteOffsiteAsync(slug, id, ct);
        await audit.WriteAsync("backup.deleted", slug, new { id }, ct);
        return TypedResults.NoContent();
    }

    public static Ok<PlatformBackupsResponse> GetPlatformBackups(PlatformBackupService platform)
        => TypedResults.Ok(platform.Status());

    public static async Task<Results<Ok<BackupInfo>, ProblemHttpResult>> CreatePlatformBackup(PlatformBackupService platform, CancellationToken ct)
    {
        try
        {
            return TypedResults.Ok(await platform.RunAsync(ct));
        }
        catch (Exception ex) when (!ct.IsCancellationRequested)
        {
            return TypedResults.Problem(ex.Message, statusCode: StatusCodes.Status500InternalServerError);
        }
    }

    public static Results<PushStreamHttpResult, NotFound> DownloadPlatformBackup(BackupService backups, string id, CancellationToken ct)
    {
        if (backups.Find(BackupService.PlatformSlug, id) is null) return TypedResults.NotFound();
        return TypedResults.Stream(output => backups.WriteArchiveAsync(BackupService.PlatformSlug, id, output, ct), "application/gzip", $"platform-{id}.tar.gz");
    }

    public static async Task<Results<Created<TenantDetail>, NotFound, BadRequest<ProblemDetails>, Conflict<ProblemDetails>>> RestoreBackup(
        ControlContext context, BackupService backups, ProvisioningQueue queue, IAuditWriter audit, CapacityCache capacity, IOptions<PlatformOptions> options,
        string slug, string id, RestoreRequest request, CancellationToken ct)
    {
        var source = await context.Tenants.AsNoTracking().SingleOrDefaultAsync(t => t.Slug == slug, ct);
        if (source is null || backups.Find(slug, id) is null) return TypedResults.NotFound();

        var into = request.IntoSlug?.Trim().ToLowerInvariant();
        if (into is null || !TenantNaming.IsValidSlug(into))
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "The new slug must be 3–24 lower-case letters, digits and single dashes, and not a reserved word." });
        if (await context.Tenants.AnyAsync(t => t.Slug == into, ct))
            return TypedResults.Conflict<ProblemDetails>(new() { Detail = $"{into} is taken; a restore makes a new tenant." });
        if (!request.Force && !capacity.HasRoom)
            return TypedResults.Conflict<ProblemDetails>(new() { Detail = NoRoom(capacity, options.Value) });

        // A restored café is the same café under a new slug: its name, look, locale and record come along; the realm and the owner are new
        var tenant = new Tenant
        {
            Slug = into,
            NameEn = Clean(request.NameEn) ?? source.NameEn,
            NameAr = source.NameAr,
            Kind = TenantKind.Customer,
            Seed = TenantSeed.None,
            Plan = source.Plan,
            PrimaryColor = source.PrimaryColor,
            OwnerEmail = Clean(request.OwnerEmail)?.ToLowerInvariant() ?? source.OwnerEmail,
            ContactName = source.ContactName,
            Phone = source.Phone,
            Address = source.Address,
            Notes = source.Notes,
            Country = source.Country,
            Currency = source.Currency,
            TimeZone = source.TimeZone,
            DefaultLanguage = source.DefaultLanguage,
            IdentitySecret = TenantNaming.NewSecret(),
            ControlSecret = TenantNaming.NewSecret(),
            ImageTag = options.Value.DefaultImageTag,
            RestoreFrom = $"{slug}/{id}",
        };
        context.Tenants.Add(tenant);
        await context.SaveChangesAsync(ct);
        await audit.WriteAsync("backup.restore", into, new { from = slug, id }, ct);
        await queue.EnqueueAsync(new ProvisioningJob(tenant.Id, "provision"), ct);

        return TypedResults.Created($"/api/control/tenants/{into}", TenantDetail.From(tenant, [], [], options.Value));
    }
}

/// <param name="IntoSlug">The new tenant's slug; the source keeps running.</param>
/// <param name="NameEn">A new name, or the source's.</param>
/// <param name="OwnerEmail">A new owner, or the source's; either way a new realm with a temporary password (customer accounts are not in a backup).</param>
public record RestoreRequest(string IntoSlug, string? NameEn = null, string? OwnerEmail = null, bool Force = false);

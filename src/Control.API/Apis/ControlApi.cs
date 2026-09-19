using System.ComponentModel;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Ninja.Control.API.Infrastructure;
using Ninja.Control.API.Model;
using Ninja.Control.API.Platform;

namespace Ninja.Control.API.Apis;

/// <summary>Tenants and demos: list, stamp, stop, start, upgrade, destroy; and the two anonymous answers the edge needs.</summary>
public static partial class ControlApi
{
    public static IEndpointRouteBuilder MapControlApi(this IEndpointRouteBuilder app)
    {
        var api = app.MapGroup("api/control").WithTags("Control");

        api.MapGet("/platform", GetPlatform).WithName("GetPlatform").WithSummary("The platform's domain and counts").RequireAuthorization("Platform");

        api.MapGet("/tenants", ListTenants).WithName("ListTenants").WithSummary("Every tenant, newest first").RequireAuthorization("Platform");
        api.MapPost("/tenants", CreateTenant).WithName("CreateTenant").WithSummary("Register a tenant and stamp its stack").RequireAuthorization("Platform");
        api.MapGet("/tenants/{slug}", GetTenant).WithName("GetTenant").WithSummary("One tenant with its latest run").RequireAuthorization("Platform");
        api.MapPut("/tenants/{slug}/logo", UploadLogo).WithName("UploadTenantSeedLogo").WithSummary("The logo seeded into the stack on the next provision").RequireAuthorization("Platform").DisableAntiforgery();
        api.MapPost("/tenants/{slug}/provision", Provision).WithName("ProvisionTenant").WithSummary("Run (or retry) provisioning").RequireAuthorization("Platform");
        api.MapPost("/tenants/{slug}/stop", Stop).WithName("StopTenant").RequireAuthorization("Platform");
        api.MapPost("/tenants/{slug}/start", Start).WithName("StartTenant").RequireAuthorization("Platform");
        api.MapPost("/tenants/{slug}/upgrade", Upgrade).WithName("UpgradeTenant").WithSummary("Re-stamp on a tag and pull").RequireAuthorization("Platform");
        api.MapPost("/tenants/{slug}/extend", Extend).WithName("ExtendDemo").WithSummary("Push a demo's expiry out").RequireAuthorization("Platform");
        api.MapDelete("/tenants/{slug}", Destroy).WithName("DestroyTenant").WithSummary("Take the stack, realm, vhost and databases down").RequireAuthorization("Platform");

        // Caddy asks before issuing a certificate on demand: only hosts we know
        api.MapGet("/tls/ask", TlsAsk).WithName("TlsAsk").WithSummary("200 when the host belongs to a tenant, 404 otherwise").AllowAnonymous();

        return app;
    }

    public static async Task<Ok<PlatformResponse>> GetPlatform(ControlContext context, IOptions<PlatformOptions> options)
    {
        var counts = await context.Tenants.GroupBy(t => t.Status).Select(g => new { g.Key, Count = g.Count() }).ToListAsync();
        return TypedResults.Ok(new PlatformResponse(
            options.Value.Domain,
            options.Value.DefaultImageTag,
            options.Value.DemoDays,
            options.Value.DryRun,
            counts.Where(c => c.Key == TenantStatus.Running).Sum(c => c.Count),
            counts.Where(c => c.Key != TenantStatus.Destroyed).Sum(c => c.Count)));
    }

    public static async Task<Ok<List<TenantSummary>>> ListTenants(ControlContext context, IOptions<PlatformOptions> options)
    {
        var tenants = await context.Tenants.AsNoTracking().OrderByDescending(t => t.CreatedAt).ToListAsync();
        return TypedResults.Ok(tenants.Select(t => TenantSummary.From(t, options.Value)).ToList());
    }

    public static async Task<Results<Created<TenantDetail>, BadRequest<ProblemDetails>, Conflict<ProblemDetails>>> CreateTenant(
        ControlContext context,
        ProvisioningQueue queue,
        IOptions<PlatformOptions> options,
        CreateTenantRequest request,
        CancellationToken ct)
    {
        var slug = string.IsNullOrWhiteSpace(request.Slug) ? TenantNaming.SlugFrom(request.NameEn) : request.Slug.Trim().ToLowerInvariant();
        if (slug is null || !TenantNaming.IsValidSlug(slug))
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "The slug must be 3–24 lower-case letters, digits and single dashes, and not a reserved word." });
        if (string.IsNullOrWhiteSpace(request.NameEn))
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "The English name is required." });
        if (string.IsNullOrWhiteSpace(request.OwnerEmail) || !request.OwnerEmail.Contains('@'))
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "The owner's email is required." });
        var color = request.PrimaryColor?.Trim().ToLowerInvariant();
        if (!string.IsNullOrEmpty(color) && !HexColor().IsMatch(color))
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "The color must be #rrggbb." });
        if (await context.Tenants.AnyAsync(t => t.Slug == slug, ct))
            return TypedResults.Conflict<ProblemDetails>(new() { Detail = $"{slug} is taken." });

        var tenant = new Tenant
        {
            Slug = slug,
            NameEn = request.NameEn.Trim(),
            NameAr = string.IsNullOrWhiteSpace(request.NameAr) ? null : request.NameAr.Trim(),
            Kind = request.Kind,
            PrimaryColor = string.IsNullOrEmpty(color) ? null : color,
            CustomerDomain = string.IsNullOrWhiteSpace(request.CustomerDomain) ? null : request.CustomerDomain.Trim().ToLowerInvariant(),
            OwnerEmail = request.OwnerEmail.Trim().ToLowerInvariant(),
            IdentitySecret = TenantNaming.NewSecret(),
            ControlSecret = TenantNaming.NewSecret(),
            ImageTag = options.Value.DefaultImageTag,
            ExpiresAt = request.Kind == TenantKind.Demo ? DateTimeOffset.UtcNow.AddDays(request.DemoDays ?? options.Value.DemoDays) : null,
        };
        context.Tenants.Add(tenant);
        await context.SaveChangesAsync(ct);

        if (request.Provision ?? true)
            await queue.EnqueueAsync(new ProvisioningJob(tenant.Id, "provision"), ct);

        return TypedResults.Created($"/api/control/tenants/{tenant.Slug}", TenantDetail.From(tenant, [], options.Value));
    }

    public static async Task<Results<Ok<TenantDetail>, NotFound>> GetTenant(ControlContext context, IOptions<PlatformOptions> options, string slug)
    {
        var tenant = await context.Tenants.AsNoTracking().SingleOrDefaultAsync(t => t.Slug == slug);
        if (tenant is null) return TypedResults.NotFound();
        var lastRun = await context.Steps.AsNoTracking().Where(s => s.TenantId == tenant.Id).OrderByDescending(s => s.Id).Select(s => s.RunId).FirstOrDefaultAsync();
        var steps = lastRun == Guid.Empty ? [] : await context.Steps.AsNoTracking().Where(s => s.TenantId == tenant.Id && s.RunId == lastRun).OrderBy(s => s.Id).ToListAsync();
        return TypedResults.Ok(TenantDetail.From(tenant, steps, options.Value));
    }

    public static async Task<Results<NoContent, NotFound, BadRequest<ProblemDetails>>> UploadLogo(ControlContext context, Provisioner provisioner, string slug, IFormFile file, CancellationToken ct)
    {
        var tenant = await context.Tenants.AsNoTracking().SingleOrDefaultAsync(t => t.Slug == slug, ct);
        if (tenant is null) return TypedResults.NotFound();
        if (file.Length == 0 || file.Length > 5 * 1024 * 1024)
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "The image must be between 1 byte and 5 MB." });
        var path = provisioner.LogoPath(tenant);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        await using var target = File.Create(path);
        await file.CopyToAsync(target, ct);
        return TypedResults.NoContent();
    }

    public static Task<Results<Accepted, NotFound, Conflict<ProblemDetails>>> Provision(ControlContext context, ProvisioningQueue queue, string slug, CancellationToken ct)
        // A destroyed tenant can be brought back under the same slug: the steps recreate everything
        => Enqueue(context, queue, slug, "provision", [TenantStatus.Requested, TenantStatus.Failed, TenantStatus.Stopped, TenantStatus.Running, TenantStatus.Destroyed], ct);

    public static Task<Results<Accepted, NotFound, Conflict<ProblemDetails>>> Stop(ControlContext context, ProvisioningQueue queue, string slug, CancellationToken ct)
        => Enqueue(context, queue, slug, "stop", [TenantStatus.Running, TenantStatus.Failed], ct);

    public static Task<Results<Accepted, NotFound, Conflict<ProblemDetails>>> Start(ControlContext context, ProvisioningQueue queue, string slug, CancellationToken ct)
        => Enqueue(context, queue, slug, "start", [TenantStatus.Stopped, TenantStatus.Failed], ct);

    public static async Task<Results<Accepted, NotFound, Conflict<ProblemDetails>>> Upgrade(ControlContext context, ProvisioningQueue queue, string slug, UpgradeRequest? request, CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(request?.ImageTag))
        {
            var tenant = await context.Tenants.SingleOrDefaultAsync(t => t.Slug == slug, ct);
            if (tenant is null) return TypedResults.NotFound();
            tenant.ImageTag = request.ImageTag.Trim();
            await context.SaveChangesAsync(ct);
        }
        return await Enqueue(context, queue, slug, "upgrade", [TenantStatus.Running, TenantStatus.Stopped, TenantStatus.Failed], ct);
    }

    public static async Task<Results<Ok<TenantDetail>, NotFound, BadRequest<ProblemDetails>>> Extend(ControlContext context, IOptions<PlatformOptions> options, string slug, ExtendRequest request, CancellationToken ct)
    {
        var tenant = await context.Tenants.SingleOrDefaultAsync(t => t.Slug == slug, ct);
        if (tenant is null) return TypedResults.NotFound();
        if (tenant.Kind != TenantKind.Demo)
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "Only demos expire." });
        var from = tenant.ExpiresAt is { } e && e > DateTimeOffset.UtcNow ? e : DateTimeOffset.UtcNow;
        tenant.ExpiresAt = from.AddDays(Math.Clamp(request.Days, 1, 365));
        await context.SaveChangesAsync(ct);
        return TypedResults.Ok(TenantDetail.From(tenant, [], options.Value));
    }

    public static Task<Results<Accepted, NotFound, Conflict<ProblemDetails>>> Destroy(ControlContext context, ProvisioningQueue queue, string slug, CancellationToken ct)
        => Enqueue(context, queue, slug, "destroy", [TenantStatus.Running, TenantStatus.Stopped, TenantStatus.Failed, TenantStatus.Requested], ct);

    private static async Task<Results<Accepted, NotFound, Conflict<ProblemDetails>>> Enqueue(ControlContext context, ProvisioningQueue queue, string slug, string action, TenantStatus[] allowedFrom, CancellationToken ct)
    {
        var tenant = await context.Tenants.AsNoTracking().SingleOrDefaultAsync(t => t.Slug == slug, ct);
        if (tenant is null) return TypedResults.NotFound();
        if (!allowedFrom.Contains(tenant.Status))
            return TypedResults.Conflict<ProblemDetails>(new() { Detail = $"Cannot {action} a tenant that is {tenant.Status}." });
        await queue.EnqueueAsync(new ProvisioningJob(tenant.Id, action), ct);
        return TypedResults.Accepted($"/api/control/tenants/{slug}");
    }

    public static async Task<Results<Ok, NotFound>> TlsAsk(ControlContext context, IOptions<PlatformOptions> options, [Description("The host Caddy is about to issue a certificate for")] string domain)
    {
        var host = domain.Trim().ToLowerInvariant();
        var platform = options.Value;
        if (host == $"auth.{platform.Domain}" || host == $"control.{platform.Domain}" || host == platform.Domain)
            return TypedResults.Ok();

        var tenants = await context.Tenants.AsNoTracking().Where(t => t.Status != TenantStatus.Destroyed).ToListAsync();
        return tenants.Any(t => TenantHosts.For(t, platform).All.Contains(host)) ? TypedResults.Ok() : TypedResults.NotFound();
    }

    [GeneratedRegex("^#[0-9a-f]{6}$")]
    private static partial Regex HexColor();
}

public record PlatformResponse(string Domain, string DefaultImageTag, int DemoDays, bool DryRun, int Running, int Total);

public record CreateTenantRequest(
    string NameEn,
    string? NameAr,
    string OwnerEmail,
    TenantKind Kind = TenantKind.Demo,
    string? Slug = null,
    string? PrimaryColor = null,
    string? CustomerDomain = null,
    int? DemoDays = null,
    bool? Provision = true);

public record UpgradeRequest(string? ImageTag);

public record ExtendRequest(int Days);

public record TenantHostsDto(string Customer, string Admin, string Pos, string Kds, string Api)
{
    public static TenantHostsDto From(TenantHosts h) => new(h.CustomerUrl, h.AdminUrl, h.PosUrl, h.KdsUrl, h.ApiUrl);
}

public record TenantSummary(string Slug, string NameEn, string? NameAr, TenantKind Kind, TenantStatus Status, string CustomerUrl, DateTimeOffset CreatedAt, DateTimeOffset? ExpiresAt, string ImageTag, string? LastError)
{
    public static TenantSummary From(Tenant t, PlatformOptions p)
        => new(t.Slug, t.NameEn, t.NameAr, t.Kind, t.Status, TenantHosts.For(t, p).CustomerUrl, t.CreatedAt, t.ExpiresAt, t.ImageTag, t.LastError);
}

public record StepDto(string Name, StepStatus Status, DateTimeOffset StartedAt, DateTimeOffset? FinishedAt, string? Output);

public record TenantDetail(
    string Slug,
    string NameEn,
    string? NameAr,
    TenantKind Kind,
    TenantStatus Status,
    string? PrimaryColor,
    TenantHostsDto Hosts,
    string OwnerEmail,
    string? OwnerInitialPassword,
    string ImageTag,
    DateTimeOffset CreatedAt,
    DateTimeOffset? ExpiresAt,
    DateTimeOffset? ProvisionedAt,
    string? LastError,
    IReadOnlyList<StepDto> Steps)
{
    public static TenantDetail From(Tenant t, IReadOnlyList<ProvisioningStep> steps, PlatformOptions p)
        => new(t.Slug, t.NameEn, t.NameAr, t.Kind, t.Status, t.PrimaryColor, TenantHostsDto.From(TenantHosts.For(t, p)), t.OwnerEmail, t.OwnerInitialPassword,
            t.ImageTag, t.CreatedAt, t.ExpiresAt, t.ProvisionedAt, t.LastError,
            steps.Select(s => new StepDto(s.Name, s.Status, s.StartedAt, s.FinishedAt, s.Output)).ToList());
}

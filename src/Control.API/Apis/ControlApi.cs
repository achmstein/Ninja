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

        api.MapGet("/platform", GetPlatform).WithName("GetPlatform").WithSummary("The platform's domain, counts and room for more").RequireAuthorization("Platform");
        api.MapGet("/platform/capacity", GetCapacity).WithName("GetPlatformCapacity").WithSummary("What the box has and what each stack takes; refresh=true reads it now").RequireAuthorization("Platform");

        api.MapGet("/tenants", ListTenants).WithName("ListTenants").WithSummary("Every tenant, newest first").RequireAuthorization("Platform");
        api.MapPost("/tenants", CreateTenant).WithName("CreateTenant").WithSummary("Register a tenant and stamp its stack").RequireAuthorization("Platform");
        api.MapGet("/tenants/{slug}", GetTenant).WithName("GetTenant").WithSummary("One tenant with its latest run").RequireAuthorization("Platform");
        api.MapPost("/tenants/{slug}/provision", Provision).WithName("ProvisionTenant").WithSummary("Run (or retry) provisioning").RequireAuthorization("Platform");
        api.MapPost("/tenants/{slug}/stop", Stop).WithName("StopTenant").RequireAuthorization("Platform");
        api.MapPost("/tenants/{slug}/start", Start).WithName("StartTenant").RequireAuthorization("Platform");
        api.MapPost("/tenants/{slug}/upgrade", Upgrade).WithName("UpgradeTenant").WithSummary("Re-stamp on a tag and pull").RequireAuthorization("Platform");
        api.MapPost("/tenants/{slug}/extend", Extend).WithName("ExtendDemo").WithSummary("Push a demo's expiry out").RequireAuthorization("Platform");
        api.MapDelete("/tenants/{slug}", Destroy).WithName("DestroyTenant").WithSummary("Take the stack, realm, vhost and databases down").RequireAuthorization("Platform");

        MapBrandApi(api);
        MapRecordApi(api);
        MapOpsApi(api);
        MapImpersonationApi(api);
        MapBackupsApi(api);

        // Caddy asks before issuing a certificate on demand: only hosts we know
        api.MapGet("/tls/ask", TlsAsk).WithName("TlsAsk").WithSummary("200 when the host belongs to a tenant, 404 otherwise").AllowAnonymous();

        return app;
    }

    public static async Task<Ok<PlatformResponse>> GetPlatform(ControlContext context, CapacityCache capacity, IOptions<PlatformOptions> options, CancellationToken ct)
    {
        var counts = await context.Tenants.GroupBy(t => t.Status).Select(g => new { g.Key, Count = g.Count() }).ToListAsync(ct);
        var snapshot = await capacity.GetAsync(refresh: false, ct);
        return TypedResults.Ok(new PlatformResponse(
            options.Value.Domain,
            options.Value.DefaultImageTag,
            options.Value.DemoDays,
            options.Value.DryRun,
            counts.Where(c => c.Key == TenantStatus.Running).Sum(c => c.Count),
            counts.Where(c => c.Key != TenantStatus.Destroyed).Sum(c => c.Count),
            capacity.RoomFor(snapshot)));
    }

    public static async Task<Ok<CapacityResponse>> GetCapacity(
        ControlContext context, CapacityCache capacity, IOptions<PlatformOptions> options,
        [Description("Read the box now instead of the last snapshot")] bool refresh = false,
        CancellationToken ct = default)
    {
        var snapshot = await capacity.GetAsync(refresh, ct);
        // Compose projects are ninja-{slug}; the platform's own project is the shared services
        var slugs = await context.Tenants.AsNoTracking().Where(t => t.Status != TenantStatus.Destroyed).Select(t => t.Slug).ToListAsync(ct);
        var tenants = snapshot.Projects
            .Select(p => new TenantUsage(p.Project, slugs.FirstOrDefault(s => TenantNaming.Project(s) == p.Project), p.Containers, p.Running, p.MemoryMb, p.CpuPercent))
            .ToList();
        return TypedResults.Ok(new CapacityResponse(
            snapshot.At, snapshot.MemTotalMb, snapshot.MemAvailableMb, snapshot.Load, snapshot.Cpus,
            snapshot.TenantsDiskFreeMb, snapshot.TenantsDiskTotalMb, snapshot.DockerUsedMb, snapshot.DockerReclaimableMb,
            options.Value.StackFootprintMb, options.Value.ReserveMb, capacity.RoomFor(snapshot), tenants));
    }

    public static async Task<Ok<List<TenantSummary>>> ListTenants(ControlContext context, IOptions<PlatformOptions> options)
    {
        var tenants = await context.Tenants.AsNoTracking().OrderByDescending(t => t.CreatedAt).ToListAsync();
        return TypedResults.Ok(tenants.Select(t => TenantSummary.From(t, options.Value)).ToList());
    }

    public static async Task<Results<Created<TenantDetail>, BadRequest<ProblemDetails>, Conflict<ProblemDetails>>> CreateTenant(
        ControlContext context,
        ProvisioningQueue queue,
        IAuditWriter audit,
        CapacityCache capacity,
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
        var locale = LocaleFields.Normalize(request.Country, request.Currency, request.TimeZone, request.DefaultLanguage, out var localeError);
        if (localeError is not null)
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = localeError });
        if (await context.Tenants.AnyAsync(t => t.Slug == slug, ct))
            return TypedResults.Conflict<ProblemDetails>(new() { Detail = $"{slug} is taken." });
        if ((request.Provision ?? true) && !(request.Force ?? false) && !capacity.HasRoom)
            return TypedResults.Conflict<ProblemDetails>(new() { Detail = NoRoom(capacity, options.Value) });

        var tenant = new Tenant
        {
            Slug = slug,
            NameEn = request.NameEn.Trim(),
            NameAr = string.IsNullOrWhiteSpace(request.NameAr) ? null : request.NameAr.Trim(),
            Kind = request.Kind,
            Seed = request.Seed ?? (request.Kind == TenantKind.Demo ? TenantSeed.Sample : TenantSeed.None),
            Country = locale.Country,
            Currency = locale.Currency,
            TimeZone = locale.TimeZone,
            DefaultLanguage = locale.Language,
            PrimaryColor = string.IsNullOrEmpty(color) ? null : color,
            CustomerDomain = string.IsNullOrWhiteSpace(request.CustomerDomain) ? null : request.CustomerDomain.Trim().ToLowerInvariant(),
            OwnerEmail = request.OwnerEmail.Trim().ToLowerInvariant(),
            ContactName = Clean(request.ContactName),
            Phone = Clean(request.Phone),
            Address = Clean(request.Address),
            Plan = request.Plan,
            Notes = Clean(request.Notes),
            IdentitySecret = TenantNaming.NewSecret(),
            ControlSecret = TenantNaming.NewSecret(),
            ImageTag = options.Value.DefaultImageTag,
            ExpiresAt = request.Kind == TenantKind.Demo ? DateTimeOffset.UtcNow.AddDays(request.DemoDays ?? options.Value.DemoDays) : null,
        };
        context.Tenants.Add(tenant);
        await context.SaveChangesAsync(ct);
        await audit.WriteAsync("tenant.created", slug, new { request.NameEn, request.Kind, tenant.Seed, tenant.Country, tenant.Currency, request.OwnerEmail, provision = request.Provision ?? true }, ct);

        if (request.Provision ?? true)
            await queue.EnqueueAsync(new ProvisioningJob(tenant.Id, "provision"), ct);

        return TypedResults.Created($"/api/control/tenants/{tenant.Slug}", TenantDetail.From(tenant, [], [], options.Value));
    }

    public static async Task<Results<Ok<TenantDetail>, NotFound>> GetTenant(ControlContext context, Provisioner provisioner, IOptions<PlatformOptions> options, string slug)
    {
        var tenant = await context.Tenants.AsNoTracking().SingleOrDefaultAsync(t => t.Slug == slug);
        if (tenant is null) return TypedResults.NotFound();
        var lastRun = await context.Steps.AsNoTracking().Where(s => s.TenantId == tenant.Id).OrderByDescending(s => s.Id).Select(s => s.RunId).FirstOrDefaultAsync();
        var steps = lastRun == Guid.Empty ? [] : await context.Steps.AsNoTracking().Where(s => s.TenantId == tenant.Id && s.RunId == lastRun).OrderBy(s => s.Id).ToListAsync();
        return TypedResults.Ok(TenantDetail.From(tenant, steps, provisioner.SeedImages(tenant).Keys.ToList(), options.Value));
    }

    public static async Task<Results<Accepted, NotFound, Conflict<ProblemDetails>>> Provision(
        ControlContext context, ProvisioningQueue queue, IAuditWriter audit, CapacityCache capacity, IOptions<PlatformOptions> options, string slug,
        [Description("Stamp even when the box reports no room for another stack")] bool force = false,
        CancellationToken ct = default)
    {
        // A stack that is already up takes no more room; a new one must fit
        var tenant = await context.Tenants.AsNoTracking().SingleOrDefaultAsync(t => t.Slug == slug, ct);
        if (tenant is null) return TypedResults.NotFound();
        if (tenant.Status is not (TenantStatus.Running or TenantStatus.Stopped) && !force && !capacity.HasRoom)
            return TypedResults.Conflict<ProblemDetails>(new() { Detail = NoRoom(capacity, options.Value) });
        // A destroyed tenant can be brought back under the same slug: the steps recreate everything
        return await Enqueue(context, queue, audit, slug, "provision", [TenantStatus.Requested, TenantStatus.Failed, TenantStatus.Stopped, TenantStatus.Running, TenantStatus.Destroyed], ct, new { force });
    }

    private static string NoRoom(CapacityCache capacity, PlatformOptions options)
        => $"No room for another stack: {capacity.Latest?.MemAvailableMb ?? 0} MB free, {options.ReserveMb} MB kept for the shared services, {options.StackFootprintMb} MB per stack. Pass force=true to stamp anyway.";

    public static Task<Results<Accepted, NotFound, Conflict<ProblemDetails>>> Stop(ControlContext context, ProvisioningQueue queue, IAuditWriter audit, string slug, CancellationToken ct)
        => Enqueue(context, queue, audit, slug, "stop", [TenantStatus.Running, TenantStatus.Failed], ct);

    public static Task<Results<Accepted, NotFound, Conflict<ProblemDetails>>> Start(ControlContext context, ProvisioningQueue queue, IAuditWriter audit, string slug, CancellationToken ct)
        => Enqueue(context, queue, audit, slug, "start", [TenantStatus.Stopped, TenantStatus.Failed], ct);

    public static async Task<Results<Accepted, NotFound, Conflict<ProblemDetails>>> Upgrade(ControlContext context, ProvisioningQueue queue, IAuditWriter audit, string slug, UpgradeRequest? request, CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(request?.ImageTag))
        {
            var tenant = await context.Tenants.SingleOrDefaultAsync(t => t.Slug == slug, ct);
            if (tenant is null) return TypedResults.NotFound();
            tenant.ImageTag = request.ImageTag.Trim();
            await context.SaveChangesAsync(ct);
        }
        return await Enqueue(context, queue, audit, slug, "upgrade", [TenantStatus.Running, TenantStatus.Stopped, TenantStatus.Failed], ct, new { imageTag = request?.ImageTag });
    }

    public static async Task<Results<Ok<TenantDetail>, NotFound, BadRequest<ProblemDetails>>> Extend(ControlContext context, IAuditWriter audit, IOptions<PlatformOptions> options, string slug, ExtendRequest request, CancellationToken ct)
    {
        var tenant = await context.Tenants.SingleOrDefaultAsync(t => t.Slug == slug, ct);
        if (tenant is null) return TypedResults.NotFound();
        if (tenant.Kind != TenantKind.Demo)
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "Only demos expire." });
        var from = tenant.ExpiresAt is { } e && e > DateTimeOffset.UtcNow ? e : DateTimeOffset.UtcNow;
        tenant.ExpiresAt = from.AddDays(Math.Clamp(request.Days, 1, 365));
        await context.SaveChangesAsync(ct);
        await audit.WriteAsync("demo.extended", slug, new { request.Days, tenant.ExpiresAt }, ct);
        return TypedResults.Ok(TenantDetail.From(tenant, [], [], options.Value));
    }

    public static Task<Results<Accepted, NotFound, Conflict<ProblemDetails>>> Destroy(ControlContext context, ProvisioningQueue queue, IAuditWriter audit, string slug, CancellationToken ct)
        => Enqueue(context, queue, audit, slug, "destroy", [TenantStatus.Running, TenantStatus.Stopped, TenantStatus.Failed, TenantStatus.Requested], ct);

    private static async Task<Results<Accepted, NotFound, Conflict<ProblemDetails>>> Enqueue(
        ControlContext context, ProvisioningQueue queue, IAuditWriter audit, string slug, string action, TenantStatus[] allowedFrom, CancellationToken ct, object? details = null)
    {
        var tenant = await context.Tenants.AsNoTracking().SingleOrDefaultAsync(t => t.Slug == slug, ct);
        if (tenant is null) return TypedResults.NotFound();
        if (!allowedFrom.Contains(tenant.Status))
            return TypedResults.Conflict<ProblemDetails>(new() { Detail = $"Cannot {action} a tenant that is {tenant.Status}." });
        await audit.WriteAsync($"tenant.{action}", slug, details, ct);
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

/// <param name="RoomFor">How many more stacks the box takes before the guard refuses a stamp.</param>
public record PlatformResponse(string Domain, string DefaultImageTag, int DemoDays, bool DryRun, int Running, int Total, int RoomFor);

/// <param name="Slug">The tenant a compose project belongs to; null for the platform's own project.</param>
public record TenantUsage(string Project, string? Slug, int Containers, int Running, long MemoryMb, double CpuPercent);

public record CapacityResponse(
    DateTimeOffset At,
    long MemTotalMb,
    long MemAvailableMb,
    double[] Load,
    int Cpus,
    long TenantsDiskFreeMb,
    long TenantsDiskTotalMb,
    long DockerUsedMb,
    long DockerReclaimableMb,
    int StackFootprintMb,
    int ReserveMb,
    int RoomFor,
    IReadOnlyList<TenantUsage> Tenants);

public record CreateTenantRequest(
    string NameEn,
    string? NameAr,
    string OwnerEmail,
    TenantKind Kind = TenantKind.Demo,
    TenantSeed? Seed = null,
    string? Country = null,
    string? Currency = null,
    string? TimeZone = null,
    string? DefaultLanguage = null,
    string? Slug = null,
    string? PrimaryColor = null,
    string? CustomerDomain = null,
    int? DemoDays = null,
    string? ContactName = null,
    string? Phone = null,
    string? Address = null,
    TenantPlan Plan = TenantPlan.Free,
    string? Notes = null,
    bool? Provision = true,
    bool? Force = null);

public record UpgradeRequest(string? ImageTag);

public record ExtendRequest(int Days);

public record TenantHostsDto(string Customer, string Admin, string Pos, string Kds, string Api)
{
    public static TenantHostsDto From(TenantHosts h) => new(h.CustomerUrl, h.AdminUrl, h.PosUrl, h.KdsUrl, h.ApiUrl);
}

public record TenantSummary(string Slug, string NameEn, string? NameAr, TenantKind Kind, TenantStatus Status, TenantSeed Seed, TenantPlan Plan, string Country, string Currency, string CustomerUrl, DateTimeOffset CreatedAt, DateTimeOffset? ExpiresAt, string ImageTag, string? LastError)
{
    public static TenantSummary From(Tenant t, PlatformOptions p)
        => new(t.Slug, t.NameEn, t.NameAr, t.Kind, t.Status, t.Seed, t.Plan, t.Country, t.Currency, TenantHosts.For(t, p).CustomerUrl, t.CreatedAt, t.ExpiresAt, t.ImageTag, t.LastError);
}

/// <summary>Country (ISO 3166-1), currency (ISO 4217), IANA time zone and the customer app's language.</summary>
public record TenantLocaleDto(string Country, string Currency, string TimeZone, string Language)
{
    public static TenantLocaleDto From(Tenant t) => new(t.Country, t.Currency, t.TimeZone, t.DefaultLanguage);
}

public record StepDto(string Name, StepStatus Status, DateTimeOffset StartedAt, DateTimeOffset? FinishedAt, string? Output);

/// <summary>The café's record on the platform: who to call, where it is, what it pays, what was agreed.</summary>
public record TenantRecordDto(string? ContactName, string? Phone, string? Address, TenantPlan Plan, string? Notes);

public record TenantDetail(
    string Slug,
    string NameEn,
    string? NameAr,
    TenantKind Kind,
    TenantStatus Status,
    TenantSeed Seed,
    TenantLocaleDto Locale,
    string? PrimaryColor,
    string? CustomerDomain,
    TenantHostsDto Hosts,
    string OwnerEmail,
    string? OwnerInitialPassword,
    TenantRecordDto Record,
    string ImageTag,
    DateTimeOffset CreatedAt,
    DateTimeOffset? ExpiresAt,
    DateTimeOffset? ProvisionedAt,
    string? LastError,
    IReadOnlyList<StepDto> Steps,
    IReadOnlyList<string> SeedImages)
{
    public static TenantDetail From(Tenant t, IReadOnlyList<ProvisioningStep> steps, IReadOnlyList<string> seedImages, PlatformOptions p)
        => new(t.Slug, t.NameEn, t.NameAr, t.Kind, t.Status, t.Seed, TenantLocaleDto.From(t), t.PrimaryColor, t.CustomerDomain, TenantHostsDto.From(TenantHosts.For(t, p)), t.OwnerEmail, t.OwnerInitialPassword,
            new(t.ContactName, t.Phone, t.Address, t.Plan, t.Notes),
            t.ImageTag, t.CreatedAt, t.ExpiresAt, t.ProvisionedAt, t.LastError,
            steps.Select(s => new StepDto(s.Name, s.Status, s.StartedAt, s.FinishedAt, s.Output)).ToList(),
            seedImages);
}

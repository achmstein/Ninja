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
        api.MapPost("/tenants/{slug}/upgrade", Upgrade).WithName("UpgradeTenant").WithSummary("Back up, re-stamp on a tag and pull; rolls back to the previous tag if the stack is not healthy within five minutes").RequireAuthorization("Platform");
        api.MapDelete("/tenants/{slug}/error", DismissError).WithName("DismissTenantError").WithSummary("Take the last error off a running tenant once it has been read; the audit keeps it").RequireAuthorization("Platform");
        api.MapPost("/tenants/{slug}/rollback", Rollback).WithName("RollbackTenant").WithSummary("Back to the previous tag. Migrations are forward-only: to go back past one, restore the pre-upgrade backup into a new tenant instead").RequireAuthorization("Platform");
        api.MapPost("/platform/upgrade", FleetUpgrade).WithName("FleetUpgrade").WithSummary("Running tenants (all, or the slugs given) onto a tag, one at a time; with a canary, the rest follow only while it stays running on it").RequireAuthorization("Platform");
        api.MapGet("/platform/updates", GetUpdates).WithName("GetPlatformUpdates").WithSummary("The releases the registry holds, the tags in use, and which tenants run something older than their tag points to; refresh=true checks now").RequireAuthorization("Platform");
        api.MapPost("/tenants/{slug}/secure", Secure).WithName("SecureTenant").WithSummary("Give the stack its own database role and broker user (or, with rotate, new passwords) and restart it").RequireAuthorization("Platform");
        api.MapPost("/tenants/{slug}/extend", Extend).WithName("ExtendDemo").WithSummary("Push a demo's expiry out").RequireAuthorization("Platform");
        api.MapDelete("/tenants/{slug}", Destroy).WithName("DestroyTenant").WithSummary("Take the stack, realm, vhost and databases down").RequireAuthorization("Platform");
        api.MapDelete("/tenants/{slug}/record", Forget).WithName("ForgetTenant").WithSummary("Drop a destroyed tenant's record, steps and payments from the control plane; the slug is free again. The audit keeps its history; the archived backup stays").RequireAuthorization("Platform");

        MapBrandApi(api);
        MapRecordApi(api);
        MapOpsApi(api);
        MapImpersonationApi(api);
        MapBackupsApi(api);
        MapMailApi(api);
        MapSubscriptionApi(api);
        MapJobsApi(api);
        MapOperatorsApi(api);

        // Caddy asks before issuing a certificate on demand: only hosts we know
        api.MapGet("/tls/ask", TlsAsk).WithName("TlsAsk").WithSummary("200 when the host belongs to a tenant, 404 otherwise").AllowAnonymous().RequireRateLimiting(Extensions.Extensions.AnonymousRateLimit);

        return app;
    }

    public static async Task<Ok<PlatformResponse>> GetPlatform(ControlContext context, CapacityCache capacity, PlatformWarnings warnings, IOptions<PlatformOptions> options, CancellationToken ct)
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
            capacity.RoomFor(snapshot),
            warnings.All));
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
        var o = options.Value;
        return TypedResults.Ok(new CapacityResponse(
            snapshot.At, snapshot.MemTotalMb, snapshot.MemAvailableMb, snapshot.Load, snapshot.Cpus,
            snapshot.TenantsDiskFreeMb, snapshot.TenantsDiskTotalMb, snapshot.DockerUsedMb, snapshot.DockerReclaimableMb,
            o.StackFootprintMb, o.StackLimitMb, o.ReserveMb, capacity.RoomFor(snapshot), tenants,
            o.MinFreeDiskMb, CapacityMath.ConnectionsEstimate(CapacityMath.RunningStacks(snapshot.Projects, snapshot.PlatformProject), o.ServiceConnectionsEstimate), o.PostgresMaxConnections));
    }

    public static async Task<Ok<List<TenantSummary>>> ListTenants(ControlContext context, UpdateCache updates, IOptions<PlatformOptions> options)
    {
        var tenants = await context.Tenants.AsNoTracking().OrderByDescending(t => t.CreatedAt).ToListAsync();
        return TypedResults.Ok(tenants.Select(t => TenantSummary.From(t, options.Value, updates.For(t.Slug))).ToList());
    }

    public static async Task<Ok<UpdatesResponse>> GetUpdates(
        ControlContext context, UpdateCache updates, IOptions<PlatformOptions> options,
        [Description("Check the stacks and the registry now instead of answering from the last check")] bool refresh = false,
        CancellationToken ct = default)
    {
        var snapshot = await updates.GetAsync(refresh, ct);
        // Every tag a tenant stands on or stood on, and the default: what the upgrade dialog offers besides the releases
        var tenants = await context.Tenants.AsNoTracking().Where(t => t.Status != TenantStatus.Destroyed).Select(t => new { t.ImageTag, t.PreviousImageTag }).ToListAsync(ct);
        var known = new List<string> { options.Value.DefaultImageTag };
        known.AddRange(snapshot.Releases);
        known.AddRange(tenants.SelectMany(t => new[] { t.ImageTag, t.PreviousImageTag }).OfType<string>().Order(StringComparer.Ordinal));
        return TypedResults.Ok(new UpdatesResponse(
            snapshot.At,
            snapshot.Releases,
            snapshot.NewestRelease,
            known.Distinct(StringComparer.Ordinal).ToList(),
            snapshot.Tenants.Where(t => t.Value.Behind).Select(t => t.Key).Order(StringComparer.Ordinal).ToList()));
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
        var arabicStyle = string.IsNullOrWhiteSpace(request.ArabicStyle)
            // An Egyptian café speaks Egyptian unless told otherwise; everyone else, Standard
            ? (locale.Country == "EG" ? "egyptian" : "standard")
            : request.ArabicStyle.Trim().ToLowerInvariant();
        if (arabicStyle is not ("standard" or "egyptian"))
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "The Arabic style must be standard or egyptian." });
        var defaultTheme = string.IsNullOrWhiteSpace(request.DefaultTheme) ? null : request.DefaultTheme.Trim().ToLowerInvariant();
        if (defaultTheme is not (null or "light" or "dark"))
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "The default theme must be light, dark, or none to follow the device." });
        var domain = TenantHosts.NormalizeCustomerDomain(request.CustomerDomain, options.Value, out var domainError);
        if (domainError is not null)
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = domainError });
        if (await context.Tenants.AnyAsync(t => t.Slug == slug, ct))
            return TypedResults.Conflict<ProblemDetails>(new() { Detail = $"{slug} is taken." });
        if (domain is not null && await context.Tenants.AnyAsync(t => t.CustomerDomain == domain && t.Status != TenantStatus.Destroyed, ct))
            return TypedResults.Conflict<ProblemDetails>(new() { Detail = $"{domain} already belongs to another tenant." });
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
            BusinessType = request.BusinessType,
            ArabicStyle = arabicStyle,
            DefaultTheme = defaultTheme,
            GuestOrdersAnywhere = request.GuestOrdersAnywhere,
            CustomerDomain = domain,
            OwnerEmail = request.OwnerEmail.Trim().ToLowerInvariant(),
            ContactName = Clean(request.ContactName),
            Phone = Clean(request.Phone),
            Address = Clean(request.Address),
            Plan = request.Plan,
            Addons = PlanCatalog.NormalizeAddons(request.Plan, request.Addons ?? []),
            Subscription = request.Kind == TenantKind.Demo ? SubscriptionStatus.Trialing : SubscriptionStatus.Active,
            Notes = Clean(request.Notes),
            IdentitySecret = TenantNaming.NewSecret(),
            ControlSecret = TenantNaming.NewSecret(),
            AssistantSecret = TenantNaming.NewSecret(),
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

    public static async Task<Results<Ok<TenantDetail>, NotFound>> GetTenant(ControlContext context, Provisioner provisioner, UpdateCache updates, IOptions<PlatformOptions> options, string slug, CancellationToken ct)
    {
        var tenant = await context.Tenants.AsNoTracking().SingleOrDefaultAsync(t => t.Slug == slug, ct);
        if (tenant is null) return TypedResults.NotFound();
        var lastRun = await context.Steps.AsNoTracking().Where(s => s.TenantId == tenant.Id).OrderByDescending(s => s.Id).Select(s => s.RunId).FirstOrDefaultAsync(ct);
        var steps = lastRun == Guid.Empty ? [] : await context.Steps.AsNoTracking().Where(s => s.TenantId == tenant.Id && s.RunId == lastRun).OrderBy(s => s.Id).ToListAsync(ct);
        return TypedResults.Ok(TenantDetail.From(tenant, steps, provisioner.SeedImages(tenant).Keys.ToList(), options.Value, updates.For(slug), await OpenJobsAsync(context, tenant, ct)));
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
        => $"No room for another stack: {(capacity.Latest is { } s ? capacity.WhyNoRoom(s) : "the box has not been read yet.")} Pass force=true to stamp anyway.";

    public static Task<Results<Accepted, NotFound, Conflict<ProblemDetails>>> Stop(ControlContext context, ProvisioningQueue queue, IAuditWriter audit, string slug, CancellationToken ct)
        => Enqueue(context, queue, audit, slug, "stop", [TenantStatus.Running, TenantStatus.Failed], ct);

    public static async Task<Results<Accepted, NotFound, Conflict<ProblemDetails>>> Start(ControlContext context, ProvisioningQueue queue, IAuditWriter audit, string slug, CancellationToken ct)
    {
        // A suspended stack is unpaid: it comes back with a payment or a resume, never a plain start
        if (await context.Tenants.AsNoTracking().AnyAsync(t => t.Slug == slug && t.Status == TenantStatus.Suspended, ct))
            return TypedResults.Conflict<ProblemDetails>(new() { Detail = $"{slug} is suspended for non-payment; record a payment or resume it." });
        return await Enqueue(context, queue, audit, slug, "start", [TenantStatus.Stopped, TenantStatus.Failed], ct);
    }

    public static async Task<Results<Accepted, NotFound, Conflict<ProblemDetails>, BadRequest<ProblemDetails>>> Upgrade(ControlContext context, ProvisioningQueue queue, IAuditWriter audit, string slug, UpgradeRequest? request, CancellationToken ct)
    {
        // The tag travels on the job: the record changes only once the upgrade runs
        var tag = request?.ImageTag?.Trim();
        if (!string.IsNullOrEmpty(tag) && !ImageTag().IsMatch(tag))
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "An image tag is letters, digits, dots, dashes and underscores, up to 64." });
        var result = await Enqueue(context, queue, audit, slug, "upgrade", [TenantStatus.Running, TenantStatus.Stopped, TenantStatus.Failed], ct, new { imageTag = tag }, job => job with { ImageTag = tag });
        return result.Result switch
        {
            Accepted a => a,
            NotFound n => n,
            Conflict<ProblemDetails> c => c,
            _ => throw new InvalidOperationException(),
        };
    }

    /// <summary>A rolled-back upgrade leaves its reason on a running tenant until someone has read it. A failed tenant keeps its reason: the action that gets it going again clears it.</summary>
    /// <summary>
    /// A destroyed tenant is a row nobody needs on the list any more. Only
    /// from Destroyed: destroy first is what takes the stack down, and the
    /// one step keeps a mis-click from wiping a café. The audit rows are
    /// keyed by slug, not by id, so the history reads on after the record.
    /// </summary>
    public static async Task<Results<NoContent, NotFound, Conflict<ProblemDetails>>> Forget(ControlContext context, IAuditWriter audit, string slug, CancellationToken ct)
    {
        var tenant = await context.Tenants.Include(t => t.Steps).Include(t => t.Payments).SingleOrDefaultAsync(t => t.Slug == slug, ct);
        if (tenant is null) return TypedResults.NotFound();
        if (tenant.Status != TenantStatus.Destroyed)
            return TypedResults.Conflict<ProblemDetails>(new() { Detail = $"Only a destroyed tenant can be forgotten; {slug} is {tenant.Status}. Destroy it first." });
        await audit.WriteAsync("tenant.forgotten", slug, new { tenant.NameEn, tenant.Kind, tenant.Plan, steps = tenant.Steps.Count, payments = tenant.Payments.Count }, ct);
        context.Tenants.Remove(tenant);
        await context.SaveChangesAsync(ct);
        return TypedResults.NoContent();
    }

    public static async Task<Results<NoContent, NotFound, Conflict<ProblemDetails>>> DismissError(ControlContext context, IAuditWriter audit, string slug, CancellationToken ct)
    {
        var tenant = await context.Tenants.SingleOrDefaultAsync(t => t.Slug == slug, ct);
        if (tenant is null) return TypedResults.NotFound();
        if (tenant.Status == TenantStatus.Failed)
            return TypedResults.Conflict<ProblemDetails>(new() { Detail = $"{slug} is Failed; retry, start or destroy it instead." });
        if (tenant.LastError is not { } error) return TypedResults.NoContent();
        tenant.LastError = null;
        await context.SaveChangesAsync(ct);
        await audit.WriteAsync("tenant.error.dismissed", slug, new { error }, ct);
        return TypedResults.NoContent();
    }

    public static async Task<Results<Accepted, NotFound, Conflict<ProblemDetails>>> Rollback(ControlContext context, ProvisioningQueue queue, IAuditWriter audit, string slug, CancellationToken ct)
    {
        var tenant = await context.Tenants.AsNoTracking().SingleOrDefaultAsync(t => t.Slug == slug, ct);
        if (tenant is null) return TypedResults.NotFound();
        if (tenant.PreviousImageTag is null)
            return TypedResults.Conflict<ProblemDetails>(new() { Detail = $"{slug} has no previous tag to go back to." });
        return await Enqueue(context, queue, audit, slug, "rollback", [TenantStatus.Running, TenantStatus.Failed], ct, new { to = tenant.PreviousImageTag });
    }

    public static async Task<Results<Accepted<FleetUpgradeResponse>, BadRequest<ProblemDetails>>> FleetUpgrade(ControlContext context, ProvisioningQueue queue, IAuditWriter audit, FleetUpgradeRequest request, CancellationToken ct)
    {
        var tag = request.ImageTag?.Trim() ?? "";
        if (!ImageTag().IsMatch(tag))
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "An image tag is letters, digits, dots, dashes and underscores, up to 64." });
        var running = await context.Tenants.AsNoTracking().Where(t => t.Status == TenantStatus.Running).OrderBy(t => t.Slug).ToListAsync(ct);
        if (request.Slugs is { Length: > 0 } slugs)
        {
            var chosen = slugs.Select(s => s.Trim()).ToHashSet(StringComparer.Ordinal);
            var unknown = chosen.Except(running.Select(t => t.Slug), StringComparer.Ordinal).ToList();
            if (unknown.Count > 0)
                return TypedResults.BadRequest<ProblemDetails>(new() { Detail = $"Not running: {string.Join(", ", unknown)}." });
            running = running.Where(t => chosen.Contains(t.Slug)).ToList();
        }
        Tenant? canary = null;
        if (!string.IsNullOrWhiteSpace(request.Canary))
        {
            canary = running.FirstOrDefault(t => t.Slug == request.Canary.Trim());
            if (canary is null)
                return TypedResults.BadRequest<ProblemDetails>(new() { Detail = $"{request.Canary} is not a running tenant in the selection." });
        }
        await audit.WriteAsync("platform.upgrade", null, new { imageTag = tag, canary = canary?.Slug, count = running.Count }, ct);
        // The canary first; the rest carry its id and step aside if it did not make it
        if (canary is not null) await queue.EnqueueAsync(new ProvisioningJob(canary.Id, "upgrade", tag), ct);
        foreach (var tenant in running.Where(t => t.Id != canary?.Id))
            await queue.EnqueueAsync(new ProvisioningJob(tenant.Id, "upgrade", tag, canary?.Id), ct);
        return TypedResults.Accepted("/api/control/tenants", new FleetUpgradeResponse(running.Count, canary?.Slug));
    }

    public static Task<Results<Accepted, NotFound, Conflict<ProblemDetails>>> Secure(
        ControlContext context, ProvisioningQueue queue, IAuditWriter audit, string slug,
        [Description("New passwords for a stack that already has its own")] bool rotate,
        CancellationToken ct)
        => Enqueue(context, queue, audit, slug, rotate ? "rotate" : "secure", [TenantStatus.Running, TenantStatus.Stopped, TenantStatus.Failed], ct);

    public static async Task<Results<Ok<TenantDetail>, NotFound, BadRequest<ProblemDetails>>> Extend(ControlContext context, IAuditWriter audit, IOptions<PlatformOptions> options, string slug, ExtendRequest request, CancellationToken ct)
    {
        var tenant = await context.Tenants.SingleOrDefaultAsync(t => t.Slug == slug, ct);
        if (tenant is null) return TypedResults.NotFound();
        if (tenant.Kind != TenantKind.Demo)
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "Only demos expire." });
        var from = tenant.ExpiresAt is { } e && e > DateTimeOffset.UtcNow ? e : DateTimeOffset.UtcNow;
        tenant.ExpiresAt = from.AddDays(Math.Clamp(request.Days, 1, 365));
        // The owner is warned afresh as the new date comes near
        tenant.ExpiryWarnedAt = null;
        tenant.DestroyWarnedAt = null;
        await context.SaveChangesAsync(ct);
        await audit.WriteAsync("demo.extended", slug, new { request.Days, tenant.ExpiresAt }, ct);
        return TypedResults.Ok(TenantDetail.From(tenant, [], [], options.Value));
    }

    public static Task<Results<Accepted, NotFound, Conflict<ProblemDetails>>> Destroy(ControlContext context, ProvisioningQueue queue, IAuditWriter audit, string slug, CancellationToken ct)
        => Enqueue(context, queue, audit, slug, "destroy", [TenantStatus.Running, TenantStatus.Stopped, TenantStatus.Failed, TenantStatus.Requested, TenantStatus.Suspended], ct);

    private static async Task<Results<Accepted, NotFound, Conflict<ProblemDetails>>> Enqueue(
        ControlContext context, ProvisioningQueue queue, IAuditWriter audit, string slug, string action, TenantStatus[] allowedFrom, CancellationToken ct, object? details = null, Func<ProvisioningJob, ProvisioningJob>? shape = null)
    {
        var tenant = await context.Tenants.AsNoTracking().SingleOrDefaultAsync(t => t.Slug == slug, ct);
        if (tenant is null) return TypedResults.NotFound();
        if (!allowedFrom.Contains(tenant.Status))
            return TypedResults.Conflict<ProblemDetails>(new() { Detail = $"Cannot {action} a tenant that is {tenant.Status}." });
        await audit.WriteAsync($"tenant.{action}", slug, details, ct);
        var job = new ProvisioningJob(tenant.Id, action);
        await queue.EnqueueAsync(shape?.Invoke(job) ?? job, ct);
        return TypedResults.Accepted($"/api/control/tenants/{slug}");
    }

    public static async Task<Results<Ok, NotFound>> TlsAsk(ControlContext context, IOptions<PlatformOptions> options, [Description("The host Caddy is about to issue a certificate for")] string domain, CancellationToken ct)
    {
        var host = domain.Trim().ToLowerInvariant();
        var platform = options.Value;
        if (host == $"auth.{platform.Domain}" || host == $"control.{platform.Domain}" || host == platform.Domain)
            return TypedResults.Ok();

        // One row, by the slug the host names or the café's own domain; never the whole table per certificate
        var slug = TenantHosts.SlugFromHost(host, platform);
        var known = await context.Tenants.AsNoTracking()
            .Where(t => t.Status != TenantStatus.Destroyed)
            .Where(t => (slug != null && t.Slug == slug) || t.CustomerDomain == host)
            .Select(t => new { t.Slug, t.CustomerDomain })
            .ToListAsync(ct);
        // The platform host of a tenant with its own domain is still its admin/pos/kds/api host; only the bare customer host moves
        return known.Any(t => t.CustomerDomain == host || (t.Slug == slug && (t.CustomerDomain is null || host != $"{slug}.{platform.Domain}")))
            ? TypedResults.Ok()
            : TypedResults.NotFound();
    }

    [GeneratedRegex("^#[0-9a-f]{6}$")]
    private static partial Regex HexColor();

    [GeneratedRegex("^[A-Za-z0-9._-]{1,64}$")]
    private static partial Regex ImageTag();
}

/// <param name="RoomFor">How many more stacks the box takes before the guard refuses a stamp.</param>
/// <param name="Warnings">What the watchdog found and has not seen clear: a dead lane, a full drive, a stack down, a job past its time, a stack nobody's record explains.</param>
public record PlatformResponse(string Domain, string DefaultImageTag, int DemoDays, bool DryRun, int Running, int Total, int RoomFor, IReadOnlyList<string> Warnings);

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
    int StackLimitMb,
    int ReserveMb,
    int RoomFor,
    IReadOnlyList<TenantUsage> Tenants,
    int DiskFloorMb,
    int ConnectionsEstimate,
    int ConnectionsMax);

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
    bool? Force = null,
    Module[]? Addons = null,
    BusinessType BusinessType = BusinessType.Other,
    string? ArabicStyle = null,
    string? DefaultTheme = null,
    bool GuestOrdersAnywhere = false);

public record UpgradeRequest(string? ImageTag);

/// <param name="Canary">A running tenant's slug to upgrade first; the rest follow only while it stays running on the tag.</param>
/// <param name="Slugs">Only these running tenants; empty or null means every running tenant.</param>
public record FleetUpgradeRequest(string ImageTag, string? Canary = null, string[]? Slugs = null);

/// <param name="CheckedAt">When the stacks and the registry were last read.</param>
/// <param name="Releases">Release tags (v…) every one of the twelve service images carries, newest first; empty when the platform builds its own images.</param>
/// <param name="KnownTags">What the upgrade dialog offers: the default tag, the releases, then every tag a tenant stands or stood on.</param>
/// <param name="Behind">The tenants running something older than their tag points to now, or on a release older than the newest.</param>
public record UpdatesResponse(DateTimeOffset CheckedAt, IReadOnlyList<string> Releases, string? NewestRelease, IReadOnlyList<string> KnownTags, IReadOnlyList<string> Behind);

public record FleetUpgradeResponse(int Queued, string? Canary);

public record ExtendRequest(int Days);

public record TenantHostsDto(string Customer, string Admin, string Pos, string Kds, string Api)
{
    public static TenantHostsDto From(TenantHosts h) => new(h.CustomerUrl, h.AdminUrl, h.PosUrl, h.KdsUrl, h.ApiUrl);
}

/// <param name="LogoUrl">The café's mark as its running stack serves it, or null while there is no stack to serve one.</param>
/// <param name="HasOwnCredentials">False for a stack stamped before tenants had a database role and broker user of their own; secure gives it them.</param>
/// <param name="Update">Where the stack stands against what its tag points to now; null until the first check.</param>
/// <param name="IsDrill">A scratch tenant the restore drill stamped; destroyed by the drill, never mailed about.</param>
public record TenantSummary(string Slug, string NameEn, string? NameAr, TenantKind Kind, TenantStatus Status, TenantSeed Seed, TenantPlan Plan, string Country, string Currency, string CustomerUrl, string? LogoUrl, DateTimeOffset CreatedAt, DateTimeOffset? ExpiresAt, string ImageTag, string? LastError, bool HasOwnCredentials, SubscriptionStatus Subscription, DateTimeOffset? PaidThrough, TenantUpdate? Update, bool IsDrill)
{
    public static TenantSummary From(Tenant t, PlatformOptions p, TenantUpdate? update = null)
    {
        var hosts = TenantHosts.For(t, p);
        return new(t.Slug, t.NameEn, t.NameAr, t.Kind, t.Status, t.Seed, t.Plan, t.Country, t.Currency, hosts.CustomerUrl, LogoUrlOf(t, hosts), t.CreatedAt, t.ExpiresAt, t.ImageTag, t.LastError, t.HasOwnCredentials, t.Subscription, t.PaidThrough, update, t.IsDrill);
    }

    /// <summary>The stack's public mark; the light one, which the customer app's icons are cut from.</summary>
    public static string? LogoUrlOf(Tenant t, TenantHosts hosts) => t.Status == TenantStatus.Running ? $"{hosts.CustomerUrl}/api/tenant/images/logo" : null;
}

/// <summary>Country (ISO 3166-1), currency (ISO 4217), IANA time zone and the customer app's language.</summary>
/// <param name="ArabicStyle">"standard" or "egyptian": which Arabic the café's apps speak.</param>
public record TenantLocaleDto(string Country, string Currency, string TimeZone, string Language, string ArabicStyle = "standard")
{
    public static TenantLocaleDto From(Tenant t) => new(t.Country, t.Currency, t.TimeZone, t.DefaultLanguage, t.ArabicStyle);
}

public record StepDto(string Name, StepStatus Status, DateTimeOffset StartedAt, DateTimeOffset? FinishedAt, string? Output);

/// <summary>The café's record on the platform: who to call, where it is, what it pays, what was agreed.</summary>
public record TenantRecordDto(string? ContactName, string? Phone, string? Address, TenantPlan Plan, string? Notes);

/// <param name="Jobs">What is running or waiting for this tenant, with each queued job's place in line.</param>
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
    string? LogoUrl,
    string OwnerEmail,
    string? OwnerInitialPassword,
    TenantRecordDto Record,
    string ImageTag,
    DateTimeOffset CreatedAt,
    DateTimeOffset? ExpiresAt,
    DateTimeOffset? ProvisionedAt,
    string? LastError,
    IReadOnlyList<StepDto> Steps,
    IReadOnlyList<string> SeedImages,
    bool HasOwnCredentials,
    DateTimeOffset? WelcomeSentAt,
    TenantSubscriptionDto Subscription,
    string? PreviousImageTag,
    string? UpgradeBackupId,
    TenantUpdate? Update,
    bool IsDrill,
    IReadOnlyList<JobDto> Jobs,
    [property: Description("The services the plan stamps (catalog, ordering, …): a module's own service only with its module")] IReadOnlyList<string> Services)
{
    public static TenantDetail From(Tenant t, IReadOnlyList<ProvisioningStep> steps, IReadOnlyList<string> seedImages, PlatformOptions p, TenantUpdate? update = null, IReadOnlyList<JobDto>? jobs = null)
        => new(t.Slug, t.NameEn, t.NameAr, t.Kind, t.Status, t.Seed, TenantLocaleDto.From(t), t.PrimaryColor, t.CustomerDomain, TenantHostsDto.From(TenantHosts.For(t, p)), TenantSummary.LogoUrlOf(t, TenantHosts.For(t, p)), t.OwnerEmail, t.OwnerInitialPassword,
            new(t.ContactName, t.Phone, t.Address, t.Plan, t.Notes),
            t.ImageTag, t.CreatedAt, t.ExpiresAt, t.ProvisionedAt, t.LastError,
            steps.Select(s => new StepDto(s.Name, s.Status, s.StartedAt, s.FinishedAt, s.Output)).ToList(),
            seedImages,
            t.HasOwnCredentials,
            t.WelcomeSentAt,
            new(t.Subscription, t.PaidThrough, t.GraceDays ?? p.SubscriptionGraceDays, t.SuspendedAt, t.Addons, PlanCatalog.Entitlements(t).OrderBy(m => m).ToArray()),
            t.PreviousImageTag,
            t.UpgradeBackupId,
            update,
            t.IsDrill,
            jobs ?? [],
            PlanCatalog.Services(t));
}

/// <summary>Where the café stands with its subscription, on the tenant itself; the Subscription tab has the rest.</summary>
public record TenantSubscriptionDto(SubscriptionStatus Status, DateTimeOffset? PaidThrough, int GraceDays, DateTimeOffset? SuspendedAt, Module[] Addons, Module[] Entitlements);

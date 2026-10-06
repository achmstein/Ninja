using System.ComponentModel;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Ninja.Control.API.Infrastructure;
using Ninja.Control.API.Model;
using Ninja.Control.API.Platform;

namespace Ninja.Control.API.Apis;

/// <summary>The business's record on the platform (contact, plan, notes, what it is stamped with), a demo's conversion, and the audit trail.</summary>
public static partial class ControlApi
{
    private static void MapRecordApi(RouteGroupBuilder api)
    {
        api.MapPut("/tenants/{slug}", UpdateTenant).WithName("UpdateTenant").WithSummary("The record: contact, plan, notes, own domain, and what the business was created with; a running stack takes its name, locale, Arabic, starting theme and kind of place at once").RequireAuthorization("Platform");
        api.MapPost("/tenants/{slug}/convert", Convert).WithName("ConvertTenant").WithSummary("A demo becomes a customer: no expiry, on a plan").RequireAuthorization("Platform");
        api.MapGet("/audit", ListAudit).WithName("ListAudit").WithSummary("Every platform action, newest first, for one tenant or all").RequireAuthorization("Platform");
    }

    public static async Task<Results<Ok<TenantDetail>, NotFound, BadRequest<ProblemDetails>, ProblemHttpResult>> UpdateTenant(
        ControlContext context, ProvisioningQueue queue, IAuditWriter audit, Provisioner provisioner, SubscriptionService subscriptions, IStackProxy stack, IOptions<PlatformOptions> options,
        string slug, UpdateTenantRequest request, CancellationToken ct)
    {
        var tenant = await context.Tenants.SingleOrDefaultAsync(t => t.Slug == slug, ct);
        if (tenant is null) return TypedResults.NotFound();

        if (string.IsNullOrWhiteSpace(request.NameEn) && string.IsNullOrWhiteSpace(request.NameAr))
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "The business's name is required, in English or Arabic." });
        var color = request.PrimaryColor?.Trim().ToLowerInvariant();
        if (!string.IsNullOrEmpty(color) && !HexColor().IsMatch(color))
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "The color must be #rrggbb." });
        var locale = LocaleFields.Normalize(request.Country, request.Currency, request.TimeZone, request.DefaultLanguage, out var localeError);
        if (localeError is not null)
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = localeError });

        var arabicStyle = string.IsNullOrWhiteSpace(request.ArabicStyle) ? tenant.ArabicStyle : request.ArabicStyle.Trim().ToLowerInvariant();
        if (arabicStyle is not ("standard" or "egyptian"))
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "The Arabic style must be standard or egyptian." });
        var contentLanguages = string.IsNullOrWhiteSpace(request.ContentLanguages) ? tenant.ContentLanguages : request.ContentLanguages.Trim().ToLowerInvariant();
        if (!ContentLanguages.IsValid(contentLanguages))
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "The business's languages must be both, ar or en." });
        // "device" follows the device, as null does on the record; null here leaves it
        var theme = request.DefaultTheme?.Trim().ToLowerInvariant();
        var defaultTheme = theme is null ? tenant.DefaultTheme : theme is "" or "device" ? null : theme;
        if (defaultTheme is not (null or "light" or "dark"))
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "The default theme must be light, dark, or device." });
        // Null leaves the dock as it is
        var slab = tenant.Slab;
        if (request.Slab is not null && !TrySlab(request.Slab, out slab))
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = SlabError });

        // Null leaves the business's own app as it is; empty clears it
        var appId = request.AppId is null ? tenant.AppId : Clean(request.AppId);
        if (appId is not null && (appId.Length > 155 || !AppIdPattern().IsMatch(appId)))
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "The app's id is its bundle ID and Android package, like net.ninjapp.lucaffe: two or more parts, each starting with a letter, of letters, digits and _." });
        var appChanged = appId != tenant.AppId;
        if (appChanged && appId is not null && await context.Tenants.AnyAsync(t => t.Id != tenant.Id && t.AppId == appId && t.Status != TenantStatus.Destroyed, ct))
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = $"{appId} is already another business's app." });

        var domain = TenantHosts.NormalizeCustomerDomain(request.CustomerDomain, options.Value, out var domainError);
        if (domainError is not null)
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = domainError });
        var domainChanged = domain != tenant.CustomerDomain;
        if (domainChanged && domain is not null && await context.Tenants.AnyAsync(t => t.Id != tenant.Id && t.CustomerDomain == domain && t.Status != TenantStatus.Destroyed, ct))
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = $"{domain} already belongs to another tenant." });

        tenant.NameEn = Clean(request.NameEn);
        tenant.NameAr = Clean(request.NameAr);
        tenant.PrimaryColor = string.IsNullOrEmpty(color) ? null : color;
        tenant.CustomerDomain = domain;
        tenant.ContactName = Clean(request.ContactName);
        tenant.Phone = Clean(request.Phone);
        tenant.Address = Clean(request.Address);
        tenant.Notes = Clean(request.Notes);
        tenant.Country = locale.Country;
        tenant.Currency = locale.Currency;
        tenant.TimeZone = locale.TimeZone;
        tenant.ContentLanguages = contentLanguages;
        tenant.DefaultLanguage = ContentLanguages.Opening(contentLanguages, locale.Language);
        tenant.ArabicStyle = arabicStyle;
        tenant.DefaultTheme = defaultTheme;
        tenant.Slab = slab;
        var socialChanged = request.SocialSignIn is { } social && social != tenant.SocialSignIn;
        if (socialChanged) tenant.SocialSignIn = request.SocialSignIn!.Value;
        tenant.AppId = appId;
        // The kind of place is a label on a running business: its menu, switches and guest ordering stay as they are
        if (request.BusinessType is { } business) tenant.BusinessType = business;
        await context.SaveChangesAsync(ct);
        await audit.WriteAsync("tenant.updated", slug, request, ct);

        // The plan lives on the subscription now; given here, it goes the same way, so the stack follows
        if (request.Plan is { } plan && plan != tenant.Plan)
            await subscriptions.ApplyAsync(tenant, plan, tenant.Addons, tenant.GraceDays, ct);

        // A business's own domain reaches the edge straight away
        if (domainChanged && tenant.Status is TenantStatus.Running or TenantStatus.Stopped)
            await queue.EnqueueAsync(new ProvisioningJob(tenant.Id, "edge"), ct);

        // Google and Apple on or off, or its own app given or changed: its realm and hub clients follow, and the apps are told
        if ((socialChanged || appChanged) && tenant.Status is TenantStatus.Running or TenantStatus.Stopped)
            await queue.EnqueueAsync(new ProvisioningJob(tenant.Id, "social"), ct);

        // A running business's apps see the rest at once; a stack that is not running keeps its own until it is provisioned again
        if (tenant.Status == TenantStatus.Running && await StackSettings.PushAsync(stack, tenant, ct) is { } refused)
            return TypedResults.Problem(detail: $"Saved on the record, but the business did not take it: {refused}", statusCode: StatusCodes.Status502BadGateway);

        return TypedResults.Ok(TenantDetail.From(tenant, [], provisioner.SeedImages(tenant).Keys.ToList(), options.Value));
    }

    public static async Task<Results<Ok<TenantDetail>, NotFound, BadRequest<ProblemDetails>>> Convert(
        ControlContext context, IAuditWriter audit, Provisioner provisioner, SubscriptionService subscriptions, IOptions<PlatformOptions> options, string slug, ConvertRequest? request, CancellationToken ct)
    {
        var tenant = await context.Tenants.SingleOrDefaultAsync(t => t.Slug == slug, ct);
        if (tenant is null) return TypedResults.NotFound();
        if (tenant.Kind != TenantKind.Demo)
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = $"{slug} is already a customer." });

        // A customer from today: the first period starts now, and the stack narrows from everything to its plan
        tenant.Kind = TenantKind.Customer;
        tenant.ExpiresAt = null;
        tenant.ExpiryWarnedAt = null;
        tenant.DestroyWarnedAt = null;
        tenant.Subscription = SubscriptionStatus.Active;
        tenant.PaidThrough = request?.PaidThrough ?? DateTimeOffset.UtcNow.AddDays(options.Value.SubscriptionPeriodDays);
        tenant.GraceDays = null;
        await context.SaveChangesAsync(ct);
        await audit.WriteAsync("tenant.converted", slug, new { plan = request?.Plan, tenant.PaidThrough }, ct);
        await subscriptions.ApplyAsync(tenant, request?.Plan ?? (tenant.Plan == TenantPlan.Free ? TenantPlan.Starter : tenant.Plan), request?.Addons ?? tenant.Addons, null, ct);

        return TypedResults.Ok(TenantDetail.From(tenant, [], provisioner.SeedImages(tenant).Keys.ToList(), options.Value));
    }

    public static async Task<Ok<List<AuditEntry>>> ListAudit(
        ControlContext context,
        [Description("Only this tenant's entries")] string? slug = null,
        [Description("How many, newest first; 500 at most")] int take = 50)
    {
        var query = context.Audits.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(slug)) query = query.Where(a => a.Slug == slug);
        var rows = await query.OrderByDescending(a => a.Id).Take(Math.Clamp(take, 1, 500)).ToListAsync();
        return TypedResults.Ok(rows.Select(a => new AuditEntry(a.Id, a.At, a.Actor, a.ActorEmail, a.Source, a.Action, a.Slug, a.Details)).ToList());
    }

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    /// <summary>An id both stores take: Android's package rule (letters, digits, _; each part starting with a letter), which iOS bundle IDs accept too</summary>
    [System.Text.RegularExpressions.GeneratedRegex("^[A-Za-z][A-Za-z0-9_]*(\\.[A-Za-z][A-Za-z0-9_]*)+$")]
    private static partial System.Text.RegularExpressions.Regex AppIdPattern();
}

public record UpdateTenantRequest(
    string? NameEn,
    string? NameAr,
    string? PrimaryColor,
    string? CustomerDomain,
    string? ContactName,
    string? Phone,
    string? Address,
    TenantPlan? Plan,
    string? Notes,
    string? Country,
    string? Currency,
    string? TimeZone,
    string? DefaultLanguage,
    [property: Description("standard or egyptian; null leaves it")] string? ArabicStyle = null,
    [property: Description("light, dark or device; null leaves it")] string? DefaultTheme = null,
    [property: Description("The kind of place; on a running business only the label changes, never its menu, switches or guest ordering. Null leaves it")] BusinessType? BusinessType = null,
    [property: Description("The dock's colour: brand (a deep shade of the brand colour) or neutral (black); null leaves it")] string? Slab = null,
    [property: Description("Whether customers may sign in with Google and Apple; null leaves it")] bool? SocialSignIn = null,
    [property: Description("both, ar or en: the languages the business writes its menu, places and stock in; null leaves it")] string? ContentLanguages = null,
    [property: Description("The business's own customer app: its iOS bundle ID and Android package (net.ninjapp.lucaffe); empty clears it, null leaves it")] string? AppId = null);

/// <param name="PaidThrough">When the first period ends; the platform's period from today when left out.</param>
public record ConvertRequest(TenantPlan? Plan, Module[]? Addons = null, DateTimeOffset? PaidThrough = null);

/// <param name="Details">JSON: the request's fields, the outcome or the error.</param>
public record AuditEntry(long Id, DateTimeOffset At, string Actor, string? ActorEmail, string Source, string Action, string? Slug, string? Details);

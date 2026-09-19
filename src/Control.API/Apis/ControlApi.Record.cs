using System.ComponentModel;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Ninja.Control.API.Infrastructure;
using Ninja.Control.API.Model;
using Ninja.Control.API.Platform;

namespace Ninja.Control.API.Apis;

/// <summary>The café's record on the platform (contact, plan, notes, what it is stamped with), a demo's conversion, and the audit trail.</summary>
public static partial class ControlApi
{
    private static void MapRecordApi(RouteGroupBuilder api)
    {
        api.MapPut("/tenants/{slug}", UpdateTenant).WithName("UpdateTenant").WithSummary("The record: contact, plan, notes, own domain, and what the next stamp uses").RequireAuthorization("Platform");
        api.MapPost("/tenants/{slug}/convert", Convert).WithName("ConvertTenant").WithSummary("A demo becomes a customer: no expiry, on a plan").RequireAuthorization("Platform");
        api.MapGet("/audit", ListAudit).WithName("ListAudit").WithSummary("Every platform action, newest first, for one tenant or all").RequireAuthorization("Platform");
    }

    public static async Task<Results<Ok<TenantDetail>, NotFound, BadRequest<ProblemDetails>>> UpdateTenant(
        ControlContext context, ProvisioningQueue queue, IAuditWriter audit, Provisioner provisioner, IOptions<PlatformOptions> options,
        string slug, UpdateTenantRequest request, CancellationToken ct)
    {
        var tenant = await context.Tenants.SingleOrDefaultAsync(t => t.Slug == slug, ct);
        if (tenant is null) return TypedResults.NotFound();

        if (string.IsNullOrWhiteSpace(request.NameEn))
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "The English name is required." });
        var color = request.PrimaryColor?.Trim().ToLowerInvariant();
        if (!string.IsNullOrEmpty(color) && !HexColor().IsMatch(color))
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "The color must be #rrggbb." });
        var locale = LocaleFields.Normalize(request.Country, request.Currency, request.TimeZone, request.DefaultLanguage, out var localeError);
        if (localeError is not null)
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = localeError });

        var domain = string.IsNullOrWhiteSpace(request.CustomerDomain) ? null : request.CustomerDomain.Trim().ToLowerInvariant();
        var domainChanged = domain != tenant.CustomerDomain;

        tenant.NameEn = request.NameEn.Trim();
        tenant.NameAr = string.IsNullOrWhiteSpace(request.NameAr) ? null : request.NameAr.Trim();
        tenant.PrimaryColor = string.IsNullOrEmpty(color) ? null : color;
        tenant.CustomerDomain = domain;
        tenant.ContactName = Clean(request.ContactName);
        tenant.Phone = Clean(request.Phone);
        tenant.Address = Clean(request.Address);
        tenant.Plan = request.Plan;
        tenant.Notes = Clean(request.Notes);
        tenant.Country = locale.Country;
        tenant.Currency = locale.Currency;
        tenant.TimeZone = locale.TimeZone;
        tenant.DefaultLanguage = locale.Language;
        await context.SaveChangesAsync(ct);
        await audit.WriteAsync("tenant.updated", slug, request, ct);

        // A café's own domain reaches the edge straight away; the rest is read by the next stamp
        if (domainChanged && tenant.Status is TenantStatus.Running or TenantStatus.Stopped)
            await queue.EnqueueAsync(new ProvisioningJob(tenant.Id, "edge"), ct);

        return TypedResults.Ok(TenantDetail.From(tenant, [], provisioner.SeedImages(tenant).Keys.ToList(), options.Value));
    }

    public static async Task<Results<Ok<TenantDetail>, NotFound, BadRequest<ProblemDetails>>> Convert(
        ControlContext context, IAuditWriter audit, Provisioner provisioner, IOptions<PlatformOptions> options, string slug, ConvertRequest? request, CancellationToken ct)
    {
        var tenant = await context.Tenants.SingleOrDefaultAsync(t => t.Slug == slug, ct);
        if (tenant is null) return TypedResults.NotFound();
        if (tenant.Kind != TenantKind.Demo)
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = $"{slug} is already a customer." });

        tenant.Kind = TenantKind.Customer;
        tenant.ExpiresAt = null;
        tenant.Plan = request?.Plan ?? (tenant.Plan == TenantPlan.Free ? TenantPlan.Starter : tenant.Plan);
        await context.SaveChangesAsync(ct);
        await audit.WriteAsync("tenant.converted", slug, new { plan = tenant.Plan }, ct);

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
}

public record UpdateTenantRequest(
    string NameEn,
    string? NameAr,
    string? PrimaryColor,
    string? CustomerDomain,
    string? ContactName,
    string? Phone,
    string? Address,
    TenantPlan Plan,
    string? Notes,
    string? Country,
    string? Currency,
    string? TimeZone,
    string? DefaultLanguage);

public record ConvertRequest(TenantPlan? Plan);

/// <param name="Details">JSON: the request's fields, the outcome or the error.</param>
public record AuditEntry(long Id, DateTimeOffset At, string Actor, string? ActorEmail, string Source, string Action, string? Slug, string? Details);

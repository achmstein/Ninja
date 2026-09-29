using System.ComponentModel;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Ninja.Control.API.Infrastructure;
using Ninja.Control.API.Model;
using Ninja.Control.API.Platform;

namespace Ninja.Control.API.Apis;

/// <param name="ChainCode">The café's chain at Talabat; null while it is not on Talabat.</param>
/// <param name="GlobalEntityId">Talabat's market for it, as the relay will use it.</param>
/// <param name="RemoteIdPattern">What each branch is registered as at Talabat: the slug, a dash and the branch number.</param>
/// <param name="PluginUrl">The one address Talabat sends every café's orders to.</param>
/// <param name="PlatformConfigured">Whether the platform has Ninja's Talabat account at all.</param>
public record TenantTalabatDto(string? ChainCode, string GlobalEntityId, string RemoteIdPattern, string PluginUrl, bool PlatformConfigured)
{
    public static TenantTalabatDto From(Tenant t, PlatformOptions p) => new(
        t.TalabatChainCode,
        t.TalabatGlobalEntityId ?? TalabatNaming.DefaultGlobalEntity(t.Country),
        $"{t.Slug}-{{branch}}",
        $"{p.ControlUrl.TrimEnd('/')}/api/talabat",
        p.Talabat.Configured);
}

/// <param name="ChainCode">Empty takes the café off Talabat.</param>
/// <param name="GlobalEntityId">Null or empty reads it from the country.</param>
public record TenantTalabatRequest(string? ChainCode, string? GlobalEntityId);

public static partial class ControlApi
{
    private static void MapTalabatSettingsApi(RouteGroupBuilder api)
    {
        api.MapPut("/tenants/{slug}/talabat", UpdateTalabat)
            .WithName("UpdateTenantTalabat")
            .WithSummary("The café's chain at Talabat, from Talabat's onboarding; the relay sends its menu and availability only there")
            .RequireAuthorization("Platform");
    }

    public static async Task<Results<Ok<TenantTalabatDto>, NotFound, BadRequest<ProblemDetails>>> UpdateTalabat(
        ControlContext context, IAuditWriter audit, IOptions<PlatformOptions> options, string slug, TenantTalabatRequest request, CancellationToken ct)
    {
        var tenant = await context.Tenants.SingleOrDefaultAsync(t => t.Slug == slug, ct);
        if (tenant is null) return TypedResults.NotFound();

        var chain = string.IsNullOrWhiteSpace(request.ChainCode) ? null : request.ChainCode.Trim();
        var entity = string.IsNullOrWhiteSpace(request.GlobalEntityId) ? null : request.GlobalEntityId.Trim().ToUpperInvariant();
        if (chain is not null && !TalabatCode().IsMatch(chain))
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "The chain code is letters, digits, dashes and underscores." });
        if (entity is not null && !TalabatCode().IsMatch(entity))
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "The global entity is letters, digits and underscores, like TB_EG." });
        if (chain is not null && await context.Tenants.AnyAsync(t => t.Id != tenant.Id && t.TalabatChainCode == chain && t.Status != TenantStatus.Destroyed, ct))
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = $"{chain} already belongs to another café." });

        tenant.TalabatChainCode = chain;
        tenant.TalabatGlobalEntityId = entity;
        await context.SaveChangesAsync(ct);
        await audit.WriteAsync("tenant.talabat", slug, new { chain, entity }, ct);
        return TypedResults.Ok(TenantTalabatDto.From(tenant, options.Value));
    }

    [GeneratedRegex("^[A-Za-z0-9_-]{1,64}$")]
    private static partial Regex TalabatCode();
}

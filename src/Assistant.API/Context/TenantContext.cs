using Microsoft.Extensions.Caching.Memory;
using Ninja.Assistant.API.Downstream;

namespace Ninja.Assistant.API.Context;

/// <summary>What every tool needs first: the branches, the locale and the zone.</summary>
public sealed record TenantSnapshot(IReadOnlyList<BranchResponse> Branches, TenantLocaleDto Locale, TimeZoneInfo Zone, DayOfWeek WeekStart)
{
    public string Currency => Locale.Currency ?? TenantLocaleDto.Default.Currency!;
}

/// <summary>
/// Loads the branch list on every call (an Owner endpoint, so it also proves
/// the token) and the tenant's locale and Ninja AI switch once a minute
/// (public, and they change only when the owner edits them). With Ninja AI
/// switched off in the back office the assistant answers nothing: every tool
/// starts here.
/// </summary>
public sealed class TenantContext(NinjaApiClient api, IMemoryCache cache)
{
    private const string LocaleKey = "tenant-locale";

    public async Task<ApiResult<TenantSnapshot>> LoadAsync(CancellationToken ct)
    {
        var branches = await api.GetAsync<List<BranchResponse>>("tenant-api", "/api/branches/all", null, ct);
        if (!branches.IsOk)
            return ApiResult<TenantSnapshot>.Fail(branches.Error!, branches.Status);

        var (locale, aiOn) = await cache.GetOrCreateAsync(LocaleKey, async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(1);
            var tenant = await api.GetAsync<TenantResponse>("tenant-api", "/api/tenant", null, ct);
            if (!tenant.IsOk || tenant.Value?.Locale is null)
            {
                entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(30);
                return (TenantLocaleDto.Default, tenant.Value?.Features?.Ai != false);
            }
            return (tenant.Value.Locale, tenant.Value.Features?.Ai != false);
        });
        if (!aiOn)
            return ApiResult<TenantSnapshot>.Fail("Ninja AI is switched off for this business. Turn it on in the back office (Settings → Features) to use the assistant.", System.Net.HttpStatusCode.Forbidden);
        locale ??= TenantLocaleDto.Default;

        return ApiResult<TenantSnapshot>.Ok(new TenantSnapshot(
            branches.Value!,
            locale,
            PeriodResolver.FindZone(locale.TimeZone),
            PeriodResolver.WeekStart(locale.Country)));
    }
}

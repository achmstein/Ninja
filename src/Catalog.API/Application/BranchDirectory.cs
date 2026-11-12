#nullable enable
using System.Net.Http.Json;

namespace Ninja.Catalog.API.Application;

/// <summary>
/// The business's branches, as far as the catalog can tell. Branches live in
/// Tenant.API, so it is asked first; when it cannot be reached, the branches
/// the catalog has seen (an override, a sold-out option, Talabat's list) stand in.
/// </summary>
public static class BranchDirectory
{
    public const string HttpClientName = "tenant-api";

    private sealed record BranchRow(int Id);

    public static async Task<HashSet<int>> KnownBranchIdsAsync(
        CatalogContext context, IHttpClientFactory httpClientFactory, ILogger logger, CancellationToken ct = default)
    {
        var ids = new HashSet<int>();
        try
        {
            var client = httpClientFactory.CreateClient(HttpClientName);
            var branches = await client.GetFromJsonAsync<List<BranchRow>>("http://tenant-api/api/branches", ct);
            foreach (var b in branches ?? []) ids.Add(b.Id);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "Could not list the branches from tenant-api; using the branches the catalog knows");
        }

        ids.UnionWith(await context.BranchItemOverrides.Select(o => o.BranchId).Distinct().ToListAsync(ct));
        ids.UnionWith(await context.BranchOptionStockOuts.Select(o => o.BranchId).Distinct().ToListAsync(ct));
        var talabat = await context.TalabatSettings.AsNoTracking().FirstOrDefaultAsync(ct);
        if (talabat is not null) ids.UnionWith(talabat.BranchIds);
        return ids;
    }
}

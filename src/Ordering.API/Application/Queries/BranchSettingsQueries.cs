#nullable enable
using Microsoft.Extensions.Caching.Memory;

namespace Ninja.Ordering.API.Application.Queries;

public class BranchSettingsQueries(OrderingContext context, IMemoryCache? cache = null) : IBranchSettingsQueries
{
    /// <summary>Where the business's delivery switch is kept between reads; the event that changes it clears it.</summary>
    public const string DeliveryOnCacheKey = "ordering:delivery-on";

    public async Task<bool> IsOrderingEnabledAsync(int branchId)
    {
        var row = await context.BranchSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(b => b.BranchId == branchId);

        return row?.IsOrderingEnabled ?? true;
    }

    public async Task<bool> RequiresSignInForTableOrdersAsync(int branchId)
    {
        var row = await context.BranchSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(b => b.BranchId == branchId);
        return row?.RequireSignInForTableOrders ?? false;
    }

    public async Task<bool> IsDeliveryOnAsync()
    {
        if (cache?.TryGetValue(DeliveryOnCacheKey, out bool on) == true)
        {
            return on;
        }

        on = await context.TenantFeatures
            .AsNoTracking()
            .Where(f => f.Id == TenantFeatures.SingletonId)
            .Select(f => (bool?)f.Delivery)
            .FirstOrDefaultAsync() ?? true;

        // A minute at most: the handler clears it on a change, this is only the backstop
        cache?.Set(DeliveryOnCacheKey, on, TimeSpan.FromMinutes(1));
        return on;
    }

    public async Task<bool> IsPayAheadOnAsync() =>
        await context.TenantFeatures
            .AsNoTracking()
            .Where(f => f.Id == TenantFeatures.SingletonId)
            .Select(f => (bool?)f.PayAhead)
            .FirstOrDefaultAsync() ?? false;

    public async Task<bool> IsCallCentreOnAsync() =>
        await context.TenantFeatures
            .AsNoTracking()
            .Where(f => f.Id == TenantFeatures.SingletonId)
            .Select(f => (bool?)f.CallCentre)
            .FirstOrDefaultAsync() ?? false;

    public async Task<DeliveryTerms?> GetDeliveryTermsAsync(int branchId, bool evenWhilePaused = false)
    {
        // Not bought, or switched off: no branch delivers, whatever it was set to
        if (!await IsDeliveryOnAsync()) return null;

        var row = await context.BranchSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(b => b.BranchId == branchId);

        // Somewhere to measure from, and somewhere to stop: a radius or a drawn area
        return row is { IsActive: true, IsDeliveryEnabled: true, Latitude: { } lat, Longitude: { } lng }
            && Reaches(row)
            && (row.IsOrderingEnabled || evenWhilePaused)
            ? Terms(row, lat, lng)
            : null;
    }

    public async Task<IReadOnlyList<BranchDeliveryTerms>> GetDeliveringBranchesAsync(bool evenWhilePaused = false)
    {
        if (!await IsDeliveryOnAsync()) return [];

        var rows = await context.BranchSettings
            .AsNoTracking()
            .Where(b => b.IsActive && b.IsDeliveryEnabled && (b.IsOrderingEnabled || evenWhilePaused)
                && b.Latitude != null && b.Longitude != null)
            .ToListAsync();

        // The area is a JSON document: whether it has its points is asked here, not of the database
        return rows
            .Where(Reaches)
            .Select(row => new BranchDeliveryTerms(row.BranchId, Terms(row, row.Latitude!.Value, row.Longitude!.Value),
                Paused: !row.IsOrderingEnabled))
            .ToList();
    }

    /// <summary>The branch says where it stops: a radius, or an area drawn on the map.</summary>
    private static bool Reaches(BranchSettings row) => row.DeliveryRadiusKm > 0 || row.DeliveryArea is { Length: >= 3 };

    private static DeliveryTerms Terms(BranchSettings row, double latitude, double longitude) => new(
        latitude, longitude, row.DeliveryRadiusKm > 0 ? row.DeliveryRadiusKm.Value : 0,
        row.DeliveryFee, row.DeliveryMinimumOrder, row.RequireSignInForDelivery,
        row.DeliveryArea is { Length: >= 3 } area ? area : null);
}

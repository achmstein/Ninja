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

    public async Task<DeliveryTerms?> GetDeliveryTermsAsync(int branchId, bool evenWhilePaused = false)
    {
        // Not bought, or switched off: no branch delivers, whatever it was set to
        if (!await IsDeliveryOnAsync()) return null;

        var row = await context.BranchSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(b => b.BranchId == branchId);

        return row is { IsDeliveryEnabled: true, Latitude: { } lat, Longitude: { } lng, DeliveryRadiusKm: > 0 }
            && (row.IsOrderingEnabled || evenWhilePaused)
            ? new DeliveryTerms(lat, lng, row.DeliveryRadiusKm.Value, row.DeliveryFee, row.DeliveryMinimumOrder)
            : null;
    }
}

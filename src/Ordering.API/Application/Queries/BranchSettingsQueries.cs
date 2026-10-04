#nullable enable
namespace Ninja.Ordering.API.Application.Queries;

public class BranchSettingsQueries(OrderingContext context) : IBranchSettingsQueries
{
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

    public async Task<bool> IsDeliveryOnAsync() =>
        await context.TenantFeatures
            .AsNoTracking()
            .Where(f => f.Id == TenantFeatures.SingletonId)
            .Select(f => (bool?)f.Delivery)
            .FirstOrDefaultAsync() ?? true;

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

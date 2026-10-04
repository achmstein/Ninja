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

    public async Task<DeliveryTerms?> GetDeliveryTermsAsync(int branchId)
    {
        var row = await context.BranchSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(b => b.BranchId == branchId);

        return row is { IsDeliveryEnabled: true, IsOrderingEnabled: true, Latitude: { } lat, Longitude: { } lng, DeliveryRadiusKm: > 0 }
            ? new DeliveryTerms(lat, lng, row.DeliveryRadiusKm.Value, row.DeliveryFee, row.DeliveryMinimumOrder)
            : null;
    }
}

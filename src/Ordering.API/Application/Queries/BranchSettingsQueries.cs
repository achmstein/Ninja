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
}

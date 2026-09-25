#nullable enable
using Ninja.Ordering.Infrastructure.Projections;

namespace Ninja.Ordering.API.Application.Queries;

public class TenantSettingsQueries(OrderingContext context) : ITenantSettingsQueries
{
    public async Task<bool> AllowsGuestOrdersAnywhereAsync()
    {
        var row = await context.TenantSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == TenantSettings.SingletonId);
        return row?.GuestOrdersAnywhere ?? false;
    }
}

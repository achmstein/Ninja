using Ninja.Spaces.Infrastructure.Projections;
using SpacesContext = Ninja.Spaces.Infrastructure.SpacesContext;

namespace Ninja.Spaces.API.Application.Queries;

public class TenantFeaturesQueries(SpacesContext context) : ITenantFeaturesQueries
{
    public async Task<TenantFeaturesViewModel> GetAsync()
    {
        var row = await context.TenantFeatures
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == TenantFeatures.SingletonId);

        return row is null ? TenantFeaturesViewModel.All : new(row.Reservations, row.TimeBilling);
    }
}

using SpacesContext = Ninja.Spaces.Infrastructure.SpacesContext;

namespace Ninja.Spaces.API.Application.Queries;

public class BranchSettingsQueries(SpacesContext context) : IBranchSettingsQueries
{
    public async Task<bool> IsReservationsEnabledAsync(int branchId)
    {
        var row = await context.BranchSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(b => b.BranchId == branchId);

        return row?.IsReservationsEnabled ?? true;
    }
}

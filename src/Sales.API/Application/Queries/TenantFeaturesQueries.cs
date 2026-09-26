using Ninja.Sales.Infrastructure.Projections;
using Ninja.Sales.Infrastructure;

namespace Ninja.Sales.API.Application.Queries;

/// <summary>
/// Reads Sales' projection of the café's switches (see
/// Ninja.Sales.Infrastructure.Projections.TenantFeatures).
/// </summary>
public interface ITenantFeaturesQueries
{
    /// <summary>Whether guests may pay online. Fail-closed: with no projection row, they may not.</summary>
    Task<bool> OnlinePaymentsAsync();
}

public class TenantFeaturesQueries(SalesContext context) : ITenantFeaturesQueries
{
    public async Task<bool> OnlinePaymentsAsync()
        => await context.TenantFeatures
            .AsNoTracking()
            .Where(t => t.Id == TenantFeatures.SingletonId)
            .Select(t => t.OnlinePayments)
            .FirstOrDefaultAsync();
}

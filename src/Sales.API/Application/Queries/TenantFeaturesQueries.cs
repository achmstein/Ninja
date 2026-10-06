using Ninja.Sales.Infrastructure.Projections;
using Ninja.Sales.Infrastructure;

namespace Ninja.Sales.API.Application.Queries;

/// <summary>
/// Reads Sales' projection of the business's switches (see
/// Ninja.Sales.Infrastructure.Projections.TenantFeatures).
/// </summary>
public interface ITenantFeaturesQueries
{
    /// <summary>Whether guests may pay online. Fail-closed: with no projection row, they may not.</summary>
    Task<bool> OnlinePaymentsAsync();

    /// <summary>Whether customers may pay online for a delivery or an order they collect, before the business sees it (online payments on, and this switch).</summary>
    Task<bool> PayAheadAsync();
}

public class TenantFeaturesQueries(SalesContext context) : ITenantFeaturesQueries
{
    public async Task<bool> OnlinePaymentsAsync()
        => await context.TenantFeatures
            .AsNoTracking()
            .Where(t => t.Id == TenantFeatures.SingletonId)
            .Select(t => t.OnlinePayments)
            .FirstOrDefaultAsync();

    public async Task<bool> PayAheadAsync()
        => await context.TenantFeatures
            .AsNoTracking()
            .Where(t => t.Id == TenantFeatures.SingletonId)
            .Select(t => t.OnlinePayments && t.PayAhead)
            .FirstOrDefaultAsync();
}

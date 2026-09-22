namespace Ninja.Spaces.API.Application.Queries;

/// <summary>The two switches Spaces owns a part of, as the café has them now.</summary>
public record TenantFeaturesViewModel(bool Reservations, bool TimeBilling)
{
    /// <summary>A stack that has never said: everything on.</summary>
    public static readonly TenantFeaturesViewModel All = new(true, true);
}

/// <summary>
/// Reads Spaces' projection of the café's switches (see
/// Ninja.Spaces.Infrastructure.Projections.TenantFeatures).
/// </summary>
public interface ITenantFeaturesQueries
{
    /// <summary>
    /// Whether places may take bookings and be charged by the hour.
    /// Fail-open: with no projection row, both are.
    /// </summary>
    Task<TenantFeaturesViewModel> GetAsync();
}

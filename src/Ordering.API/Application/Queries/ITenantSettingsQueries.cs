#nullable enable
namespace Ninja.Ordering.API.Application.Queries;

/// <summary>
/// Reads Ordering's projection of the café's own settings (see
/// Ninja.Ordering.Infrastructure.Projections.TenantSettings).
/// </summary>
public interface ITenantSettingsQueries
{
    /// <summary>
    /// Whether a guest may order without a table, at any branch. Fail-closed:
    /// a stack that has never said wants a guest at a table, as it always has.
    /// </summary>
    Task<bool> AllowsGuestOrdersAnywhereAsync();
}

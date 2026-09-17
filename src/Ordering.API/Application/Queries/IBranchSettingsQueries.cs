#nullable enable
namespace Chillax.Ordering.API.Application.Queries;

/// <summary>
/// Reads Ordering's projection of the branch flags (see
/// Chillax.Ordering.Infrastructure.Projections.BranchSettings).
/// </summary>
public interface IBranchSettingsQueries
{
    /// <summary>
    /// Whether customers may place orders at this branch right now. Fail-open:
    /// a branch with no projection row is taking orders.
    /// </summary>
    Task<bool> IsOrderingEnabledAsync(int branchId);

    /// <summary>
    /// Whether an order to a table at this branch needs an account. Fail-open:
    /// a branch with no projection row takes guest table orders.
    /// </summary>
    Task<bool> RequiresSignInForTableOrdersAsync(int branchId);
}

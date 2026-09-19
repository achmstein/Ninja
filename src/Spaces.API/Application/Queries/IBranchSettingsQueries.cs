namespace Ninja.Spaces.API.Application.Queries;

/// <summary>
/// Reads Spaces' projection of the branch flags (see
/// Ninja.Spaces.Infrastructure.Projections.BranchSettings).
/// </summary>
public interface IBranchSettingsQueries
{
    /// <summary>
    /// Whether customers may reserve a room at this branch right now.
    /// Fail-open: a branch with no projection row is taking reservations.
    /// </summary>
    Task<bool> IsReservationsEnabledAsync(int branchId);
}

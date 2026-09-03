#nullable enable
namespace Chillax.Spaces.Infrastructure.Projections;

/// <summary>
/// Spaces' own copy of a branch's operational flags, kept up to date from
/// Branch.API's BranchSettingsChangedIntegrationEvent — Spaces never calls
/// Branch.API. No row means the branch has never been heard of and is treated
/// as open (fail-open), so a fresh deployment never refuses reservations for
/// want of an event.
/// </summary>
public class BranchSettings
{
    public int BranchId { get; set; }

    public bool IsOrderingEnabled { get; set; }

    public bool IsReservationsEnabled { get; set; }

    /// <summary>
    /// CreationDate of the last event applied — the out-of-order guard: an
    /// older event arriving late must not undo a newer one.
    /// </summary>
    public DateTime UpdatedAt { get; set; }
}

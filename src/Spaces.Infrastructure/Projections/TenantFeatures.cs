#nullable enable
namespace Ninja.Spaces.Infrastructure.Projections;

/// <summary>
/// Spaces' own copy of the café's switches it owns a part of, kept up to
/// date from Branch.API's TenantFeaturesChangedIntegrationEvent — Spaces
/// never calls Branch.API. One row for the stack. No row means the stack has
/// never said, and is treated as having everything (fail-open), so a fresh
/// deployment never refuses a room for want of an event.
/// </summary>
public class TenantFeatures
{
    public const int SingletonId = 1;

    public int Id { get; set; } = SingletonId;

    /// <summary>Bookings: a place may take reservations.</summary>
    public bool Reservations { get; set; }

    /// <summary>The clock: a place may be charged by the hour.</summary>
    public bool TimeBilling { get; set; }

    /// <summary>
    /// CreationDate of the last event applied — the out-of-order guard: an
    /// older event arriving late must not undo a newer one.
    /// </summary>
    public DateTime UpdatedAt { get; set; }
}

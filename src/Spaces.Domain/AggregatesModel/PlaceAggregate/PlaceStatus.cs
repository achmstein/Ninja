namespace Ninja.Spaces.Domain.AggregatesModel.PlaceAggregate;

/// <summary>
/// The physical state of a place, kept apart from holds: whether a hold is
/// pending is computed at query time from the stays.
/// </summary>
public enum PlaceStatus
{
    /// <summary>Nobody is on it.</summary>
    Available = 1,

    /// <summary>A stay is running on it.</summary>
    Occupied = 2,

    /// <summary>Taken out of service by staff; refuses stays until put back.</summary>
    OutOfService = 3,
}

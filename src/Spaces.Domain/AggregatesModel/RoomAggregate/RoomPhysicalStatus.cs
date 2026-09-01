namespace Chillax.Spaces.Domain.AggregatesModel.RoomAggregate;

/// <summary>
/// Physical status of a room (not reservation status)
/// Reservations are tracked separately and checked at query time
/// </summary>
public enum RoomPhysicalStatus
{
    /// <summary>
    /// Room is physically available (no one playing)
    /// </summary>
    Available = 1,

    /// <summary>
    /// Room is currently occupied (someone is playing)
    /// </summary>
    Occupied = 2,

    /// <summary>
    /// Room is under maintenance and cannot be used
    /// </summary>
    Maintenance = 3
}

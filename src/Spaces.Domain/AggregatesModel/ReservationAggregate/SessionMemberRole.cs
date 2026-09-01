namespace Chillax.Spaces.Domain.AggregatesModel.ReservationAggregate;

/// <summary>
/// Role of a session member
/// </summary>
public enum SessionMemberRole
{
    /// <summary>
    /// Original reservation customer or first walk-in joiner
    /// </summary>
    Owner = 1,

    /// <summary>
    /// Joined via QR scan
    /// </summary>
    Member = 2
}

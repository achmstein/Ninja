namespace Chillax.Spaces.Domain.AggregatesModel.ReservationAggregate;

/// <summary>
/// Status of a reservation/session
/// </summary>
public enum ReservationStatus
{
    /// <summary>
    /// Customer has booked but not yet started playing
    /// </summary>
    Reserved = 1,

    /// <summary>
    /// Session is in progress (customer is playing)
    /// </summary>
    Active = 2,

    /// <summary>
    /// Session has ended normally
    /// </summary>
    Completed = 3,

    /// <summary>
    /// Reservation was cancelled
    /// </summary>
    Cancelled = 4
}

namespace Ninja.Spaces.Domain.AggregatesModel.ReservationAggregate;

/// <summary>Where a reservation is in its life: Requested → Confirmed → Seated, or Cancelled / Expired.</summary>
public enum ReservationStatus
{
    /// <summary>Asked for; the place is kept (from <see cref="Reservation.For"/> if that is set, else from now).</summary>
    Requested = 1,

    /// <summary>The café acknowledged it. Same hold on the place as Requested.</summary>
    Confirmed = 2,

    /// <summary>The party arrived and was seated; on a timed place a stay took over.</summary>
    Seated = 3,

    /// <summary>Given up by the customer or the staff before anyone was seated.</summary>
    Cancelled = 4,

    /// <summary>Nobody arrived in time.</summary>
    Expired = 5,
}

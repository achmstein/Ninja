namespace Ninja.Spaces.Domain.AggregatesModel.ReservationAggregate;

/// <summary>Where a reservation is in its life: Requested → Confirmed → Seated → Completed, or Cancelled / Expired.</summary>
public enum ReservationStatus
{
    /// <summary>Asked for; the place is kept (from <see cref="Reservation.For"/> if that is set, else from now).</summary>
    Requested = 1,

    /// <summary>The café acknowledged it. Same hold on the place as Requested.</summary>
    Confirmed = 2,

    /// <summary>The party is here: seated at the place, and nobody has closed it yet. On a timed place a stay took over and its end closes this too.</summary>
    Seated = 3,

    /// <summary>Given up by the customer or the staff before anyone was seated.</summary>
    Cancelled = 4,

    /// <summary>Nobody arrived in time.</summary>
    Expired = 5,

    /// <summary>The party left: the staff cleared the table, or the stay that took over ended.</summary>
    Completed = 6,
}

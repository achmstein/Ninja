namespace Ninja.Spaces.Domain.AggregatesModel.ReservationAggregate;

public interface IReservationRepository : IRepository<Reservation>
{
    Reservation Add(Reservation reservation);
    void Update(Reservation reservation);
    Task<Reservation?> GetAsync(int reservationId);
    Task<Reservation?> GetWithPlaceAsync(int reservationId);

    /// <summary>The customer's open reservation, if any (one at a time).</summary>
    Task<Reservation?> GetOpenForCustomerAsync(string customerId);

    /// <summary>Whether an open reservation keeps the place right now: one with no time, or whose time has come.</summary>
    Task<bool> IsHeldAsync(int placeId, DateTime now);

    /// <summary>Whether any open reservation on the place is within <see cref="Reservation.SlotMinutes"/> of <paramref name="at"/>.</summary>
    Task<bool> HasConflictAsync(int placeId, DateTime at, int? exceptReservationId = null);

    /// <summary>Whether the place has any open reservation at all.</summary>
    Task<bool> HasOpenAsync(int placeId);

    /// <summary>Open reservations whose time to arrive has run out.</summary>
    Task<List<Reservation>> GetLapsedAsync(DateTime now);

    /// <summary>The party seated at a plain table right now: seated, with no stay to keep the place for it.</summary>
    Task<Reservation?> GetSeatedAtAsync(int placeId);
}

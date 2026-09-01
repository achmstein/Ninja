using Chillax.Spaces.Domain.SeedWork;

namespace Chillax.Spaces.Domain.AggregatesModel.ReservationAggregate;

/// <summary>
/// Repository interface for Reservation aggregate
/// </summary>
public interface IReservationRepository : IRepository<Reservation>
{
    Reservation Add(Reservation reservation);
    void Update(Reservation reservation);
    Task<Reservation?> GetAsync(int reservationId);
    Task<Reservation?> GetWithRoomAsync(int reservationId);

    /// <summary>
    /// Get customer's active or reserved session (for one-at-a-time rule)
    /// </summary>
    Task<Reservation?> GetActiveReservationForCustomerAsync(string customerId);

    /// <summary>
    /// Get all active and reserved sessions for a room today
    /// </summary>
    Task<List<Reservation>> GetTodayReservationsForRoomAsync(int roomId);

    /// <summary>
    /// Get all active sessions (for admin view)
    /// </summary>
    Task<List<Reservation>> GetActiveSessionsAsync();

    /// <summary>
    /// Get customer's reservation history
    /// </summary>
    Task<List<Reservation>> GetCustomerReservationsAsync(string customerId, int? limit = null);

    /// <summary>
    /// Check if room has any active or reserved session (room is busy)
    /// </summary>
    Task<bool> HasActiveReservationAsync(int roomId);

    /// <summary>
    /// Get reservation with session members loaded
    /// </summary>
    Task<Reservation?> GetWithMembersAsync(int reservationId);

    /// <summary>
    /// Get reservation with session segments loaded
    /// </summary>
    Task<Reservation?> GetWithSegmentsAsync(int reservationId);

    /// <summary>
    /// Get the active session for a room (with members loaded)
    /// </summary>
    Task<Reservation?> GetActiveSessionForRoomAsync(int roomId);
}

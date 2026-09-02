namespace Chillax.Spaces.API.Application.Queries;

public interface IRoomQueries
{
    /// <summary>
    /// Get all rooms with their current display status for a branch
    /// </summary>
    Task<IEnumerable<RoomViewModel>> GetAllRoomsAsync(int branchId);

    /// <summary>
    /// Get rooms available now (for immediate booking) for a branch
    /// </summary>
    Task<IEnumerable<RoomViewModel>> GetAvailableRoomsAsync(int branchId);

    /// <summary>
    /// Get room by ID
    /// </summary>
    Task<RoomViewModel?> GetRoomByIdAsync(int roomId);

    /// <summary>
    /// Get customer's reservations, newest first, paged
    /// </summary>
    Task<IEnumerable<ReservationViewModel>> GetCustomerReservationsAsync(string customerId, int pageIndex = 0, int pageSize = 20);

    /// <summary>
    /// Get all active sessions (admin view) for a branch
    /// </summary>
    Task<IEnumerable<ReservationViewModel>> GetActiveSessionsAsync(int branchId);

    /// <summary>
    /// Get reservation by ID
    /// </summary>
    Task<ReservationViewModel?> GetReservationByIdAsync(int reservationId);

    /// <summary>
    /// Get completed session history for a room
    /// </summary>
    Task<IEnumerable<ReservationViewModel>> GetRoomSessionHistoryAsync(int roomId, int limit = 20);

    /// <summary>
    /// Get room scan info (for QR code scan-to-join)
    /// </summary>
    Task<RoomScanViewModel?> GetRoomScanInfoAsync(int roomId, string customerId);

    /// <summary>
    /// Get completed/cancelled session history across all rooms of a branch,
    /// paginated and optionally filtered by room and date range
    /// </summary>
    Task<PaginatedResult<ReservationViewModel>> GetSessionHistoryAsync(
        int branchId,
        int pageIndex,
        int pageSize,
        int? roomId = null,
        DateTime? fromDate = null,
        DateTime? toDate = null);

    /// <summary>
    /// Aggregated per-day and per-room statistics over completed sessions
    /// (admin dashboard). tzOffsetMinutes uses JS getTimezoneOffset semantics
    /// (UTC − local) so days bucket on the caller's calendar.
    /// </summary>
    Task<SessionStats> GetSessionStatsAsync(int branchId, DateTime fromDate, DateTime toDate, int tzOffsetMinutes);
}

/// <summary>
/// Paginated result wrapper
/// </summary>
public record PaginatedResult<T>
{
    public IEnumerable<T> Items { get; init; } = Enumerable.Empty<T>();
    public int PageIndex { get; init; }
    public int PageSize { get; init; }
    public int TotalCount { get; init; }
    public int TotalPages => (int)Math.Ceiling(TotalCount / (double)PageSize);
    public bool HasNextPage => PageIndex < TotalPages - 1;
    public bool HasPreviousPage => PageIndex > 0;
}

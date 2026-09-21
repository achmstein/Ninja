namespace Ninja.Spaces.API.Application.Queries;

public interface IReservationQueries
{
    /// <summary>Open reservations of a branch, soonest first: the ones keeping a place now and the ones due later.</summary>
    Task<IEnumerable<ReservationViewModel>> GetOpenAsync(int branchId);

    /// <summary>The customer's reservations, newest first, paged.</summary>
    Task<IEnumerable<ReservationViewModel>> GetCustomerReservationsAsync(string customerId, int pageIndex = 0, int pageSize = 20);

    Task<ReservationViewModel?> GetByIdAsync(int reservationId);

    /// <summary>Seated, cancelled and lapsed reservations at one place, newest first.</summary>
    Task<IEnumerable<ReservationViewModel>> GetPlaceHistoryAsync(int placeId, int limit = 20);

    /// <summary>Seated, cancelled and lapsed reservations across a branch, paged, by place and the day they were for.</summary>
    Task<PaginatedResult<ReservationViewModel>> GetHistoryAsync(
        int branchId,
        int pageIndex,
        int pageSize,
        int? placeId = null,
        DateTime? fromDate = null,
        DateTime? toDate = null);
}

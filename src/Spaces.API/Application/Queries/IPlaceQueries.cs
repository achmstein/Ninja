using Chillax.Spaces.Domain.AggregatesModel.PlaceAggregate;

namespace Chillax.Spaces.API.Application.Queries;

public interface IPlaceQueries
{
    /// <summary>Every place of a branch with its display status; narrow by kind or to timed ones.</summary>
    Task<IEnumerable<PlaceViewModel>> GetPlacesAsync(int branchId, PlaceKind? kind = null, bool? timed = null);

    /// <summary>Timed, active places nobody holds right now: what a customer can book.</summary>
    Task<IEnumerable<PlaceViewModel>> GetAvailablePlacesAsync(int branchId);

    Task<PlaceViewModel?> GetPlaceByIdAsync(int placeId);

    /// <summary>
    /// LEGACY(places): lookup by the old table sticker id — remove when the printed room/table stickers are reprinted with /p/{id}.
    /// The place a printed table sticker (/table/{id}) points at.
    /// </summary>
    Task<PlaceViewModel?> GetPlaceByLegacyTableIdAsync(int tableId);

    /// <summary>The customer's stays (owner or member), newest first, paged.</summary>
    Task<IEnumerable<StayViewModel>> GetCustomerStaysAsync(string customerId, int pageIndex = 0, int pageSize = 20);

    /// <summary>Held and running stays of a branch (the till's floor).</summary>
    Task<IEnumerable<StayViewModel>> GetOpenStaysAsync(int branchId);

    Task<StayViewModel?> GetStayByIdAsync(int stayId);

    /// <summary>Ended and cancelled stays at one place, newest first.</summary>
    Task<IEnumerable<StayViewModel>> GetPlaceStayHistoryAsync(int placeId, int limit = 20);

    /// <summary>What a scanned QR resolves to for this customer.</summary>
    Task<PlaceScanViewModel?> GetScanInfoAsync(int placeId, string customerId);

    /// <summary>Ended and cancelled stays across a branch, paged, filtered by place and dates.</summary>
    Task<PaginatedResult<StayViewModel>> GetStayHistoryAsync(
        int branchId,
        int pageIndex,
        int pageSize,
        int? placeId = null,
        DateTime? fromDate = null,
        DateTime? toDate = null);

    /// <summary>
    /// Per-day and per-place hours, stays and revenue over ended stays.
    /// tzOffsetMinutes uses JS getTimezoneOffset semantics (UTC − local).
    /// </summary>
    Task<StayStats> GetStayStatsAsync(int branchId, DateTime fromDate, DateTime toDate, int tzOffsetMinutes);
}

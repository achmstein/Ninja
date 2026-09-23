#nullable enable
namespace Ninja.Ordering.API.Application.Queries;

public interface IOrderQueries
{
    Task<Order> GetOrderAsync(int id);

    Task<PaginatedResult<OrderSummary>> GetOrdersFromUserAsync(string userId, int pageIndex, int pageSize, DateTime? fromDate = null, DateTime? toDate = null);

    /// <summary>
    /// Orders placed from one guest device, for a customer with no account.
    /// </summary>
    Task<PaginatedResult<OrderSummary>> GetGuestOrdersAsync(string guestId, int pageIndex, int pageSize, DateTime? fromDate = null, DateTime? toDate = null);

    /// <summary>
    /// Who an order belongs to, for authorizing a read of it. Null when no
    /// such order exists.
    /// </summary>
    Task<OrderOwnership?> GetOrderOwnershipAsync(int id);

    /// <summary>
    /// Get all pending orders (Submitted status) for admin review, filtered by branch
    /// </summary>
    Task<IEnumerable<OrderSummary>> GetPendingOrdersAsync(int branchId);

    /// <summary>
    /// A guest with an order still waiting on the till at this place: the
    /// next one waits until that one is answered.
    /// </summary>
    Task<bool> HasUnconfirmedGuestOrderAtPlaceAsync(string guestId, int placeId);

    /// <summary>The till turned this guest away at this branch, and the block has not lapsed.</summary>
    Task<bool> IsGuestBlockedAsync(string guestId, int branchId);

    /// <summary>
    /// The table's tab as everyone sitting at it sees it: every unpaid,
    /// unvoided, uncancelled order at the place, whoever placed it, with
    /// lines. The bill being paid is what ends a sitting, not a clock.
    /// Only for a caller who is on the tab themselves — an unpaid order of
    /// theirs at the place, by account or by the guest id their browser
    /// holds; anyone else gets an empty list, since having the table's link
    /// is not being at the table. <see cref="OrderSummary.IsMine"/> marks the
    /// caller's own. Contact details are left out: a table-mate is not staff.
    /// </summary>
    Task<IEnumerable<OrderSummary>> GetOpenOrdersAtPlaceAsync(int placeId, string? userId, string? guestId);

    /// <summary>
    /// The kitchen's queue for a branch: confirmed orders, ready or not, from
    /// the last day. For a <paramref name="stationId"/>, only the orders with
    /// a part on that station's screen, with only its lines and its part's
    /// ready time; without one, the pass: whole orders with every part.
    /// Orders made only at printers are on no screen at all.
    /// </summary>
    Task<IEnumerable<KitchenOrder>> GetKitchenOrdersAsync(int branchId, int? stationId = null);

    /// <summary>
    /// Get all orders paginated (admin), filtered by branch and optionally by
    /// status, buyer, date range, and the room session they were ordered into
    /// </summary>
    Task<PaginatedResult<OrderSummary>> GetAllOrdersAsync(
        int pageIndex,
        int pageSize,
        int branchId,
        IReadOnlyCollection<string>? statuses = null,
        string? buyerId = null,
        DateTime? fromDate = null,
        DateTime? toDate = null,
        int? sessionId = null,
        string? search = null,
        string? sort = null);

    /// <summary>
    /// Aggregated per-day and per-item order statistics (admin dashboard),
    /// excluding cancelled orders. tzOffsetMinutes uses JS getTimezoneOffset
    /// semantics (UTC − local) so days bucket on the caller's calendar.
    /// </summary>
    Task<OrderStats> GetOrderStatsAsync(int branchId, DateTime fromDate, DateTime toDate, int tzOffsetMinutes);
}

/// <summary>
/// The two ways an order can belong to someone: a signed-in buyer's identity,
/// or the guest id it was placed under. Exactly one is set. Never returned to
/// a client — the guest id is a secret, not an identifier to hand out.
/// </summary>
/// <param name="BranchId">Where the order was placed: till staff read the orders of the branches they work in.</param>
public record OrderOwnership(string? BuyerIdentityGuid, string? GuestId, int BranchId);

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

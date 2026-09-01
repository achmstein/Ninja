#nullable enable
namespace Chillax.Ordering.API.Application.Queries;

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
    /// Get all orders paginated (admin), filtered by branch and optionally by
    /// status, buyer, and date range
    /// </summary>
    Task<PaginatedResult<OrderSummary>> GetAllOrdersAsync(
        int pageIndex,
        int pageSize,
        int branchId,
        IReadOnlyCollection<string>? statuses = null,
        string? buyerId = null,
        DateTime? fromDate = null,
        DateTime? toDate = null);

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
public record OrderOwnership(string? BuyerIdentityGuid, string? GuestId);

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

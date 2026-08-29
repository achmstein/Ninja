#nullable enable
namespace Chillax.Ordering.API.Application.Queries;

public interface IOrderQueries
{
    Task<Order> GetOrderAsync(int id);

    Task<PaginatedResult<OrderSummary>> GetOrdersFromUserAsync(string userId, int pageIndex, int pageSize, DateTime? fromDate = null, DateTime? toDate = null);

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

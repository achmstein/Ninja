#nullable enable
namespace Chillax.Ordering.API.Application.Queries;

using DomainOrder = Chillax.Ordering.Domain.AggregatesModel.OrderAggregate.Order;

/// <summary>
/// Simplified order queries for cafe ordering system.
/// </summary>
public class OrderQueries(OrderingContext context) : IOrderQueries
{
    public async Task<Order> GetOrderAsync(int id)
    {
        var order = await context.Orders
            .Include(o => o.OrderItems)
            .Include(o => o.Rating)
            .FirstOrDefaultAsync(o => o.Id == id);

        if (order is null)
            throw new KeyNotFoundException();

        return new Order
        {
            OrderNumber = order.Id,
            Date = order.OrderDate,
            Description = order.Description,
            RoomName = order.RoomName,
            CustomerNote = order.CustomerNote,
            Status = order.OrderStatus.ToString(),
            Total = order.GetTotal(),
            PointsToRedeem = order.PointsToRedeem,
            LoyaltyDiscount = order.LoyaltyDiscount,
            OrderItems = order.OrderItems.Select(oi => new Orderitem
            {
                ProductName = oi.ProductName,
                Units = oi.Units,
                UnitPrice = (double)oi.UnitPrice,
                PictureUrl = oi.PictureUrl,
                CustomizationsDescription = oi.CustomizationsDescription,
                SpecialInstructions = oi.SpecialInstructions
            }).ToList(),
            Rating = order.Rating != null ? new OrderRatingDto
            {
                RatingValue = order.Rating.RatingValue,
                Comment = order.Rating.Comment,
                CreatedAt = order.Rating.CreatedAt
            } : null
        };
    }

    public async Task<PaginatedResult<OrderSummary>> GetOrdersFromUserAsync(string userId, int pageIndex, int pageSize, DateTime? fromDate = null, DateTime? toDate = null)
    {
        var query = context.Orders
            .Where(o => o.Buyer != null && o.Buyer.IdentityGuid == userId);

        if (fromDate.HasValue)
            query = query.Where(o => o.OrderDate >= fromDate.Value);

        if (toDate.HasValue)
            query = query.Where(o => o.OrderDate <= toDate.Value);

        var totalCount = await query.CountAsync();

        var items = await query
            .AsNoTracking()
            .OrderByDescending(o => o.OrderDate)
            .Skip(pageIndex * pageSize)
            .Take(pageSize)
            .Select(o => new OrderSummary
            {
                OrderNumber = o.Id,
                Date = o.OrderDate,
                Status = o.OrderStatus.ToString(),
                Total = (double)o.OrderItems.Sum(oi => oi.UnitPrice * oi.Units),
                PointsToRedeem = o.PointsToRedeem,
                LoyaltyDiscount = o.LoyaltyDiscount,
                RoomName = o.RoomName,
                RatingValue = o.Rating != null ? (int?)o.Rating.RatingValue : null
            })
            .ToListAsync();

        return new PaginatedResult<OrderSummary>
        {
            Items = items,
            PageIndex = pageIndex,
            PageSize = pageSize,
            TotalCount = totalCount
        };
    }

    public async Task<IEnumerable<OrderSummary>> GetPendingOrdersAsync(int branchId)
    {
        var query = context.Orders
            .AsNoTracking()
            .Include(o => o.Buyer)
            .Where(o => o.OrderStatus == Ordering.Domain.AggregatesModel.OrderAggregate.OrderStatus.Submitted)
            .Where(o => o.BranchId == branchId);

        return await query
            .OrderByDescending(o => o.OrderDate)
            .Select(o => new OrderSummary
            {
                OrderNumber = o.Id,
                Date = o.OrderDate,
                Status = o.OrderStatus.ToString(),
                Total = (double)o.OrderItems.Sum(oi => oi.UnitPrice * oi.Units),
                PointsToRedeem = o.PointsToRedeem,
                LoyaltyDiscount = o.LoyaltyDiscount,
                RoomName = o.RoomName,
                UserName = o.Buyer != null ? o.Buyer.Name : null,
                RatingValue = o.Rating != null ? (int?)o.Rating.RatingValue : null
            })
            .ToListAsync();
    }

    public async Task<PaginatedResult<OrderSummary>> GetAllOrdersAsync(
        int pageIndex,
        int pageSize,
        int branchId,
        IReadOnlyCollection<string>? statuses = null,
        string? buyerId = null,
        DateTime? fromDate = null,
        DateTime? toDate = null)
    {
        var query = context.Orders.AsNoTracking().Include(o => o.Buyer)
            .Where(o => o.BranchId == branchId);

        if (statuses is { Count: > 0 })
        {
            var parsedStatuses = statuses
                .Select(s => Enum.TryParse<Ordering.Domain.AggregatesModel.OrderAggregate.OrderStatus>(s, ignoreCase: true, out var status)
                    ? status
                    : (Ordering.Domain.AggregatesModel.OrderAggregate.OrderStatus?)null)
                .Where(s => s.HasValue)
                .Select(s => s!.Value)
                .ToList();

            if (parsedStatuses.Count > 0)
                query = query.Where(o => parsedStatuses.Contains(o.OrderStatus));
        }

        if (!string.IsNullOrEmpty(buyerId))
            query = query.Where(o => o.Buyer != null && o.Buyer.IdentityGuid == buyerId);

        if (fromDate.HasValue)
            query = query.Where(o => o.OrderDate >= fromDate.Value);

        if (toDate.HasValue)
            query = query.Where(o => o.OrderDate <= toDate.Value);

        var totalCount = await query.CountAsync();

        var items = await query
            .OrderByDescending(o => o.OrderDate)
            .Skip(pageIndex * pageSize)
            .Take(pageSize)
            .Select(o => new OrderSummary
            {
                OrderNumber = o.Id,
                Date = o.OrderDate,
                Status = o.OrderStatus.ToString(),
                Total = (double)o.OrderItems.Sum(oi => oi.UnitPrice * oi.Units),
                PointsToRedeem = o.PointsToRedeem,
                LoyaltyDiscount = o.LoyaltyDiscount,
                RoomName = o.RoomName,
                UserName = o.Buyer != null ? o.Buyer.Name : null,
                RatingValue = o.Rating != null ? (int?)o.Rating.RatingValue : null
            })
            .ToListAsync();

        return new PaginatedResult<OrderSummary>
        {
            Items = items,
            PageIndex = pageIndex,
            PageSize = pageSize,
            TotalCount = totalCount
        };
    }

    public async Task<OrderStats> GetOrderStatsAsync(int branchId, DateTime fromDate, DateTime toDate, int tzOffsetMinutes)
    {
        // Narrow projections aggregated in memory: a range covers at most a
        // few thousand rows, and grouping on the JSON ProductName column (or
        // a tz-shifted date) doesn't translate to SQL anyway.
        var baseQuery = context.Orders
            .AsNoTracking()
            .Where(o => o.BranchId == branchId)
            .Where(o => o.OrderStatus != Ordering.Domain.AggregatesModel.OrderAggregate.OrderStatus.Cancelled)
            .Where(o => o.OrderDate >= fromDate && o.OrderDate <= toDate);

        var orders = await baseQuery
            .Select(o => new
            {
                o.OrderDate,
                Total = o.OrderItems.Sum(oi => oi.UnitPrice * oi.Units),
            })
            .ToListAsync();

        // JS getTimezoneOffset is UTC − local, so local = UTC − offset
        var days = orders
            .GroupBy(o => DateOnly.FromDateTime(o.OrderDate.AddMinutes(-tzOffsetMinutes)))
            .OrderBy(g => g.Key)
            .Select(g => new OrderStatsDay
            {
                Date = g.Key,
                Orders = g.Count(),
                Revenue = (double)g.Sum(o => o.Total),
            })
            .ToList();

        var itemRows = await baseQuery
            .SelectMany(o => o.OrderItems)
            .Select(oi => new { oi.ProductId, oi.ProductName, oi.Units, oi.UnitPrice })
            .ToListAsync();

        var topItems = itemRows
            .GroupBy(i => i.ProductId)
            .Select(g => new OrderStatsItem
            {
                ProductName = g.First().ProductName,
                Units = g.Sum(i => i.Units),
                Revenue = (double)g.Sum(i => i.UnitPrice * i.Units),
            })
            .OrderByDescending(i => i.Units)
            .Take(10)
            .ToList();

        return new OrderStats { Days = days, TopItems = topItems };
    }
}

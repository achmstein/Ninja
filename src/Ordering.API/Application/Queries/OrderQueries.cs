#nullable enable
namespace Chillax.Ordering.API.Application.Queries;

using System.Linq.Expressions;
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
            SessionId = order.SessionId,
            RoomId = order.RoomId,
            Source = order.Source.ToString(),
            TableId = order.TableId,
            TableName = order.TableName,
            CustomerNote = order.CustomerNote,
            // Only an admin or the customer themselves can read an order, so
            // the guest's contact details are safe to carry here — and staff
            // have no other way to reach someone without an account.
            GuestName = order.GuestName,
            GuestPhone = order.GuestPhone,
            Status = order.OrderStatus.ToString(),
            Total = order.GetTotal(),
            PointsToRedeem = order.PointsToRedeem,
            LoyaltyDiscount = order.LoyaltyDiscount,
            PaidAt = order.PaidAt,
            ReceiptNumber = order.ReceiptNumber,
            PaidWith = order.PaidWith,
            RefundedAmount = order.RefundedAmount,
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

    public Task<PaginatedResult<OrderSummary>> GetOrdersFromUserAsync(string userId, int pageIndex, int pageSize, DateTime? fromDate = null, DateTime? toDate = null)
        => GetOwnOrdersAsync(o => o.Buyer != null && o.Buyer.IdentityGuid == userId, pageIndex, pageSize, fromDate, toDate);

    public Task<PaginatedResult<OrderSummary>> GetGuestOrdersAsync(string guestId, int pageIndex, int pageSize, DateTime? fromDate = null, DateTime? toDate = null)
        => GetOwnOrdersAsync(o => o.GuestId == guestId, pageIndex, pageSize, fromDate, toDate);

    public async Task<OrderOwnership?> GetOrderOwnershipAsync(int id)
        => await context.Orders
            .AsNoTracking()
            .Where(o => o.Id == id)
            .Select(o => new OrderOwnership(
                o.Buyer != null ? o.Buyer.IdentityGuid : null,
                o.GuestId))
            .FirstOrDefaultAsync();

    /// <summary>
    /// The customer's own order list. Identical whether they are signed in or
    /// ordering as a guest — only what makes an order theirs differs — and it
    /// deliberately carries no buyer or guest identifiers back to the client.
    /// </summary>
    private async Task<PaginatedResult<OrderSummary>> GetOwnOrdersAsync(
        Expression<Func<DomainOrder, bool>> isTheirs,
        int pageIndex,
        int pageSize,
        DateTime? fromDate,
        DateTime? toDate)
    {
        var query = context.Orders.Where(isTheirs);

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
                Total = Math.Max(0, (double)o.OrderItems.Sum(oi => oi.UnitPrice * oi.Units - oi.Discount) - o.LoyaltyDiscount),
                PointsToRedeem = o.PointsToRedeem,
                LoyaltyDiscount = o.LoyaltyDiscount,
                PaidAt = o.PaidAt,
                ReceiptNumber = o.ReceiptNumber,
                PaidWith = o.PaidWith,
                RefundedAmount = o.RefundedAmount,
                RoomName = o.RoomName,
                TableId = o.TableId,
                TableName = o.TableName,
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

    public async Task<IEnumerable<KitchenOrder>> GetKitchenOrdersAsync(int branchId)
    {
        // A card left on the board overnight is stale, not work; ready orders
        // stay in the same window as the day's history the screen can recall from
        var confirmedSince = DateTime.UtcNow.AddHours(-24);

        return await context.Orders
            .AsNoTracking()
            .Where(o => o.BranchId == branchId)
            .Where(o => o.OrderStatus == Ordering.Domain.AggregatesModel.OrderAggregate.OrderStatus.Confirmed)
            // Confirmed before the kitchen display existed: not its business
            .Where(o => o.ConfirmedAt != null && o.ConfirmedAt >= confirmedSince)
            .OrderBy(o => o.ConfirmedAt)
            .Select(o => new KitchenOrder
            {
                OrderNumber = o.Id,
                Date = o.OrderDate,
                ConfirmedAt = o.ConfirmedAt,
                ReadyAt = o.ReadyAt,
                Source = o.Source.ToString(),
                RoomName = o.RoomName,
                TableName = o.TableName,
                CustomerName = o.Buyer != null ? o.Buyer.Name : o.GuestName,
                CustomerNote = o.CustomerNote,
                Items = o.OrderItems.Select(oi => new KitchenOrderItem
                {
                    ProductName = oi.ProductName,
                    Units = oi.Units,
                    CustomizationsDescription = oi.CustomizationsDescription,
                    SpecialInstructions = oi.SpecialInstructions
                }).ToList()
            })
            .ToListAsync();
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
                Total = Math.Max(0, (double)o.OrderItems.Sum(oi => oi.UnitPrice * oi.Units - oi.Discount) - o.LoyaltyDiscount),
                PointsToRedeem = o.PointsToRedeem,
                LoyaltyDiscount = o.LoyaltyDiscount,
                PaidAt = o.PaidAt,
                ReceiptNumber = o.ReceiptNumber,
                PaidWith = o.PaidWith,
                RefundedAmount = o.RefundedAmount,
                RoomName = o.RoomName,
                SessionId = o.SessionId,
                Source = o.Source.ToString(),
                TableId = o.TableId,
                TableName = o.TableName,
                // A guest has no Buyer row, so the name they left at checkout
                // is what staff see; UserId stays null, which is what tells
                // the admin board there is no customer profile to open.
                UserName = o.Buyer != null ? o.Buyer.Name : o.GuestName,
                UserId = o.Buyer != null ? o.Buyer.IdentityGuid : null,
                GuestPhone = o.GuestPhone,
                RatingValue = o.Rating != null ? (int?)o.Rating.RatingValue : null,
                CustomerNote = o.CustomerNote,
                Items = o.OrderItems.Select(oi => new Orderitem
                {
                    ProductName = oi.ProductName,
                    Units = oi.Units,
                    UnitPrice = (double)oi.UnitPrice,
                    PictureUrl = oi.PictureUrl,
                    CustomizationsDescription = oi.CustomizationsDescription,
                    SpecialInstructions = oi.SpecialInstructions
                }).ToList()
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
        DateTime? toDate = null,
        int? sessionId = null,
        string? search = null,
        string? sort = null)
    {
        var query = context.Orders.AsNoTracking().Include(o => o.Buyer)
            .Where(o => o.BranchId == branchId);

        if (sessionId.HasValue)
            query = query.Where(o => o.SessionId == sessionId.Value);

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

        // A number is an order number; anything else matches the buyer or guest name
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            if (int.TryParse(term, out var orderNumber))
            {
                query = query.Where(o => o.Id == orderNumber);
            }
            else
            {
                var pattern = $"%{term}%";
                query = query.Where(o =>
                    (o.Buyer != null && EF.Functions.ILike(o.Buyer.Name, pattern)) ||
                    (o.GuestName != null && EF.Functions.ILike(o.GuestName, pattern)));
            }
        }

        var totalCount = await query.CountAsync();

        // Newest first unless the admin sorts the table otherwise
        var ordered = sort switch
        {
            "date_asc" => query.OrderBy(o => o.OrderDate),
            "total_desc" => query.OrderByDescending(o => o.OrderItems.Sum(oi => oi.UnitPrice * oi.Units - oi.Discount)),
            "total_asc" => query.OrderBy(o => o.OrderItems.Sum(oi => oi.UnitPrice * oi.Units - oi.Discount)),
            _ => query.OrderByDescending(o => o.OrderDate)
        };

        var items = await ordered
            .Skip(pageIndex * pageSize)
            .Take(pageSize)
            .Select(o => new OrderSummary
            {
                OrderNumber = o.Id,
                Date = o.OrderDate,
                Status = o.OrderStatus.ToString(),
                Total = Math.Max(0, (double)o.OrderItems.Sum(oi => oi.UnitPrice * oi.Units - oi.Discount) - o.LoyaltyDiscount),
                PointsToRedeem = o.PointsToRedeem,
                LoyaltyDiscount = o.LoyaltyDiscount,
                PaidAt = o.PaidAt,
                ReceiptNumber = o.ReceiptNumber,
                PaidWith = o.PaidWith,
                RefundedAmount = o.RefundedAmount,
                RoomName = o.RoomName,
                SessionId = o.SessionId,
                Source = o.Source.ToString(),
                TableId = o.TableId,
                TableName = o.TableName,
                // A guest has no Buyer row, so the name they left at checkout
                // is what staff see; UserId stays null, which is what tells
                // the admin board there is no customer profile to open.
                UserName = o.Buyer != null ? o.Buyer.Name : o.GuestName,
                UserId = o.Buyer != null ? o.Buyer.IdentityGuid : null,
                GuestPhone = o.GuestPhone,
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
                // Net of line discounts and the loyalty discount — revenue is
                // what customers actually paid, not the sticker sum
                Total = Math.Max(0, (double)o.OrderItems.Sum(oi => oi.UnitPrice * oi.Units - oi.Discount) - o.LoyaltyDiscount),
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

#nullable enable
namespace Ninja.Ordering.API.Application.Queries;

using System.Linq.Expressions;
using DomainOrder = Ninja.Ordering.Domain.AggregatesModel.OrderAggregate.Order;

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
            PlaceId = order.PlaceId,
            PlaceKind = order.PlaceKind,
            PlaceName = order.PlaceName,
            SessionId = order.SessionId,
            Source = order.Source.ToString(),
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
            PromoCode = order.PromoCode,
            PromoDiscount = order.PromoDiscount,
            PaidAt = order.PaidAt,
            ReceiptNumber = order.ReceiptNumber,
            PaidWith = order.PaidWith,
            RefundedAmount = order.RefundedAmount,
            VoidedAt = order.VoidedAt,
            TicketId = order.TicketId,
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
                o.GuestId,
                o.BranchId))
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
                Total = Math.Max(0, (double)(o.OrderItems.Sum(oi => oi.UnitPrice * oi.Units - oi.Discount) - o.PromoDiscount) - o.LoyaltyDiscount),
                PointsToRedeem = o.PointsToRedeem,
                LoyaltyDiscount = o.LoyaltyDiscount,
                PromoCode = o.PromoCode,
                PromoDiscount = o.PromoDiscount,
                PaidAt = o.PaidAt,
                ReceiptNumber = o.ReceiptNumber,
                PaidWith = o.PaidWith,
                RefundedAmount = o.RefundedAmount,
                VoidedAt = o.VoidedAt,
                TicketId = o.TicketId,
                // Where it was ordered to: the place, which is what the
                // customer's list names
                PlaceId = o.PlaceId,
                PlaceKind = o.PlaceKind,
                PlaceName = o.PlaceName,
                SessionId = o.SessionId,
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

    public async Task<IEnumerable<KitchenOrder>> GetKitchenOrdersAsync(int branchId, int? stationId = null)
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
            // A station sees the orders with a part on its screen; the pass
            // sees every order someone will mark ready — those confirmed
            // before stations included, printer-only ones not
            .Where(o => stationId == null
                ? !o.StationParts.Any() || o.StationParts.Any(p => p.ShowsOnScreen)
                : o.StationParts.Any(p => p.StationId == stationId && p.ShowsOnScreen))
            .OrderBy(o => o.ConfirmedAt)
            .Select(o => new KitchenOrder
            {
                OrderNumber = o.Id,
                Date = o.OrderDate,
                ConfirmedAt = o.ConfirmedAt,
                // A station's board and history follow its own part
                ReadyAt = stationId == null
                    ? o.ReadyAt
                    : o.StationParts.Where(p => p.StationId == stationId).Select(p => p.ReadyAt).FirstOrDefault(),
                Source = o.Source.ToString(),
                PlaceId = o.PlaceId,
                PlaceKind = o.PlaceKind,
                PlaceName = o.PlaceName,
                CustomerName = o.Buyer != null ? o.Buyer.Name : o.GuestName,
                CustomerNote = o.CustomerNote,
                Items = o.OrderItems
                    .Where(oi => stationId == null || oi.StationId == stationId)
                    .Select(oi => new KitchenOrderItem
                    {
                        ProductName = oi.ProductName,
                        Units = oi.Units,
                        CustomizationsDescription = oi.CustomizationsDescription,
                        SpecialInstructions = oi.SpecialInstructions,
                        StationId = oi.StationId
                    }).ToList(),
                Parts = o.StationParts
                    .OrderBy(p => p.Id)
                    .Select(p => new KitchenOrderPart
                    {
                        StationId = p.StationId,
                        StationName = p.StationName,
                        ShowsOnScreen = p.ShowsOnScreen,
                        PrintsTickets = p.PrintsTickets,
                        ReadyAt = p.ReadyAt
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
                Total = Math.Max(0, (double)(o.OrderItems.Sum(oi => oi.UnitPrice * oi.Units - oi.Discount) - o.PromoDiscount) - o.LoyaltyDiscount),
                PointsToRedeem = o.PointsToRedeem,
                LoyaltyDiscount = o.LoyaltyDiscount,
                PromoCode = o.PromoCode,
                PromoDiscount = o.PromoDiscount,
                PaidAt = o.PaidAt,
                ReceiptNumber = o.ReceiptNumber,
                PaidWith = o.PaidWith,
                RefundedAmount = o.RefundedAmount,
                VoidedAt = o.VoidedAt,
                TicketId = o.TicketId,
                PlaceId = o.PlaceId,
                PlaceKind = o.PlaceKind,
                PlaceName = o.PlaceName,
                SessionId = o.SessionId,
                Source = o.Source.ToString(),
                // A guest has no Buyer row, so the name they left at checkout
                // is what staff see; UserId stays null, which is what tells
                // the admin board there is no customer profile to open.
                UserName = o.Buyer != null ? o.Buyer.Name : o.GuestName,
                UserId = o.Buyer != null ? o.Buyer.IdentityGuid : null,
                GuestPhone = o.GuestPhone,
                // How many orders this device has had confirmed here before:
                // a first-timer at a table is worth a second look
                GuestOrdersBefore = o.GuestId == null
                    ? null
                    : context.Orders.Count(x => x.GuestId == o.GuestId
                        && x.BranchId == o.BranchId
                        && x.Id != o.Id
                        && x.OrderStatus == Ordering.Domain.AggregatesModel.OrderAggregate.OrderStatus.Confirmed),
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

    public Task<bool> HasUnconfirmedGuestOrderAtPlaceAsync(string guestId, int placeId)
        => context.Orders
            .AsNoTracking()
            .AnyAsync(o => o.GuestId == guestId
                && o.PlaceId == placeId
                && (o.OrderStatus == Ordering.Domain.AggregatesModel.OrderAggregate.OrderStatus.AwaitingValidation
                    || o.OrderStatus == Ordering.Domain.AggregatesModel.OrderAggregate.OrderStatus.Submitted));

    public Task<bool> HasUnconfirmedGuestOrderAwayAsync(string guestId)
        => context.Orders
            .AsNoTracking()
            .AnyAsync(o => o.GuestId == guestId
                && o.PlaceId == null
                && (o.OrderStatus == Ordering.Domain.AggregatesModel.OrderAggregate.OrderStatus.AwaitingValidation
                    || o.OrderStatus == Ordering.Domain.AggregatesModel.OrderAggregate.OrderStatus.Submitted));

    public Task<bool> IsGuestBlockedAsync(string guestId, int branchId)
    {
        var now = DateTime.UtcNow;
        return context.GuestBlocks
            .AsNoTracking()
            .AnyAsync(b => b.GuestId == guestId && b.BranchId == branchId && b.BlockedUntil > now);
    }

    public async Task<IEnumerable<OrderSummary>> GetOpenOrdersAtPlaceAsync(int placeId, string? userId, string? guestId)
    {
        var open = context.Orders
            .AsNoTracking()
            .Where(o => o.PlaceId == placeId)
            .Where(o => o.PaidAt == null && o.VoidedAt == null)
            .Where(o => o.OrderStatus != Ordering.Domain.AggregatesModel.OrderAggregate.OrderStatus.Cancelled);

        // The tab is for the people on it: having the table's link is not
        // being at the table, but having an unpaid order there is. A caller
        // with nothing on the bill sees nothing — not even that there is one.
        var onTheTab = await open.AnyAsync(o =>
            (userId != null && o.Buyer != null && o.Buyer.IdentityGuid == userId)
            || (guestId != null && o.GuestId == guestId));
        if (!onTheTab)
        {
            return [];
        }

        return await open
            .Include(o => o.Buyer)
            .OrderBy(o => o.OrderDate)
            .Select(o => new OrderSummary
            {
                OrderNumber = o.Id,
                Date = o.OrderDate,
                Status = o.OrderStatus.ToString(),
                Total = Math.Max(0, (double)(o.OrderItems.Sum(oi => oi.UnitPrice * oi.Units - oi.Discount) - o.PromoDiscount) - o.LoyaltyDiscount),
                PointsToRedeem = o.PointsToRedeem,
                LoyaltyDiscount = o.LoyaltyDiscount,
                PromoCode = o.PromoCode,
                PromoDiscount = o.PromoDiscount,
                TicketId = o.TicketId,
                PlaceId = o.PlaceId,
                PlaceKind = o.PlaceKind,
                PlaceName = o.PlaceName,
                SessionId = o.SessionId,
                Source = o.Source.ToString(),
                UserName = o.Buyer != null ? o.Buyer.Name : o.GuestName,
                IsMine = (userId != null && o.Buyer != null && o.Buyer.IdentityGuid == userId)
                    || (guestId != null && o.GuestId == guestId),
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
        string? sort = null,
        string? guest = null)
    {
        var query = context.Orders.AsNoTracking().Include(o => o.Buyer)
            .Where(o => o.BranchId == branchId);

        // A guest is a phone number across devices, which only the directory
        // can tell: resolve their orders there, then list them like any other
        if (!string.IsNullOrWhiteSpace(guest))
        {
            var guestOrderIds = (await LoadGuestOrderRowsAsync(branchId))
                .Where(r => GuestDirectory.KeyFor(r.GuestId, r.GuestPhone) == guest)
                .Select(r => r.OrderId)
                .ToList();
            query = query.Where(o => guestOrderIds.Contains(o.Id));
        }

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
                Total = Math.Max(0, (double)(o.OrderItems.Sum(oi => oi.UnitPrice * oi.Units - oi.Discount) - o.PromoDiscount) - o.LoyaltyDiscount),
                PointsToRedeem = o.PointsToRedeem,
                LoyaltyDiscount = o.LoyaltyDiscount,
                PromoCode = o.PromoCode,
                PromoDiscount = o.PromoDiscount,
                PaidAt = o.PaidAt,
                ReceiptNumber = o.ReceiptNumber,
                PaidWith = o.PaidWith,
                RefundedAmount = o.RefundedAmount,
                VoidedAt = o.VoidedAt,
                TicketId = o.TicketId,
                PlaceId = o.PlaceId,
                PlaceKind = o.PlaceKind,
                PlaceName = o.PlaceName,
                SessionId = o.SessionId,
                Source = o.Source.ToString(),
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

    public async Task<PaginatedResult<GuestSummary>> GetGuestsAsync(int branchId, int pageIndex, int pageSize, string? search = null)
    {
        // Grouped in memory, as the stats are: telling who is the same guest
        // means normalizing phone numbers, which SQL would do badly, and a
        // branch's guest orders are a narrow projection
        var guests = GuestDirectory.Aggregate(await LoadGuestOrderRowsAsync(branchId), search);

        return new PaginatedResult<GuestSummary>
        {
            Items = guests.Skip(pageIndex * pageSize).Take(pageSize).ToList(),
            PageIndex = pageIndex,
            PageSize = pageSize,
            TotalCount = guests.Count
        };
    }

    /// <summary>
    /// The branch's guest orders that are still a guest's: an order a guest
    /// claimed by signing in has a buyer now, and is the account's.
    /// </summary>
    private async Task<List<GuestOrderRow>> LoadGuestOrderRowsAsync(int branchId)
        => await context.Orders
            .AsNoTracking()
            .Where(o => o.BranchId == branchId)
            .Where(GuestDirectory.IsUnclaimedGuestOrder)
            .Select(o => new GuestOrderRow(
                o.Id,
                o.GuestId!,
                o.GuestName,
                o.GuestPhone,
                o.OrderDate,
                o.OrderStatus == Ordering.Domain.AggregatesModel.OrderAggregate.OrderStatus.Cancelled,
                // The total the order list shows for the same order
                Math.Max(0, (double)(o.OrderItems.Sum(oi => oi.UnitPrice * oi.Units - oi.Discount) - o.PromoDiscount) - o.LoyaltyDiscount)))
            .ToListAsync();

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

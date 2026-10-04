#nullable enable
using Microsoft.Extensions.Options;
using DomainOrder = Ninja.Ordering.Domain.AggregatesModel.OrderAggregate.Order;

namespace Ninja.Ordering.API.Application.Deliveries;

/// <summary>
/// What the till's board, a rider's list and a caller's history read. Each
/// is bounded: open deliveries from the last couple of days, finished ones
/// only for a day, never voided ones, never more than a page's worth. The
/// stage and the total are the aggregate's own, worked out once there.
/// </summary>
public interface IDeliveryBoardQueries
{
    Task<List<DeliveryOrder>> GetBoardAsync(int branchId);

    Task<List<DeliveryOrder>> GetMineAsync(string riderUserId);

    /// <param name="branchId">Earlier deliveries are this branch's only; saved addresses are the customer's own.</param>
    Task<List<KnownAddressView>> GetKnownAddressesAsync(int branchId, string? customerUserId, string? phone);
}

public class DeliveryBoardQueries(
    OrderingContext context,
    TenantCountry country,
    IOptions<DeliveryOptions> options) : IDeliveryBoardQueries
{
    private DeliveryOptions Options => options.Value;

    /// <summary>Confirmed deliveries, not voided, confirmed within the open window, with what a card shows.</summary>
    private IQueryable<DomainOrder> Deliveries(DateTime openSince) =>
        context.Orders
            .AsNoTracking()
            .Include(o => o.OrderItems)
            .Include(o => o.Buyer)
            .Where(o => o.Delivery != null)
            .Where(o => o.OrderStatus == OrderStatus.Confirmed)
            .Where(o => o.VoidedAt == null)
            .Where(o => o.ConfirmedAt >= openSince);

    public async Task<List<DeliveryOrder>> GetBoardAsync(int branchId)
    {
        var now = DateTime.UtcNow;
        var finishedSince = now - Options.RecentlyFinished;

        // Open (cash not in, bill not settled another way), or closed within the day
        var orders = await Deliveries(now - Options.OpenWindow)
            .Where(o => o.BranchId == branchId)
            .Where(o => (o.Delivery!.CashHandedInAt == null && o.PaidAt == null)
                || o.Delivery.CashHandedInAt >= finishedSince
                || o.PaidAt >= finishedSince)
            .OrderBy(o => o.ConfirmedAt)
            .Take(Options.MaxListed)
            .ToListAsync();

        return orders.Select(ToView).ToList();
    }

    public async Task<List<DeliveryOrder>> GetMineAsync(string riderUserId)
    {
        var now = DateTime.UtcNow;
        var finishedSince = now - Options.RecentlyFinished;

        var orders = await Deliveries(now - Options.OpenWindow)
            .Where(o => o.Delivery!.RiderUserId == riderUserId)
            .Where(o => (o.Delivery!.DeliveredAt == null && o.Delivery.ReturnedAt == null)
                || o.Delivery.DeliveredAt >= finishedSince
                || o.Delivery.ReturnedAt >= finishedSince)
            .OrderBy(o => o.ConfirmedAt)
            .Take(Options.MaxListed)
            .ToListAsync();

        // Still to go first, oldest first; then what is finished, latest first
        return orders
            .Select(ToView)
            .OrderBy(o => o.Delivery.DeliveredAt != null || o.Delivery.ReturnedAt != null)
            .ThenBy(o => o.Delivery.DeliveredAt == null && o.Delivery.ReturnedAt == null ? o.ConfirmedAt : null)
            .ThenByDescending(o => o.Delivery.DeliveredAt ?? o.Delivery.ReturnedAt)
            .ToList();
    }

    public async Task<List<KnownAddressView>> GetKnownAddressesAsync(int branchId, string? customerUserId, string? phone)
    {
        var userId = string.IsNullOrWhiteSpace(customerUserId) ? null : customerUserId.Trim();
        var number = string.IsNullOrWhiteSpace(phone) ? null : PhoneRules.Normalize(phone, country.Code);
        if (userId is null && string.IsNullOrEmpty(number))
        {
            return [];
        }

        var saved = userId is null
            ? []
            : await context.CustomerAddresses
                .AsNoTracking()
                .Where(a => a.UserId == userId)
                .OrderByDescending(a => a.LastUsedAt)
                .Select(a => new KnownAddressView(a.Label, a.Latitude, a.Longitude, a.Address, a.Building, a.Floor, a.Apartment, a.Directions, a.Phone, null))
                .ToListAsync();

        // Two queries, each on its own index, rather than one OR that reads the whole table
        var delivered = new List<KnownAddressView>();
        if (userId is not null)
        {
            delivered.AddRange(await DeliveredTo(o => o.Buyer != null && o.Buyer.IdentityGuid == userId, branchId));
        }

        if (!string.IsNullOrEmpty(number))
        {
            delivered.AddRange(await DeliveredTo(o => o.Delivery!.Phone == number, branchId));
        }

        // The same door once, as it was last asked for
        return saved
            .Concat(delivered.OrderByDescending(a => a.LastDeliveredAt))
            .DistinctBy(a => (a.Address.ToLowerInvariant(), a.Building?.ToLowerInvariant(), a.Floor?.ToLowerInvariant(), a.Apartment?.ToLowerInvariant()))
            .Take(Options.MaxKnownAddresses)
            .ToList();
    }

    private Task<List<KnownAddressView>> DeliveredTo(System.Linq.Expressions.Expression<Func<DomainOrder, bool>> whose, int branchId) =>
        context.Orders
            .AsNoTracking()
            .Where(o => o.Delivery != null && o.BranchId == branchId)
            .Where(whose)
            .OrderByDescending(o => o.OrderDate)
            .Take(Options.KnownAddressLookback)
            .Select(o => new KnownAddressView(
                null, o.Delivery!.Latitude, o.Delivery.Longitude, o.Delivery.Address, o.Delivery.Building,
                o.Delivery.Floor, o.Delivery.Apartment, o.Delivery.Directions, o.Delivery.Phone, o.OrderDate))
            .ToListAsync();

    /// <summary>A delivery order as a card: the aggregate's own stage and total, the cash against it.</summary>
    public static DeliveryOrder ToView(DomainOrder o)
    {
        var total = o.GetTotal();
        var delivery = DeliveryStaffView.ForStaff(o.Delivery)!;
        return new DeliveryOrder
        {
            OrderNumber = o.Id,
            Date = o.OrderDate,
            ConfirmedAt = o.ConfirmedAt,
            ReadyAt = o.ReadyAt,
            PaidAt = o.PaidAt,
            CustomerName = o.Buyer?.Name ?? o.GuestName,
            CustomerNote = o.CustomerNote,
            Total = total,
            CashDifference = delivery.CashCollected is { } collected ? collected - total : null,
            Items = o.OrderItems.Select(oi => new Orderitem
            {
                ProductName = oi.ProductName,
                Units = oi.Units,
                UnitPrice = (double)oi.UnitPrice,
                PictureUrl = oi.PictureUrl,
                CustomizationsDescription = oi.CustomizationsDescription,
                SpecialInstructions = oi.SpecialInstructions,
            }).ToList(),
            Delivery = delivery,
        };
    }
}

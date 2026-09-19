namespace Ninja.Ordering.Infrastructure.Repositories;

public class OrderRepository
    : IOrderRepository
{
    private readonly OrderingContext _context;

    public IUnitOfWork UnitOfWork => _context;

    public OrderRepository(OrderingContext context)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
    }

    public Order Add(Order order)
    {
        return _context.Orders.Add(order).Entity;

    }

    public async Task<Order> GetAsync(int orderId)
    {
        var order = await _context.Orders.FindAsync(orderId);

        if (order != null)
        {
            await _context.Entry(order)
                .Collection(i => i.OrderItems).LoadAsync();
            await _context.Entry(order)
                .Reference(i => i.Buyer).LoadAsync();
            await _context.Entry(order)
                .Reference(i => i.Rating).LoadAsync();
        }

        return order;
    }

    public Task<List<int>> GetUnclaimedGuestOrderIdsAsync(string guestId)
        => _context.Orders
            .Where(o => o.GuestId == guestId && o.BuyerId == null && o.OrderStatus != OrderStatus.Cancelled)
            .OrderBy(o => o.Id)
            .Select(o => o.Id)
            .ToListAsync();

    public void Update(Order order)
    {
        _context.Entry(order).State = EntityState.Modified;
    }

    public void Delete(Order order)
    {
        _context.Orders.Remove(order);
    }

    public void AddRating(OrderRating rating)
    {
        _context.OrderRatings.Add(rating);
    }
}

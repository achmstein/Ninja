namespace Ninja.Ordering.Domain.AggregatesModel.OrderAggregate;

//This is just the RepositoryContracts or Interface defined at the Domain Layer
//as requisite for the Order Aggregate

public interface IOrderRepository : IRepository<Order>
{
    Order Add(Order order);

    void Update(Order order);

    void Delete(Order order);

    Task<Order> GetAsync(int orderId);

    /// <summary>
    /// The orders a guest device placed that no account has claimed yet -
    /// what a guest who signs in takes with them. Cancelled ones stay behind.
    /// </summary>
    Task<List<int>> GetUnclaimedGuestOrderIdsAsync(string guestId);

    void AddRating(OrderRating rating);
}

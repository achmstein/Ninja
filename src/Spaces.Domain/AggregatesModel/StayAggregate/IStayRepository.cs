namespace Ninja.Spaces.Domain.AggregatesModel.StayAggregate;

public interface IStayRepository : IRepository<Stay>
{
    Stay Add(Stay stay);
    void Update(Stay stay);
    Task<Stay?> GetAsync(int stayId);
    Task<Stay?> GetWithPlaceAsync(int stayId);

    /// <summary>The customer's held or running stay, if any (one at a time).</summary>
    Task<Stay?> GetOpenStayForCustomerAsync(string customerId);

    /// <summary>Every held or running stay (for the till's floor view).</summary>
    Task<List<Stay>> GetOpenStaysAsync();

    /// <summary>Held stays whose hold has lapsed.</summary>
    Task<List<Stay>> GetExpiredHoldsAsync();

    Task<List<Stay>> GetCustomerStaysAsync(string customerId, int? limit = null);

    /// <summary>Whether the place has a held or running stay (it is busy).</summary>
    Task<bool> HasOpenStayAsync(int placeId);

    Task<Stay?> GetWithMembersAsync(int stayId);
    Task<Stay?> GetWithSegmentsAsync(int stayId);

    /// <summary>The running stay at a place, members loaded.</summary>
    Task<Stay?> GetRunningStayForPlaceAsync(int placeId);
}

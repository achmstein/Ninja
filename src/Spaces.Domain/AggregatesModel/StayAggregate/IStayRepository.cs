namespace Ninja.Spaces.Domain.AggregatesModel.StayAggregate;

public interface IStayRepository : IRepository<Stay>
{
    Stay Add(Stay stay);
    void Update(Stay stay);
    Task<Stay?> GetAsync(int stayId);
    Task<Stay?> GetWithPlaceAsync(int stayId);

    /// <summary>The customer's running stay, if any (one at a time).</summary>
    Task<Stay?> GetOpenStayForCustomerAsync(string customerId);

    /// <summary>Every running stay (for the till's floor view).</summary>
    Task<List<Stay>> GetOpenStaysAsync();

    Task<List<Stay>> GetCustomerStaysAsync(string customerId, int? limit = null);

    /// <summary>Whether a stay is running at the place.</summary>
    Task<bool> HasOpenStayAsync(int placeId);

    Task<Stay?> GetWithMembersAsync(int stayId);
    Task<Stay?> GetWithSegmentsAsync(int stayId);

    /// <summary>The running stay at a place, members loaded.</summary>
    Task<Stay?> GetRunningStayForPlaceAsync(int placeId);
}

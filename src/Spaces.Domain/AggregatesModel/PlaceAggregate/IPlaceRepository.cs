namespace Ninja.Spaces.Domain.AggregatesModel.PlaceAggregate;

public interface IPlaceRepository : IRepository<Place>
{
    Place Add(Place place);
    void Update(Place place);
    void Delete(Place place);
    Task<Place?> GetAsync(int placeId);
    Task<List<Place>> GetAllAsync();
    Task<List<Place>> GetByKindAsync(PlaceKind kind);
    Task<List<Place>> GetByStatusAsync(PlaceStatus status);
    Task<bool> ExistsAsync(int placeId);
}

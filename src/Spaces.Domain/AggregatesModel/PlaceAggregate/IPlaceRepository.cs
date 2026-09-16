namespace Chillax.Spaces.Domain.AggregatesModel.PlaceAggregate;

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

    /// <summary>The place a printed room sticker (/room/{id}) points at, by the id it carried before the remodel.</summary>
    Task<Place?> GetByLegacyRoomIdAsync(int roomId);

    /// <summary>The place a printed table sticker (/table/{id}) points at.</summary>
    Task<Place?> GetByLegacyTableIdAsync(int tableId);
}

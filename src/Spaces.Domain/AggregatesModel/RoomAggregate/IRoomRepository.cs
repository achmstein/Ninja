using Chillax.Spaces.Domain.SeedWork;

namespace Chillax.Spaces.Domain.AggregatesModel.RoomAggregate;

/// <summary>
/// Repository interface for Room aggregate
/// </summary>
public interface IRoomRepository : IRepository<Room>
{
    Room Add(Room room);
    void Update(Room room);
    void Delete(Room room);
    Task<Room?> GetAsync(int roomId);
    Task<List<Room>> GetAllAsync();
    Task<List<Room>> GetByStatusAsync(RoomPhysicalStatus status);
    Task<bool> ExistsAsync(int roomId);
}
